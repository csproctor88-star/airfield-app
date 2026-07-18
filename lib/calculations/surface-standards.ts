// Surface-standards registry — the single import point for everything that
// previously binary-branched on the obstruction surface set inside the map
// component (legends, layer styling, polygon builders) and for the display
// labels that detail pages / PDFs / exports will consume in later tasks.
//
// Two engine sets are implemented (UFC 3-260-01 and FAA Part 77) and four
// selectable standards (AF Class A, AF Class B, Army Class B, FAA Part 77).
// The registry is shaped so a future standard is one added record; no other
// standard is stubbed or pre-wired here. The DB-level `SurfaceSet` lives in
// lib/airport-mode.ts — this module keys off the engine's 2-member union.

import type { SurfaceSet } from './obstructions'
import { IMAGINARY_SURFACES, getPart77Surfaces, ANNEX14_SURFACE_META } from './obstructions'
import { getSurfaceCriteria } from './surface-criteria'
import {
  generateRunwayPolygon,
  generatePrimarySurfacePolygon,
  generateClearZonePolygons,
  generateGradedAreaPolygons,
  generateApproachDeparturePolygons,
  generateStadiumPolygon,
  generateTransitionalPolygons,
  generateAPZPolygons,
  type RunwayGeometry,
} from './geometry'
import {
  buildPart77SurfacePolygons,
  type Part77RunwayInput,
  type SurfacePolygonFeature,
} from './part77-geometry'
import { buildAnnex14SurfacePolygons } from './annex14-geometry'
import type { IcaoApproachClassification, IcaoCodeNumber } from './annex14-criteria'

/**
 * Per-runway input the map passes to the active set's builder. Superset of
 * Part77RunwayInput (adds the ICAO Annex 14 variant fields), so every builder
 * reads only the fields it needs: UFC uses `geometry`, Part 77 adds
 * `approachType`, ICAO adds `classification` / `codeNumber` / `stripWidthM`.
 * Absent fields fall back to each set's engine-matching default. Mirrors how
 * `faa_approach_type` flows into Part77RunwayInput today.
 */
export type SurfaceRunwayInput = Part77RunwayInput & {
  classification?: IcaoApproachClassification | null
  codeNumber?: IcaoCodeNumber | null
  stripWidthM?: number | null
}

// ---------------------------------------------------------------------------
// Selectable standards
// ---------------------------------------------------------------------------

/** UFC runway classes that parameterize the UFC geometry generators. */
export type UfcRunwayClass = 'A' | 'B' | 'Army_B'

/** The five user-selectable obstruction standards. */
export type SurfaceStandardId = 'af_class_a' | 'af_class_b' | 'army_class_b' | 'icao_annex14' | 'faa_part77'

/**
 * Every selectable standard, keyed by id. `runwayClass` is non-null only for
 * the three UFC options; Part 77 and ICAO carry null (their per-runway
 * dimensions come from each runway's faa_approach_type / icao_* columns, not a
 * UFC class). A future standard is one added record here.
 */
export const SURFACE_STANDARD_OPTIONS: Record<SurfaceStandardId, {
  set: SurfaceSet
  runwayClass: UfcRunwayClass | null
  label: string
  citation: string
}> = {
  af_class_a:   { set: 'ufc_3_260_01', runwayClass: 'A',      label: 'Air Force Class A', citation: 'UFC 3-260-01 Table 3-7' },
  af_class_b:   { set: 'ufc_3_260_01', runwayClass: 'B',      label: 'Air Force Class B', citation: 'UFC 3-260-01 Table 3-7' },
  army_class_b: { set: 'ufc_3_260_01', runwayClass: 'Army_B', label: 'Army Class B',      citation: 'UFC 3-260-01 Table 3-7' },
  icao_annex14: { set: 'icao_annex14', runwayClass: null,     label: 'ICAO Annex 14 (NATO)', citation: 'ICAO Annex 14 Vol I Table 4-1' },
  faa_part77:   { set: 'faa_part77',   runwayClass: null,     label: 'FAA Part 77',       citation: '14 CFR §77.19' },
}

/** Stable display order for the standard picker. */
export const SURFACE_STANDARD_IDS: SurfaceStandardId[] = [
  'af_class_a',
  'af_class_b',
  'army_class_b',
  'icao_annex14',
  'faa_part77',
]

/** Short label per engine set (used where the class isn't relevant). */
export const SURFACE_SET_LABELS: Record<SurfaceSet, string> = {
  ufc_3_260_01: 'UFC 3-260-01',
  faa_part77: 'FAA Part 77 (14 CFR §77.19)',
  icao_annex14: 'ICAO Annex 14 (Vol I, 7th Ed.)',
}

/** Normalize a raw runway_class value to a valid UfcRunwayClass. NULL/
 *  undefined and any unrecognized value fall back to Class B — matching the
 *  engine's historical default. Single source of truth for that fallback;
 *  `ufcStandardIdForClass` and `deriveRunwayClassFromRunways` both read
 *  through this rather than duplicating the normalization. */
function normalizeUfcRunwayClass(runwayClass: string | null | undefined): UfcRunwayClass {
  return runwayClass === 'A' || runwayClass === 'Army_B' ? runwayClass : 'B'
}

/** Map a UFC runway class to its standard id, deriving from the options table
 *  (single source of truth). NULL/undefined and any unrecognized class fall
 *  back to Class B — matching the engine's historical default. */
function ufcStandardIdForClass(runwayClass: string | null | undefined): SurfaceStandardId {
  const normalized = normalizeUfcRunwayClass(runwayClass)
  const found = SURFACE_STANDARD_IDS.find(
    (id) =>
      SURFACE_STANDARD_OPTIONS[id].set === 'ufc_3_260_01' &&
      SURFACE_STANDARD_OPTIONS[id].runwayClass === normalized,
  )
  return found ?? 'af_class_b'
}

/**
 * Derive a single UFC runway class from a base's runway list — used where an
 * evaluation needs exactly one class (the engine takes one class per call,
 * not per-runway). Takes the FIRST runway's class when it's a recognized
 * value ('A' | 'B' | 'Army_B'); NULL/unknown values — including an empty
 * list — fall back to Class B. When runways disagree (mixed classes), the
 * first runway's class wins: this is documented behavior, not a bug — a
 * multi-runway base's "effective class" always follows its first configured
 * runway unless the operator picks an explicit standard via the picker.
 */
export function deriveRunwayClassFromRunways(
  classes: (string | null | undefined)[],
): UfcRunwayClass {
  return normalizeUfcRunwayClass(classes[0])
}

/**
 * Resolve a base's (set, runway classes) into a single standard id, or 'mixed'
 * when the UFC classes disagree. NULL/undefined classes are treated as 'B'
 * (the engine's historical default). faa_part77 → 'faa_part77' regardless of
 * classes. An empty runway list under UFC → 'af_class_b'.
 */
export function resolveStandard(
  set: SurfaceSet,
  runwayClasses: (string | null | undefined)[],
): SurfaceStandardId | 'mixed' {
  if (set === 'faa_part77') return 'faa_part77'
  if (set === 'icao_annex14') return 'icao_annex14'
  const ids = new Set(runwayClasses.map((c) => ufcStandardIdForClass(c)))
  if (ids.size === 0) return 'af_class_b'
  if (ids.size === 1) return Array.from(ids)[0]
  return 'mixed'
}

/**
 * Resolved display label for detail pages / PDF / exports. UFC renders as
 * 'UFC 3-260-01 — Air Force Class A' etc (uses runwayClass, NULL→'B'); Part 77
 * renders as 'FAA Part 77 (14 CFR §77.19)'.
 */
export function resolveStandardLabel(
  set: SurfaceSet,
  runwayClass: string | null | undefined,
): string {
  if (set === 'faa_part77') return SURFACE_SET_LABELS.faa_part77
  if (set === 'icao_annex14') return SURFACE_SET_LABELS.icao_annex14
  const id = ufcStandardIdForClass(runwayClass)
  return `${SURFACE_SET_LABELS.ufc_3_260_01} — ${SURFACE_STANDARD_OPTIONS[id].label}`
}

// ---------------------------------------------------------------------------
// Per-set rendering config (moved verbatim from the map component)
// ---------------------------------------------------------------------------

export interface LegendItem {
  label: string
  color: string
  toggleKey: string
  defaultOn: boolean
}

export interface SurfaceLayerDef {
  id: string
  color: string
  opacity: number
}

// Shared between the UFC and Part 77 layer lists — the runway outline itself
// isn't a §77.19/UFC "surface," so it has no set-specific color; both sets
// draw it identically.
const RUNWAY_LAYER: SurfaceLayerDef = { id: 'runway', color: '#FFFFFF', opacity: 0.5 }

// ── UFC 3-260-01 legend / layers ─────────────────────────────────────────────
// Colors read from IMAGINARY_SURFACES (Class-B-resolved display metadata) —
// identical to the map's pre-move constants.
const UFC_LEGEND_ITEMS: LegendItem[] = [
  { label: 'Outer Horizontal', color: IMAGINARY_SURFACES.outer_horizontal.color, toggleKey: 'outer-horizontal', defaultOn: true },
  { label: 'Conical', color: IMAGINARY_SURFACES.conical.color, toggleKey: 'conical', defaultOn: true },
  { label: 'Inner Horizontal', color: IMAGINARY_SURFACES.inner_horizontal.color, toggleKey: 'inner-horizontal', defaultOn: true },
  { label: 'Transitional', color: IMAGINARY_SURFACES.transitional.color, toggleKey: 'transitional', defaultOn: true },
  { label: 'Approach/Departure', color: IMAGINARY_SURFACES.approach_departure.color, toggleKey: 'approach-departure', defaultOn: true },
  { label: 'Primary', color: IMAGINARY_SURFACES.primary.color, toggleKey: 'primary-surface', defaultOn: true },
  { label: 'Clear Zone', color: IMAGINARY_SURFACES.clear_zone.color, toggleKey: 'clear-zone', defaultOn: false },
  { label: 'Graded Portion of CZ', color: IMAGINARY_SURFACES.graded_area.color, toggleKey: 'graded-area', defaultOn: false },
  { label: 'APZ I', color: IMAGINARY_SURFACES.apz_i.color, toggleKey: 'apz-i', defaultOn: false },
  { label: 'APZ II', color: IMAGINARY_SURFACES.apz_ii.color, toggleKey: 'apz-ii', defaultOn: false },
]

const UFC_SURFACE_LAYERS: SurfaceLayerDef[] = [
  { id: 'outer-horizontal', color: IMAGINARY_SURFACES.outer_horizontal.color, opacity: 0.08 },
  { id: 'conical', color: IMAGINARY_SURFACES.conical.color, opacity: 0.1 },
  { id: 'inner-horizontal', color: IMAGINARY_SURFACES.inner_horizontal.color, opacity: 0.12 },
  { id: 'transitional-left', color: IMAGINARY_SURFACES.transitional.color, opacity: 0.15 },
  { id: 'transitional-right', color: IMAGINARY_SURFACES.transitional.color, opacity: 0.15 },
  { id: 'approach-end1', color: IMAGINARY_SURFACES.approach_departure.color, opacity: 0.14 },
  { id: 'approach-end2', color: IMAGINARY_SURFACES.approach_departure.color, opacity: 0.14 },
  { id: 'apz-ii-end1', color: IMAGINARY_SURFACES.apz_ii.color, opacity: 0.12 },
  { id: 'apz-ii-end2', color: IMAGINARY_SURFACES.apz_ii.color, opacity: 0.12 },
  { id: 'apz-i-end1', color: IMAGINARY_SURFACES.apz_i.color, opacity: 0.14 },
  { id: 'apz-i-end2', color: IMAGINARY_SURFACES.apz_i.color, opacity: 0.14 },
  { id: 'clear-zone-end1', color: IMAGINARY_SURFACES.clear_zone.color, opacity: 0.16 },
  { id: 'clear-zone-end2', color: IMAGINARY_SURFACES.clear_zone.color, opacity: 0.16 },
  { id: 'primary-surface', color: IMAGINARY_SURFACES.primary.color, opacity: 0.18 },
  { id: 'graded-area-end1', color: IMAGINARY_SURFACES.graded_area.color, opacity: 0.2 },
  { id: 'graded-area-end2', color: IMAGINARY_SURFACES.graded_area.color, opacity: 0.2 },
  RUNWAY_LAYER,
]

// ── FAA Part 77 (§77.19) legend / layers ─────────────────────────────────────
// Part 77 surface colors are constant across approach types by design, so they
// read from the default getPart77Surfaces() set — identical to the map's
// pre-move PART77 constants.
const PART77_SURFACE_META = getPart77Surfaces()

const PART77_LEGEND_ITEMS: LegendItem[] = [
  { label: 'Conical', color: PART77_SURFACE_META.conical.color, toggleKey: 'p77-conical', defaultOn: true },
  { label: 'Horizontal', color: PART77_SURFACE_META.horizontal.color, toggleKey: 'p77-horizontal', defaultOn: true },
  { label: 'Transitional', color: PART77_SURFACE_META.transitional.color, toggleKey: 'p77-transitional', defaultOn: true },
  { label: 'Approach', color: PART77_SURFACE_META.approach.color, toggleKey: 'p77-approach', defaultOn: true },
  { label: 'Primary', color: PART77_SURFACE_META.primary.color, toggleKey: 'p77-primary', defaultOn: true },
]

// Drawn bottom-to-top: conical (widest) first, primary on top.
const PART77_SURFACE_LAYERS: SurfaceLayerDef[] = [
  { id: 'p77-conical', color: PART77_SURFACE_META.conical.color, opacity: 0.08 },
  { id: 'p77-horizontal', color: PART77_SURFACE_META.horizontal.color, opacity: 0.1 },
  { id: 'p77-transitional-left', color: PART77_SURFACE_META.transitional.color, opacity: 0.15 },
  { id: 'p77-transitional-right', color: PART77_SURFACE_META.transitional.color, opacity: 0.15 },
  { id: 'p77-approach-end1', color: PART77_SURFACE_META.approach.color, opacity: 0.14 },
  { id: 'p77-approach-end2', color: PART77_SURFACE_META.approach.color, opacity: 0.14 },
  { id: 'p77-segment-break-end1', color: PART77_SURFACE_META.approach.color, opacity: 0.32 },
  { id: 'p77-segment-break-end2', color: PART77_SURFACE_META.approach.color, opacity: 0.32 },
  { id: 'p77-primary', color: PART77_SURFACE_META.primary.color, opacity: 0.18 },
  RUNWAY_LAYER,
]

// ── ICAO Annex 14 (Vol I, 7th Ed.) legend / layers ───────────────────────────
// Five phase-1 surfaces. Colors read from ANNEX14_SURFACE_META (defined in
// obstructions.ts alongside the Part 77 meta) — same palette idiom as the other
// sets (approach orange / inner horizontal green / conical blue / transitional
// yellow / take-off climb violet). The three precision inner surfaces (inner
// approach / inner transitional / balked landing) are phase 2.
const ANNEX14_LEGEND_ITEMS: LegendItem[] = [
  { label: 'Conical', color: ANNEX14_SURFACE_META.conical.color, toggleKey: 'a14-conical', defaultOn: true },
  { label: 'Inner Horizontal', color: ANNEX14_SURFACE_META.inner_horizontal.color, toggleKey: 'a14-inner-horizontal', defaultOn: true },
  { label: 'Transitional', color: ANNEX14_SURFACE_META.transitional.color, toggleKey: 'a14-transitional', defaultOn: true },
  { label: 'Inner Transitional', color: ANNEX14_SURFACE_META.inner_transitional.color, toggleKey: 'a14-inner-transitional', defaultOn: true },
  { label: 'Approach', color: ANNEX14_SURFACE_META.approach.color, toggleKey: 'a14-approach', defaultOn: true },
  { label: 'Inner Approach', color: ANNEX14_SURFACE_META.inner_approach.color, toggleKey: 'a14-inner-approach', defaultOn: true },
  { label: 'Balked Landing', color: ANNEX14_SURFACE_META.balked_landing.color, toggleKey: 'a14-balked-landing', defaultOn: true },
  { label: 'Take-Off Climb', color: ANNEX14_SURFACE_META.takeoff_climb.color, toggleKey: 'a14-takeoff-climb', defaultOn: true },
]

// Drawn bottom-to-top: conical (widest) first, then the narrower surfaces.
const ANNEX14_SURFACE_LAYERS: SurfaceLayerDef[] = [
  { id: 'a14-conical', color: ANNEX14_SURFACE_META.conical.color, opacity: 0.08 },
  { id: 'a14-inner-horizontal', color: ANNEX14_SURFACE_META.inner_horizontal.color, opacity: 0.1 },
  { id: 'a14-transitional-left', color: ANNEX14_SURFACE_META.transitional.color, opacity: 0.15 },
  { id: 'a14-transitional-right', color: ANNEX14_SURFACE_META.transitional.color, opacity: 0.15 },
  { id: 'a14-inner-transitional-left', color: ANNEX14_SURFACE_META.inner_transitional.color, opacity: 0.2 },
  { id: 'a14-inner-transitional-right', color: ANNEX14_SURFACE_META.inner_transitional.color, opacity: 0.2 },
  { id: 'a14-approach-end1', color: ANNEX14_SURFACE_META.approach.color, opacity: 0.14 },
  { id: 'a14-approach-end2', color: ANNEX14_SURFACE_META.approach.color, opacity: 0.14 },
  { id: 'a14-inner-approach-end1', color: ANNEX14_SURFACE_META.inner_approach.color, opacity: 0.18 },
  { id: 'a14-inner-approach-end2', color: ANNEX14_SURFACE_META.inner_approach.color, opacity: 0.18 },
  { id: 'a14-balked-landing-end1', color: ANNEX14_SURFACE_META.balked_landing.color, opacity: 0.16 },
  { id: 'a14-balked-landing-end2', color: ANNEX14_SURFACE_META.balked_landing.color, opacity: 0.16 },
  { id: 'a14-takeoff-climb-end1', color: ANNEX14_SURFACE_META.takeoff_climb.color, opacity: 0.12 },
  { id: 'a14-takeoff-climb-end2', color: ANNEX14_SURFACE_META.takeoff_climb.color, opacity: 0.12 },
  RUNWAY_LAYER,
]

// ---------------------------------------------------------------------------
// UFC polygon builder (moved verbatim from the map's buildSurfacePolygons,
// now criteria-parameterized by runway class)
// ---------------------------------------------------------------------------

/**
 * Build the full UFC 3-260-01 feature set for all runways. Every dimension is
 * driven by the evaluated class's SurfaceCriteria (defaults to Class B, which
 * reproduces the map's historical output byte-for-byte). The shared 'runway'
 * outline is emitted per runway — it must render in every set.
 *
 * NOTE: the graded-area generator (generateGradedAreaPolygons) is not yet
 * class-parameterized in geometry.ts, so it is called without criteria for all
 * classes — preserving today's behavior exactly (unchanged from the pre-move
 * builder).
 */
export function buildUfcSurfacePolygons(
  runways: RunwayGeometry[],
  runwayClass: UfcRunwayClass | null = 'B',
): SurfacePolygonFeature[] {
  const criteria = getSurfaceCriteria(runwayClass ?? 'B')
  const features: SurfacePolygonFeature[] = []
  const primaryRwy = runways[0]

  const innerHRadius = criteria.inner_horizontal.radius
  const conicalExtent = criteria.conical.horizontalExtent
  const outerHRadius = criteria.outer_horizontal.radius

  features.push({ id: 'outer-horizontal', coords: generateStadiumPolygon(primaryRwy, outerHRadius, 64), rwyIndex: -1 })
  features.push({ id: 'conical', coords: generateStadiumPolygon(primaryRwy, innerHRadius + conicalExtent, 64), rwyIndex: -1 })
  features.push({ id: 'inner-horizontal', coords: generateStadiumPolygon(primaryRwy, innerHRadius, 64), rwyIndex: -1 })

  for (let ri = 0; ri < runways.length; ri++) {
    const rwy = runways[ri]
    const trans = generateTransitionalPolygons(rwy, criteria)
    features.push({ id: 'transitional-left', coords: trans.left, rwyIndex: ri })
    features.push({ id: 'transitional-right', coords: trans.right, rwyIndex: ri })

    const appDep = generateApproachDeparturePolygons(rwy, criteria)
    features.push({ id: 'approach-end1', coords: appDep.end1, rwyIndex: ri })
    features.push({ id: 'approach-end2', coords: appDep.end2, rwyIndex: ri })

    const apz = generateAPZPolygons(rwy, criteria)
    features.push({ id: 'apz-i-end1', coords: apz.apz_i_end1, rwyIndex: ri })
    features.push({ id: 'apz-i-end2', coords: apz.apz_i_end2, rwyIndex: ri })
    features.push({ id: 'apz-ii-end1', coords: apz.apz_ii_end1, rwyIndex: ri })
    features.push({ id: 'apz-ii-end2', coords: apz.apz_ii_end2, rwyIndex: ri })

    const cz = generateClearZonePolygons(rwy, criteria)
    features.push({ id: 'clear-zone-end1', coords: cz.end1, rwyIndex: ri })
    features.push({ id: 'clear-zone-end2', coords: cz.end2, rwyIndex: ri })

    features.push({ id: 'primary-surface', coords: generatePrimarySurfacePolygon(rwy, criteria), rwyIndex: ri })

    const graded = generateGradedAreaPolygons(rwy)
    features.push({ id: 'graded-area-end1', coords: graded.end1, rwyIndex: ri })
    features.push({ id: 'graded-area-end2', coords: graded.end2, rwyIndex: ri })

    features.push({ id: 'runway', coords: generateRunwayPolygon(rwy), rwyIndex: ri })
  }

  return features
}

// ---------------------------------------------------------------------------
// Registry — the single lookup the map component branches through
// ---------------------------------------------------------------------------

export interface SurfaceSetRenderConfig {
  legendItems: LegendItem[]
  surfaceLayers: SurfaceLayerDef[]
  /** Build the polygon feature set for all runways. The UFC builder consumes
   *  `runwayClass`; the Part 77 builder ignores it (its per-runway dimensions
   *  come from each runway's approachType); the ICAO builder ignores it too
   *  (its dimensions come from each runway's classification / code number /
   *  strip width). All emit the shared 'runway' outline feature. */
  buildPolygons: (
    runways: SurfaceRunwayInput[],
    runwayClass?: UfcRunwayClass | null,
  ) => SurfacePolygonFeature[]
}

export const SURFACE_SET_REGISTRY: Record<SurfaceSet, SurfaceSetRenderConfig> = {
  ufc_3_260_01: {
    legendItems: UFC_LEGEND_ITEMS,
    surfaceLayers: UFC_SURFACE_LAYERS,
    buildPolygons: (runways, runwayClass) =>
      buildUfcSurfacePolygons(runways.map((r) => r.geometry), runwayClass ?? 'B'),
  },
  faa_part77: {
    // Part 77's builder is pure §77.19 geometry (no runway pavement outline);
    // the shared outline is chrome, not a surface, so it's appended here —
    // mirroring the UFC builder's per-runway 'runway' feature.
    legendItems: PART77_LEGEND_ITEMS,
    surfaceLayers: PART77_SURFACE_LAYERS,
    buildPolygons: (runways) => [
      ...buildPart77SurfacePolygons(runways),
      ...runways.map((r, ri) => ({
        id: 'runway',
        coords: generateRunwayPolygon(r.geometry),
        rwyIndex: ri,
      })),
    ],
  },
  icao_annex14: {
    // Like Part 77, the Annex 14 builder is pure OLS geometry; the shared runway
    // outline is appended here. Each runway's icao_* variant (classification /
    // code number / strip width) is threaded through so it draws at its own
    // dimensions; absent fields fall back to ANNEX14_DEFAULT_VARIANT inside the
    // builder (the same NULL-fallback idiom Part 77's approachType uses).
    legendItems: ANNEX14_LEGEND_ITEMS,
    surfaceLayers: ANNEX14_SURFACE_LAYERS,
    buildPolygons: (runways) => [
      ...buildAnnex14SurfacePolygons(
        runways.map((r) => ({
          geometry: r.geometry,
          classification: r.classification,
          codeNumber: r.codeNumber,
          stripWidthM: r.stripWidthM,
        })),
      ),
      ...runways.map((r, ri) => ({
        id: 'runway',
        coords: generateRunwayPolygon(r.geometry),
        rwyIndex: ri,
      })),
    ],
  },
}
