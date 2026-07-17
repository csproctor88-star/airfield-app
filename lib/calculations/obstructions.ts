// UFC 3-260-01 Obstruction Evaluation Engine
// Evaluates an object against all imaginary surfaces defined in
// UFC 3-260-01, Chapter 3, plus APZ I/II land-use zones per
// DoD Instruction 4165.57, using actual runway geometry.
// Supports multiple runway classes (B, Army_B) via surface-criteria lookup.

import {
  type LatLon,
  type RunwayGeometry,
  getRunwayGeometry,
  pointToRunwayRelation,
  distanceFt,
  offsetPoint,
  normalizeBearing,
  pointToPolylineDistanceFt,
} from './geometry'
import { getSurfaceCriteria, type SurfaceCriteria } from './surface-criteria'
import {
  getOFAHalfWidth,
  getSafetyAreaHalfWidth,
  getTaxiwayCriteria,
  TAXIWAY_SURFACES,
  getUfcCriteria,
  type RunwayClass,
  type ServiceBranch,
} from './taxiway-criteria'

// ---------------------------------------------------------------------------
// Surface display metadata — UFC references, names, colors, descriptions
//
// `UFC_SURFACE_META` holds the CLASS-INVARIANT display data (name, color,
// ufcRef, description) plus a class-AWARE `ufcCriteria(criteria)` templater.
// All numeric dimensions come from surface-criteria.ts (the single numeric
// source of truth) via the passed-in `SurfaceCriteria`, so a Class A / Army B
// evaluation cites its own class's numbers instead of Class B's. The
// class-invariant metadata (names/colors/refs) and provenance for the numbers
// live, respectively, here and in surface-criteria.ts — not duplicated.
//
// `IMAGINARY_SURFACES` below is a back-compat, Class-B-RESOLVED view derived
// from this meta + getSurfaceCriteria('B') — NOT a second hardcoded copy. New
// code that needs class-correct display info should call getUfcSurfaceInfo(class)
// (or read UFC_SURFACE_META directly), not IMAGINARY_SURFACES.
// ---------------------------------------------------------------------------

/** Insert thousands separators into an integer, e.g. 50000 → "50,000". */
const withCommas = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export type UfcSurfaceKey =
  | 'clear_zone'
  | 'graded_area'
  | 'primary'
  | 'approach_departure'
  | 'inner_horizontal'
  | 'conical'
  | 'outer_horizontal'
  | 'transitional'
  | 'apz_i'
  | 'apz_ii'

export type UfcSurfaceMeta = {
  name: string
  color: string
  ufcRef: string
  description: string
  /** Class-aware criteria text — pass the evaluated class's SurfaceCriteria. */
  ufcCriteria: (criteria: SurfaceCriteria) => string
}

export const UFC_SURFACE_META: Record<UfcSurfaceKey, UfcSurfaceMeta> = {
  clear_zone: {
    name: 'Runway Clear Zone',
    color: '#EC4899',
    ufcRef: 'UFC 3-260-01, Chapter 3 & Appendix B, Section 13; DoD Instruction 4165.57, Table 1 (Runway Clear Zone)',
    description: 'Obstruction-free zone extending 3,000 ft from each runway threshold, 3,000 ft wide.',
    ufcCriteria: (c) =>
      `The clear zone must remain essentially obstruction free. No fixed or non-frangible objects permitted within ${withCommas(c.clear_zone.length)} ft x ${withCommas(c.clear_zone.halfWidth * 2)} ft from each runway end unless meeting B13 permissible deviation criteria.`,
  },
  graded_area: {
    name: 'Graded Portion of Clear Zone',
    color: '#F43F5E',
    ufcRef: 'UFC 3-260-01, Chapter 3 & Appendix B, Section 13 (Graded Portion of Clear Zone)',
    description: 'Rough-graded, obstruction-free portion of the clear zone extending 1,000 ft from each threshold, 3,000 ft wide.',
    ufcCriteria: (c) =>
      `The graded portion (${withCommas(c.graded_area.length)} ft from runway end, ${withCommas(c.graded_area.halfWidth * 2)} ft wide) must be rough graded and obstruction free. No above-ground fixed obstacles, structures, rigid poles, towers, or non-frangible equipment permitted.`,
  },
  primary: {
    name: 'Primary Surface',
    color: '#EF4444',
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 1 (Primary Surface)',
    description: 'No objects permitted above runway elevation within the primary surface boundaries.',
    ufcCriteria: (c) =>
      `No object may protrude above the primary surface elevation (runway elevation) within ${c.primary.halfWidth} ft of centerline and ${c.primary.extension} ft beyond each runway end.`,
  },
  approach_departure: {
    name: 'Approach-Departure Clearance Surface',
    color: '#F97316',
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 2 (Approach-Departure Clearance Surface)',
    description: '50:1 slope extending from each end of the primary surface.',
    // Slope (50:1 Class B / 40:1 Class A) and total length are class-specific —
    // numeric provenance is in surface-criteria.ts (Table 3-7 items 6–11).
    ufcCriteria: (c) =>
      `No object may penetrate the ${c.approach_departure.slope}:1 approach-departure clearance surface extending ${withCommas(c.approach_departure.length)} ft from the primary surface end.`,
  },
  inner_horizontal: {
    name: 'Inner Horizontal Surface',
    color: '#22C55E',
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 4 (Inner Horizontal Surface)',
    description: '150 ft above established airfield elevation within {radius} ft.',
    ufcCriteria: (c) =>
      `No object may protrude above ${c.inner_horizontal.height} ft above the established airfield elevation within a ${withCommas(c.inner_horizontal.radius)} ft radius of the runway ends.`,
  },
  conical: {
    name: 'Conical Surface',
    color: '#3B82F6',
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 5 (Conical Surface)',
    description: '20:1 slope outward from inner horizontal to 500 ft AGL.',
    ufcCriteria: (c) =>
      `No object may penetrate the ${c.conical.slope}:1 conical surface extending ${withCommas(c.conical.horizontalExtent)} ft outward from the inner horizontal surface boundary.`,
  },
  outer_horizontal: {
    name: 'Outer Horizontal Surface',
    color: '#8B5CF6',
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 6 (Outer Horizontal Surface)',
    description: '500 ft above established airfield elevation within {radius} ft.',
    ufcCriteria: (c) =>
      `No object may protrude above ${c.outer_horizontal.height} ft above the established airfield elevation within a ${withCommas(c.outer_horizontal.radius)} ft radius of the runway ends.`,
  },
  transitional: {
    name: 'Transitional Surface',
    color: '#EAB308',
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 3 (Transitional Surface)',
    description: '7:1 slope from primary/approach edges to inner horizontal height.',
    ufcCriteria: (c) =>
      `No object may penetrate the ${c.transitional.slope}:1 transitional surface extending from the primary surface and approach-departure surface edges to the inner horizontal surface height (${c.inner_horizontal.height} ft).`,
  },
  apz_i: {
    name: 'APZ I (Accident Potential Zone I)',
    color: '#D946EF',
    ufcRef: 'DoD Instruction 4165.57, Table 1 (APZ I)',
    description: 'High accident risk zone extending 5,000 ft beyond the clear zone, 3,000 ft wide.',
    ufcCriteria: () =>
      'APZ I — High accident risk zone. Only very low-density uses allowed: agriculture, grazing, open space, surface parking (no structures), roads with minimal traffic, and essential utility corridors. No residential, schools, hospitals, assembly uses, or high-occupancy facilities permitted.',
  },
  apz_ii: {
    name: 'APZ II (Accident Potential Zone II)',
    color: '#A78BFA',
    ufcRef: 'DoD Instruction 4165.57, Table 1 (APZ II)',
    description: 'Moderate accident risk zone extending 7,000 ft beyond APZ I, 3,000 ft wide.',
    ufcCriteria: () =>
      'APZ II — Moderate accident risk zone. Low-density commercial/industrial allowed: warehouses with low personnel density, open storage yards, and some limited community facilities (case-by-case). Residential strongly discouraged. High-density or high-occupancy uses prohibited.',
  },
}

/** Resolve one surface's class-invariant meta + a class's numeric criteria into
 *  the fully-populated display object used by result rows, the legend, and the
 *  map. The generic key preserves the precise per-surface `criteria` sub-type. */
function resolveUfcSurface<K extends UfcSurfaceKey>(key: K, criteria: SurfaceCriteria) {
  const meta = UFC_SURFACE_META[key]
  return {
    name: meta.name,
    criteria: criteria[key],
    ufcRef: meta.ufcRef,
    ufcCriteria: meta.ufcCriteria(criteria),
    description: meta.description,
    color: meta.color,
  }
}

/** Fully-resolved, class-correct per-surface display info. Registry/class-aware
 *  callers should use this; the evaluator reads UFC_SURFACE_META directly since
 *  it already holds the class's SurfaceCriteria in scope. */
export function getUfcSurfaceInfo(runwayClass: string) {
  const criteria = getSurfaceCriteria(runwayClass)
  return {
    clear_zone: resolveUfcSurface('clear_zone', criteria),
    graded_area: resolveUfcSurface('graded_area', criteria),
    primary: resolveUfcSurface('primary', criteria),
    approach_departure: resolveUfcSurface('approach_departure', criteria),
    inner_horizontal: resolveUfcSurface('inner_horizontal', criteria),
    conical: resolveUfcSurface('conical', criteria),
    outer_horizontal: resolveUfcSurface('outer_horizontal', criteria),
    transitional: resolveUfcSurface('transitional', criteria),
    apz_i: resolveUfcSurface('apz_i', criteria),
    apz_ii: resolveUfcSurface('apz_ii', criteria),
  }
}

/**
 * Back-compat, Class-B-RESOLVED view of the UFC surfaces. Derived from
 * UFC_SURFACE_META + getSurfaceCriteria('B') — not a second hardcoded copy of
 * the UFC numbers. Kept so the map component, `getSurfaces`, and the surface-set
 * reference panel keep compiling unchanged. New class-aware code should call
 * getUfcSurfaceInfo(runwayClass) or read UFC_SURFACE_META directly.
 */
export const IMAGINARY_SURFACES = getUfcSurfaceInfo('B')

// ---------------------------------------------------------------------------
// FAA Part 77 imaginary surfaces (civilian / Part 139 airports)
//
// Numeric dimensions reflect the "larger-than-utility, non-precision-instrument
// approach with visibility < 3/4 mile" defaults (14 CFR §77.19 + AC 150/5300-13B).
// This covers the typical Class III/IV non-hub commercial airport. Per-runway
// overrides (utility / precision-instrument) are runway-category data that
// land in Phase 3 when the obstruction UI ships; the engine will then pick the
// right row based on the runway's faa_approach_category column.
//
// Names are kept parallel to IMAGINARY_SURFACES where there's a 1:1 analog so
// existing report layouts and PDF templates can iterate without a key map.
// ---------------------------------------------------------------------------

/**
 * FAA approach types per 14 CFR §77.19 — drives Part 77 surface dimensions.
 * Six explicit options because the dimensional differences matter operationally
 * (e.g. utility-visual primary is 250 ft vs precision is 1,000 ft).
 */
export type FaaApproachType =
  | 'utility_visual'
  | 'utility_non_precision'
  | 'non_utility_visual'
  | 'non_utility_non_precision_3_4'
  | 'non_utility_non_precision_low'
  | 'non_utility_precision'

export const FAA_APPROACH_TYPE_LABELS: Record<FaaApproachType, string> = {
  utility_visual:                'Utility / Visual',
  utility_non_precision:         'Utility / Non-Precision',
  non_utility_visual:            'Non-Utility / Visual',
  non_utility_non_precision_3_4: 'Non-Utility / Non-Precision (≥ ¾ mi visibility)',
  non_utility_non_precision_low: 'Non-Utility / Non-Precision (< ¾ mi visibility)',
  non_utility_precision:         'Non-Utility / Precision Instrument',
}

type Part77SurfaceMeta = {
  name: string
  criteria: Record<string, number>
  ufcRef: string
  ufcCriteria: string
  description: string
  color: string
}

type Part77SurfaceSet = {
  primary:      Part77SurfaceMeta
  approach:     Part77SurfaceMeta
  horizontal:   Part77SurfaceMeta
  conical:      Part77SurfaceMeta
  transitional: Part77SurfaceMeta
}

/**
 * Per-approach-type Part 77 dimension table. Each row is the full
 * surface-metadata set used by both the engine (numeric criteria) and
 * the UI legend (color / ref / description). Conical and transitional
 * slopes are constant across all approach types per §77.19(b) and (e).
 * (Verified lettering: (a) Horizontal, (b) Conical, (c) Primary,
 * (d) Approach, (e) Transitional — 14 CFR Part 77, eCFR PDF current as
 * of 2026-07-14.)
 *
 * Default (when faa_approach_type is NULL) is `non_utility_non_precision_low`
 * which matches the Phase 1 hardcoded PART77_SURFACES constant — preserves
 * backward compatibility on bases that haven't picked a type yet.
 */
const PART77_DIMENSIONS: Record<FaaApproachType, Part77SurfaceSet> = {
  utility_visual: {
    primary: {
      name: 'Primary Surface',
      criteria: { halfWidth: 125, extension: 200, maxHeight: 0 }, // 250 ft total width
      ufcRef: '14 CFR §77.19(c) — Primary surface (utility / visual)',
      ufcCriteria: 'No object may protrude above the primary surface elevation within 125 ft of centerline (250 ft total width) and 200 ft beyond each runway end.',
      description: '250 ft wide × runway length + 200 ft (utility / visual).',
      color: '#EF4444',
    },
    approach: {
      name: 'Approach Surface',
      criteria: { slope: 20, innerHalfWidth: 125, outerHalfWidth: 625, length: 5000 },
      ufcRef: '14 CFR §77.19(d) — Approach surface (utility / visual)',
      ufcCriteria: '20:1 slope extending 5,000 ft from the runway end, expanding from 250 ft to 1,250 ft wide.',
      description: '20:1 slope, 5,000 ft long, 1,250 ft outer width.',
      color: '#F97316',
    },
    horizontal: {
      name: 'Horizontal Surface',
      criteria: { height: 150, radius: 5000 },
      ufcRef: '14 CFR §77.19(a) — Horizontal surface (utility)',
      ufcCriteria: 'No object may protrude above 150 ft above the established airport elevation within a 5,000 ft radius of each runway end (utility runway).',
      description: '150 ft above airport elevation within 5,000 ft (utility).',
      color: '#22C55E',
    },
    conical: {
      name: 'Conical Surface',
      criteria: { slope: 20, horizontalExtent: 4000, baseHeight: 150 },
      ufcRef: '14 CFR §77.19(b) — Conical surface',
      ufcCriteria: '20:1 slope extending 4,000 ft outward from the horizontal surface boundary.',
      description: '20:1 slope, 4,000 ft horizontal extent.',
      color: '#3B82F6',
    },
    transitional: {
      name: 'Transitional Surface',
      criteria: { slope: 7, primaryHalfWidth: 125 },
      ufcRef: '14 CFR §77.19(e) — Transitional surface',
      ufcCriteria: '7:1 slope from primary/approach edges upward to horizontal surface (150 ft above airport elevation).',
      description: '7:1 slope from edges to horizontal height.',
      color: '#EAB308',
    },
  },
  utility_non_precision: {
    primary: {
      name: 'Primary Surface',
      criteria: { halfWidth: 250, extension: 200, maxHeight: 0 }, // 500 ft total
      ufcRef: '14 CFR §77.19(c) — Primary surface (utility / non-precision)',
      ufcCriteria: 'No object may protrude above the primary surface elevation within 250 ft of centerline (500 ft total width) and 200 ft beyond each runway end.',
      description: '500 ft wide × runway length + 200 ft (utility / non-precision).',
      color: '#EF4444',
    },
    approach: {
      name: 'Approach Surface',
      criteria: { slope: 20, innerHalfWidth: 250, outerHalfWidth: 1000, length: 5000 },
      ufcRef: '14 CFR §77.19(d) — Approach surface (utility / non-precision)',
      ufcCriteria: '20:1 slope extending 5,000 ft from the runway end, expanding from 500 ft to 2,000 ft wide.',
      description: '20:1 slope, 5,000 ft long, 2,000 ft outer width.',
      color: '#F97316',
    },
    horizontal: {
      name: 'Horizontal Surface',
      criteria: { height: 150, radius: 5000 },
      ufcRef: '14 CFR §77.19(a) — Horizontal surface (utility)',
      ufcCriteria: 'No object may protrude above 150 ft above the established airport elevation within a 5,000 ft radius of each runway end (utility runway).',
      description: '150 ft above airport elevation within 5,000 ft (utility).',
      color: '#22C55E',
    },
    conical: {
      name: 'Conical Surface',
      criteria: { slope: 20, horizontalExtent: 4000, baseHeight: 150 },
      ufcRef: '14 CFR §77.19(b) — Conical surface',
      ufcCriteria: '20:1 slope extending 4,000 ft outward from the horizontal surface boundary.',
      description: '20:1 slope, 4,000 ft horizontal extent.',
      color: '#3B82F6',
    },
    transitional: {
      name: 'Transitional Surface',
      criteria: { slope: 7, primaryHalfWidth: 250 },
      ufcRef: '14 CFR §77.19(e) — Transitional surface',
      ufcCriteria: '7:1 slope from primary/approach edges upward to horizontal surface (150 ft above airport elevation).',
      description: '7:1 slope from edges to horizontal height.',
      color: '#EAB308',
    },
  },
  non_utility_visual: {
    primary: {
      name: 'Primary Surface',
      criteria: { halfWidth: 250, extension: 200, maxHeight: 0 }, // 500 ft total
      ufcRef: '14 CFR §77.19(c) — Primary surface (non-utility / visual)',
      ufcCriteria: 'No object may protrude above the primary surface elevation within 250 ft of centerline (500 ft total width) and 200 ft beyond each runway end.',
      description: '500 ft wide × runway length + 200 ft (non-utility / visual).',
      color: '#EF4444',
    },
    approach: {
      name: 'Approach Surface',
      criteria: { slope: 20, innerHalfWidth: 250, outerHalfWidth: 750, length: 5000 },
      ufcRef: '14 CFR §77.19(d) — Approach surface (non-utility / visual)',
      ufcCriteria: '20:1 slope extending 5,000 ft from the runway end, expanding from 500 ft to 1,500 ft wide.',
      description: '20:1 slope, 5,000 ft long, 1,500 ft outer width.',
      color: '#F97316',
    },
    horizontal: {
      name: 'Horizontal Surface',
      // radius verified 5,000 ft per 14 CFR §77.19(a): "5,000 feet for all
      // runways designated as utility or visual" — a visual runway takes the
      // 5,000-ft arc regardless of utility/non-utility. Previously mis-grouped
      // with the 10,000-ft set. law.cornell.edu/cfr/text/14/77.19, 2026-07-16.
      // ufcRef qualifier corrected from "(non-utility)" to "(visual)" to match:
      // the 5,000-ft radius here is driven by visual status, not utility status
      // (see the ufcCriteria/description below, already "(visual runway)"/"(visual)").
      criteria: { height: 150, radius: 5000 },
      ufcRef: '14 CFR §77.19(a) — Horizontal surface (visual)',
      ufcCriteria: 'No object may protrude above 150 ft above the established airport elevation within a 5,000 ft radius of each runway end (visual runway).',
      description: '150 ft above airport elevation within 5,000 ft (visual).',
      color: '#22C55E',
    },
    conical: {
      name: 'Conical Surface',
      criteria: { slope: 20, horizontalExtent: 4000, baseHeight: 150 },
      ufcRef: '14 CFR §77.19(b) — Conical surface',
      ufcCriteria: '20:1 slope extending 4,000 ft outward from the horizontal surface boundary.',
      description: '20:1 slope, 4,000 ft horizontal extent.',
      color: '#3B82F6',
    },
    transitional: {
      name: 'Transitional Surface',
      criteria: { slope: 7, primaryHalfWidth: 250 },
      ufcRef: '14 CFR §77.19(e) — Transitional surface',
      ufcCriteria: '7:1 slope from primary/approach edges upward to horizontal surface (150 ft above airport elevation).',
      description: '7:1 slope from edges to horizontal height.',
      color: '#EAB308',
    },
  },
  non_utility_non_precision_3_4: {
    primary: {
      name: 'Primary Surface',
      criteria: { halfWidth: 250, extension: 200, maxHeight: 0 },
      ufcRef: '14 CFR §77.19(c) — Primary surface (non-utility non-precision ≥¾ mi)',
      ufcCriteria: 'No object may protrude above the primary surface elevation within 250 ft of centerline (500 ft total width) and 200 ft beyond each runway end.',
      description: '500 ft wide × runway length + 200 ft (non-utility non-precision ≥¾ mi).',
      color: '#EF4444',
    },
    approach: {
      name: 'Approach Surface',
      // outerHalfWidth verified 1,750 ft (3,500-ft total end width) per
      // 14 CFR §77.19(d), law.cornell.edu/cfr/text/14/77.19 fetch 2026-07-16.
      criteria: { slope: 34, innerHalfWidth: 250, outerHalfWidth: 1750, length: 10000 },
      ufcRef: '14 CFR §77.19(d) — Approach surface (non-utility non-precision ≥¾ mi)',
      ufcCriteria: '34:1 slope extending 10,000 ft from the runway end, expanding from 500 ft to 3,500 ft wide (visibility ≥ ¾ mile).',
      description: '34:1 slope, 10,000 ft long, 3,500 ft outer width.',
      color: '#F97316',
    },
    horizontal: {
      name: 'Horizontal Surface',
      criteria: { height: 150, radius: 10000 },
      ufcRef: '14 CFR §77.19(a) — Horizontal surface (non-utility)',
      ufcCriteria: 'No object may protrude above 150 ft above the established airport elevation within a 10,000 ft radius of each runway end (non-utility runway).',
      description: '150 ft above airport elevation within 10,000 ft (non-utility).',
      color: '#22C55E',
    },
    conical: {
      name: 'Conical Surface',
      criteria: { slope: 20, horizontalExtent: 4000, baseHeight: 150 },
      ufcRef: '14 CFR §77.19(b) — Conical surface',
      ufcCriteria: '20:1 slope extending 4,000 ft outward from the horizontal surface boundary.',
      description: '20:1 slope, 4,000 ft horizontal extent.',
      color: '#3B82F6',
    },
    transitional: {
      name: 'Transitional Surface',
      criteria: { slope: 7, primaryHalfWidth: 250 },
      ufcRef: '14 CFR §77.19(e) — Transitional surface',
      ufcCriteria: '7:1 slope from primary/approach edges upward to horizontal surface (150 ft above airport elevation).',
      description: '7:1 slope from edges to horizontal height.',
      color: '#EAB308',
    },
  },
  non_utility_non_precision_low: {
    // Phase 1 hardcoded default — preserves backward compat for any callers
    // that don't yet pass an approach type.
    primary: {
      name: 'Primary Surface',
      // halfWidth verified 500 ft (1,000-ft total width) per 14 CFR
      // §77.19(c)(3)(iii): "1,000 feet for a non-precision instrument runway
      // having a non-precision instrument approach with visibility minimums
      // as low as three-fourths of a statute mile". Previously encoded
      // 250/500 ft. law.cornell.edu/cfr/text/14/77.19, 2026-07-16.
      criteria: { halfWidth: 500, extension: 200, maxHeight: 0 },
      ufcRef: '14 CFR §77.19(c) — Primary surface (non-utility non-precision <¾ mi)',
      ufcCriteria: 'No object may protrude above the primary surface elevation within 500 ft of centerline (1,000 ft total width) and 200 ft beyond each runway end.',
      description: '1,000 ft wide × runway length + 200 ft (non-utility non-precision <¾ mi).',
      color: '#EF4444',
    },
    approach: {
      name: 'Approach Surface',
      // innerHalfWidth mirrors the corrected 500-ft primary half-width per
      // §77.19(d): "The inner edge of the approach surface is the same width
      // as the primary surface." law.cornell.edu fetch 2026-07-16.
      criteria: { slope: 34, innerHalfWidth: 500, outerHalfWidth: 2000, length: 10000 },
      ufcRef: '14 CFR §77.19(d) — Approach surface (non-utility non-precision <¾ mi)',
      ufcCriteria: '34:1 slope extending 10,000 ft from the runway end, expanding from 1,000 ft to 4,000 ft wide (visibility < ¾ mile).',
      description: '34:1 slope, 10,000 ft long, 4,000 ft outer width.',
      color: '#F97316',
    },
    horizontal: {
      name: 'Horizontal Surface',
      criteria: { height: 150, radius: 10000 },
      ufcRef: '14 CFR §77.19(a) — Horizontal surface (non-utility)',
      ufcCriteria: 'No object may protrude above 150 ft above the established airport elevation within a 10,000 ft radius of each runway end (non-utility runway).',
      description: '150 ft above airport elevation within 10,000 ft (non-utility).',
      color: '#22C55E',
    },
    conical: {
      name: 'Conical Surface',
      criteria: { slope: 20, horizontalExtent: 4000, baseHeight: 150 },
      ufcRef: '14 CFR §77.19(b) — Conical surface',
      ufcCriteria: '20:1 slope extending 4,000 ft outward from the horizontal surface boundary.',
      description: '20:1 slope, 4,000 ft horizontal extent.',
      color: '#3B82F6',
    },
    transitional: {
      name: 'Transitional Surface',
      // primaryHalfWidth mirrors the corrected 500-ft primary half-width
      // (§77.19(c)(3)(iii) primary width; transitional rises from its edge).
      criteria: { slope: 7, primaryHalfWidth: 500 },
      ufcRef: '14 CFR §77.19(e) — Transitional surface',
      ufcCriteria: '7:1 slope from primary/approach edges upward to horizontal surface (150 ft above airport elevation).',
      description: '7:1 slope from edges to horizontal height.',
      color: '#EAB308',
    },
  },
  non_utility_precision: {
    primary: {
      name: 'Primary Surface',
      criteria: { halfWidth: 500, extension: 200, maxHeight: 0 }, // 1000 ft total
      ufcRef: '14 CFR §77.19(c) — Primary surface (non-utility precision)',
      ufcCriteria: 'No object may protrude above the primary surface elevation within 500 ft of centerline (1,000 ft total width) and 200 ft beyond each runway end.',
      description: '1,000 ft wide × runway length + 200 ft (non-utility precision).',
      color: '#EF4444',
    },
    approach: {
      // Precision: 50:1 first 10,000 ft + 40:1 next 40,000 ft. Engine
      // encodes both via secondSegmentSlope + segmentLength.
      name: 'Approach Surface',
      criteria: {
        slope: 50,
        innerHalfWidth: 500,
        outerHalfWidth: 8000,
        length: 50000,
        secondSegmentSlope: 40,
        segmentLength: 10000,
      },
      ufcRef: '14 CFR §77.19(d) — Approach surface (non-utility precision instrument)',
      ufcCriteria: '50:1 slope for first 10,000 ft then 40:1 for the next 40,000 ft, expanding from 1,000 ft to 16,000 ft wide.',
      description: '50:1 (first 10kft) then 40:1 (next 40kft), 50,000 ft long, 16,000 ft outer width.',
      color: '#F97316',
    },
    horizontal: {
      name: 'Horizontal Surface',
      criteria: { height: 150, radius: 10000 },
      ufcRef: '14 CFR §77.19(a) — Horizontal surface (non-utility)',
      ufcCriteria: 'No object may protrude above 150 ft above the established airport elevation within a 10,000 ft radius of each runway end (non-utility runway).',
      description: '150 ft above airport elevation within 10,000 ft (non-utility).',
      color: '#22C55E',
    },
    conical: {
      name: 'Conical Surface',
      criteria: { slope: 20, horizontalExtent: 4000, baseHeight: 150 },
      ufcRef: '14 CFR §77.19(b) — Conical surface',
      ufcCriteria: '20:1 slope extending 4,000 ft outward from the horizontal surface boundary.',
      description: '20:1 slope, 4,000 ft horizontal extent.',
      color: '#3B82F6',
    },
    transitional: {
      name: 'Transitional Surface',
      criteria: { slope: 7, primaryHalfWidth: 500 },
      ufcRef: '14 CFR §77.19(e) — Transitional surface',
      ufcCriteria: '7:1 slope from primary/approach edges upward to horizontal surface (150 ft above airport elevation).',
      description: '7:1 slope from edges to horizontal height.',
      color: '#EAB308',
    },
  },
}

/** Looks up the per-type Part 77 surface set. Defaults to the
 * non_utility_non_precision_low set (the Phase 1 hardcoded values) so
 * callers that don't yet pass a type see the same numbers as before. */
export function getPart77Surfaces(
  approachType: FaaApproachType = 'non_utility_non_precision_low',
): Part77SurfaceSet {
  return PART77_DIMENSIONS[approachType]
}

/**
 * Backward-compat re-export: callers that imported `PART77_SURFACES`
 * directly get the default (non_utility_non_precision_low) set. The
 * test file has been refactored to call `getPart77Surfaces(type)`.
 */
export const PART77_SURFACES = PART77_DIMENSIONS.non_utility_non_precision_low

/**
 * Resolves the correct imaginary-surface set for a base. Returns the
 * IMAGINARY_SURFACES (UFC) set by default; pass surfaceSet='faa_part77'
 * + optional approachType for civilian Part 139 airports. Keys differ
 * between sets — UFC has clear_zone / graded_area / apz_i / apz_ii /
 * inner_horizontal / outer_horizontal that Part 77 doesn't, and Part 77
 * collapses inner/outer horizontal into a single horizontal surface.
 * Callers iterating should treat each set's keys as authoritative for
 * that mode.
 */
export type SurfaceSet = 'ufc_3_260_01' | 'faa_part77'
export function getSurfaces(
  surfaceSet: SurfaceSet = 'ufc_3_260_01',
  approachType: FaaApproachType = 'non_utility_non_precision_low',
) {
  return surfaceSet === 'faa_part77' ? getPart77Surfaces(approachType) : IMAGINARY_SURFACES
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type SurfaceEvaluation = {
  surfaceKey: string
  surfaceName: string
  isWithinBounds: boolean
  maxAllowableHeightAGL: number
  maxAllowableHeightMSL: number
  obstructionTopMSL: number
  violated: boolean
  penetrationFt: number
  ufcReference: string
  ufcCriteria: string
  color: string
  runwayLabel?: string
  // Calculation transparency fields
  baselineElevation?: number   // The elevation used as the surface baseline (threshold or airfield)
  baselineLabel?: string       // Human label, e.g. "RWY 06L threshold" or "Airfield elevation"
  calculationBreakdown?: string // Step-by-step formula, e.g. "539.1 ft + 12,500 ft / 50 = 789.1 ft MSL"
}

export type ObstructionAnalysis = {
  // Location data
  point: LatLon
  groundElevationMSL: number
  obstructionHeightAGL: number
  obstructionTopMSL: number

  // Runway relationship
  distanceFromCenterline: number
  alongTrackFromMidpoint: number
  nearerEnd: 'end1' | 'end2'
  side: 'left' | 'right'

  // Surface evaluations
  surfaces: SurfaceEvaluation[]
  hasViolation: boolean
  controllingSurface: SurfaceEvaluation | null
  violatedSurfaces: SurfaceEvaluation[]

  // Waiver guidance
  waiverGuidance: string[]

  // Multi-runway: label for which runway this analysis applies to
  runwayLabel?: string
}

export type MultiRunwayAnalysis = {
  // Per-runway results
  perRunway: { runwayLabel: string; analysis: ObstructionAnalysis }[]

  // Merged summary
  point: LatLon
  groundElevationMSL: number
  obstructionHeightAGL: number
  obstructionTopMSL: number
  hasViolation: boolean
  controllingSurface: SurfaceEvaluation | null
  violatedSurfaces: SurfaceEvaluation[]
  waiverGuidance: string[]
}

// ---------------------------------------------------------------------------
// Evaluation engine
// ---------------------------------------------------------------------------

/**
 * Determine the distance from the nearest primary-surface end center
 * along the extended centerline axis. This is used for approach-departure
 * surface height calculations.
 */
function distanceFromNearestPrimaryEndCenter(
  point: LatLon,
  rwy: RunwayGeometry,
): { distance: number; end: 'end1' | 'end2' } {
  const extension = 200
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  const primaryEnd1 = offsetPoint(rwy.end1, revBearing, extension)
  const primaryEnd2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  const d1 = distanceFt(point, primaryEnd1)
  const d2 = distanceFt(point, primaryEnd2)

  return d1 <= d2
    ? { distance: d1, end: 'end1' }
    : { distance: d2, end: 'end2' }
}

/**
 * Determine if a point is within the stadium-shaped boundary used by
 * inner horizontal, conical, and outer horizontal surfaces.
 * The stadium is formed by arcs of `radius` around each primary surface end,
 * connected by tangent lines parallel to the centerline.
 */
function distanceFromStadiumCenter(
  point: LatLon,
  rwy: RunwayGeometry,
): number {
  // The stadium is the Minkowski sum of the runway's primary-end segment
  // with a circle of the given radius. The "distance to stadium" is just
  // the distance to the nearest point on the segment between the two
  // primary-surface end centers.
  const extension = 200
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  const primaryEnd1 = offsetPoint(rwy.end1, revBearing, extension)
  const primaryEnd2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  const relation = pointToRunwayRelation(point, rwy)

  // If the point projects onto the segment between the two primary ends,
  // the distance is just the perpendicular distance from centerline.
  const halfPrimaryLength = rwy.lengthFt / 2 + extension
  if (Math.abs(relation.alongTrackFromMidpoint) <= halfPrimaryLength) {
    return relation.distanceFromCenterline
  }

  // Otherwise, the distance is to the nearer primary-end center
  const d1 = distanceFt(point, primaryEnd1)
  const d2 = distanceFt(point, primaryEnd2)
  return Math.min(d1, d2)
}

/**
 * Full obstruction evaluation against all UFC 3-260-01 imaginary surfaces.
 * Surface dimensions are determined by `runwayClass` (defaults to 'B').
 */
export function evaluateObstruction(
  point: LatLon,
  obstructionHeightAGL: number,
  groundElevationMSL: number | null,
  rwy: RunwayGeometry,
  airfieldElevMSL = 580,
  runwayClass = 'B',
): ObstructionAnalysis {
  const runway = rwy
  const airfieldElev = airfieldElevMSL
  const criteria = getSurfaceCriteria(runwayClass)
  const groundElev = groundElevationMSL ?? airfieldElev
  const obstructionTopMSL = groundElev + obstructionHeightAGL
  const heightAboveField = obstructionTopMSL - airfieldElev

  // Honor the runway class's primary half-width (Army Class B is 500 ft, not
  // the 1,000-ft AF default) so `relation.withinPrimary` reflects the class.
  const relation = pointToRunwayRelation(point, runway, {
    primaryHalfWidth: criteria.primary.halfWidth,
  })
  const stadiumDist = distanceFromStadiumCenter(point, runway)

  // Helper: format a number with commas
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

  // Airfield baseline label
  const airfieldBaselineLabel = 'Airfield elevation'

  const surfaces: SurfaceEvaluation[] = []

  // Helper: along-track distances from each threshold (positive = beyond threshold, away from runway)
  const halfLength = runway.lengthFt / 2
  const beyondEnd1 = Math.max(0, -(relation.alongTrackFromMidpoint + halfLength))
  const beyondEnd2 = Math.max(0, relation.alongTrackFromMidpoint - halfLength)

  // --- 1. Primary Surface ---
  {
    const c = criteria.primary
    const isWithin = relation.withinPrimary
    const maxAGL = c.maxHeight // 0 ft
    const maxMSL = airfieldElev + maxAGL
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'primary',
      surfaceName: UFC_SURFACE_META.primary.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: UFC_SURFACE_META.primary.ufcRef,
      ufcCriteria: UFC_SURFACE_META.primary.ufcCriteria(criteria),
      color: UFC_SURFACE_META.primary.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${maxAGL} ft (max height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 2. Approach-Departure Clearance Surface ---
  // Per UFC 3-260-01, the approach-departure surface rises at 50:1 from the
  // threshold (primary surface end) elevation. When per-threshold elevations
  // are provided via RunwayGeometry, use the nearer threshold's elevation as
  // the baseline; otherwise fall back to the airfield-wide elevation.
  {
    const c = criteria.approach_departure
    // Distance from nearest primary surface end along extended centerline
    const primaryEndInfo = distanceFromNearestPrimaryEndCenter(point, runway)
    const distAlongApproach = relation.distanceFromNearestPrimaryEnd

    // Is the point within the approach-departure zone?
    // It must be beyond the primary surface end and within the trapezoidal boundary.
    const beyondPrimary = !relation.withinPrimary && distAlongApproach > 0
    const withinLength = distAlongApproach <= c.length

    // The trapezoid width expands linearly
    const widthAtDistance =
      c.innerHalfWidth +
      (distAlongApproach / c.length) * (c.outerHalfWidth - c.innerHalfWidth)
    const withinWidth = relation.distanceFromCenterline <= widthAtDistance

    const isWithin = beyondPrimary && withinLength && withinWidth

    // Use the threshold elevation of the nearer runway end as the surface baseline
    const thresholdElev = primaryEndInfo.end === 'end1'
      ? (runway.end1ElevationMSL ?? airfieldElev)
      : (runway.end2ElevationMSL ?? airfieldElev)

    const nearerDesignator = primaryEndInfo.end === 'end1'
      ? runway.end1Designator
      : runway.end2Designator

    const usedThreshold = primaryEndInfo.end === 'end1'
      ? runway.end1ElevationMSL !== undefined
      : runway.end2ElevationMSL !== undefined

    const thresholdLabel = nearerDesignator
      ? `RWY ${nearerDesignator} threshold`
      : usedThreshold
        ? `Nearest threshold (${primaryEndInfo.end})`
        : 'Airfield elevation (threshold not set)'

    // The ADCS rises at slope:1 from the threshold, then levels off at the
    // horizontal portion (EAE + horizontalElevation, Table 3-7 item 11).
    // Skip the cap when horizontalElevation is null (no horizontal portion).
    const slopedMSL = thresholdElev + distAlongApproach / c.slope
    const horizontalElev = c.horizontalElevation
    const capMSL = horizontalElev != null ? airfieldElev + horizontalElev : null
    const isCapped = capMSL != null && slopedMSL >= capMSL
    const maxMSL = capMSL != null ? Math.min(slopedMSL, capMSL) : slopedMSL
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'approach_departure',
      surfaceName: UFC_SURFACE_META.approach_departure.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: UFC_SURFACE_META.approach_departure.ufcRef,
      ufcCriteria: UFC_SURFACE_META.approach_departure.ufcCriteria(criteria),
      color: UFC_SURFACE_META.approach_departure.color,
      baselineElevation: isCapped ? airfieldElev : thresholdElev,
      baselineLabel: isCapped ? airfieldBaselineLabel : thresholdLabel,
      calculationBreakdown: isCapped
        ? `${fmt(airfieldElev)} ft (airfield elev) + ${horizontalElev} ft (ADCS horizontal portion) = ${fmt(maxMSL)} ft MSL`
        : `${fmt(thresholdElev)} ft (${thresholdLabel}) + ${fmt(distAlongApproach)} ft / ${c.slope} (slope) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 3. Transitional Surface ---
  // Per UFC 3-260-01 Para 3-1.6, the transitional surface extends from the edges
  // of both the primary surface AND the approach-departure clearance surface,
  // outward and upward at 7:1 to the inner horizontal surface height (150 ft).
  {
    const c = criteria.transitional
    const ac = criteria.approach_departure
    const primaryHalfWidth = c.primaryHalfWidth
    const maxTransitionalExtent = 150 * c.slope // 1050 ft

    // Case A: Along the primary surface (point is abeam the primary surface rectangle)
    const distFromPrimaryEdge = Math.max(0, relation.distanceFromCenterline - primaryHalfWidth)
    const withinPrimaryTransitional =
      distFromPrimaryEdge > 0 &&
      distFromPrimaryEdge <= maxTransitionalExtent &&
      relation.withinPrimary === false &&
      Math.abs(relation.alongTrackFromMidpoint) <= (runway.lengthFt / 2 + 200)

    // Case B: Along the approach-departure surface edges
    // The approach trapezoid expands linearly from innerHalfWidth to outerHalfWidth.
    // The transitional applies to the sides of this trapezoid up to 150 ft height,
    // which corresponds to 7,500 ft along the approach (150 * 50 = 7,500).
    const approachCutoff = 150 * ac.slope // 7,500 ft — beyond here height >= 150 ft
    const distAlongApproach = relation.distanceFromNearestPrimaryEnd
    const beyondPrimary = !relation.withinPrimary && distAlongApproach > 0
    const withinApproachCutoff = distAlongApproach <= approachCutoff

    // Width of approach trapezoid at this point's along-track distance
    const approachEdgeHalfWidth = beyondPrimary
      ? ac.innerHalfWidth +
        (distAlongApproach / ac.length) * (ac.outerHalfWidth - ac.innerHalfWidth)
      : primaryHalfWidth

    const distFromApproachEdge = beyondPrimary
      ? Math.max(0, relation.distanceFromCenterline - approachEdgeHalfWidth)
      : Infinity

    const withinApproachTransitional =
      beyondPrimary &&
      withinApproachCutoff &&
      distFromApproachEdge > 0 &&
      distFromApproachEdge <= maxTransitionalExtent

    const isWithin = withinPrimaryTransitional || withinApproachTransitional

    // Use the smaller distance from edge (more restrictive = lower allowable height)
    const distFromEdge = Math.min(
      withinPrimaryTransitional ? distFromPrimaryEdge : Infinity,
      withinApproachTransitional ? distFromApproachEdge : Infinity,
    )

    const maxHeightAboveField = isWithin ? distFromEdge / c.slope : 0
    const maxMSL = airfieldElev + maxHeightAboveField
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'transitional',
      surfaceName: UFC_SURFACE_META.transitional.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: UFC_SURFACE_META.transitional.ufcRef,
      ufcCriteria: UFC_SURFACE_META.transitional.ufcCriteria(criteria),
      color: UFC_SURFACE_META.transitional.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: isWithin
        ? `${fmt(airfieldElev)} ft (airfield elev) + ${fmt(distFromEdge)} ft / ${criteria.transitional.slope} (slope) = ${fmt(maxMSL)} ft MSL`
        : undefined,
    })
  }

  // --- 4. Inner Horizontal Surface ---
  // Excludes areas already governed by primary, approach-departure, or transitional.
  {
    const c = criteria.inner_horizontal
    const inMoreSpecificSurface = surfaces.some(
      (s) => s.isWithinBounds && (s.surfaceKey === 'primary' || s.surfaceKey === 'approach_departure' || s.surfaceKey === 'transitional'),
    )
    const isWithin = stadiumDist <= c.radius && !inMoreSpecificSurface
    const maxMSL = airfieldElev + c.height
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'inner_horizontal',
      surfaceName: UFC_SURFACE_META.inner_horizontal.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: UFC_SURFACE_META.inner_horizontal.ufcRef,
      ufcCriteria: UFC_SURFACE_META.inner_horizontal.ufcCriteria(criteria),
      color: UFC_SURFACE_META.inner_horizontal.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${c.height} ft (fixed height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 5. Conical Surface ---
  {
    const c = criteria.conical
    const innerR = criteria.inner_horizontal.radius
    const distFromInnerH = Math.max(0, stadiumDist - innerR)
    const isWithin = stadiumDist > innerR && distFromInnerH <= c.horizontalExtent
    const maxHeightAboveField = c.baseHeight + distFromInnerH / c.slope
    const maxMSL = airfieldElev + maxHeightAboveField
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'conical',
      surfaceName: UFC_SURFACE_META.conical.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: UFC_SURFACE_META.conical.ufcRef,
      ufcCriteria: UFC_SURFACE_META.conical.ufcCriteria(criteria),
      color: UFC_SURFACE_META.conical.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${c.baseHeight} ft (base) + ${fmt(distFromInnerH)} ft / ${c.slope} (slope) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 6. Outer Horizontal Surface ---
  {
    const c = criteria.outer_horizontal
    const innerR = criteria.inner_horizontal.radius
    const conicalExtent = criteria.conical.horizontalExtent
    const conicalOuterR = innerR + conicalExtent
    const isWithin = stadiumDist > conicalOuterR && stadiumDist <= c.radius
    const maxMSL = airfieldElev + c.height
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'outer_horizontal',
      surfaceName: UFC_SURFACE_META.outer_horizontal.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: UFC_SURFACE_META.outer_horizontal.ufcRef,
      ufcCriteria: UFC_SURFACE_META.outer_horizontal.ufcCriteria(criteria),
      color: UFC_SURFACE_META.outer_horizontal.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${c.height} ft (fixed height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- Clear Zone (both ends) ---
  // Listed after height-restriction surfaces so it appears at the bottom of analysis results.
  {
    const c = criteria.clear_zone
    const withinEnd1 = beyondEnd1 > 0 && beyondEnd1 <= c.length && relation.distanceFromCenterline <= c.halfWidth
    const withinEnd2 = beyondEnd2 > 0 && beyondEnd2 <= c.length && relation.distanceFromCenterline <= c.halfWidth
    const isWithin = withinEnd1 || withinEnd2
    const maxAGL = c.maxHeight // 0 ft
    const maxMSL = airfieldElev + maxAGL
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'clear_zone',
      surfaceName: UFC_SURFACE_META.clear_zone.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: UFC_SURFACE_META.clear_zone.ufcRef,
      ufcCriteria: UFC_SURFACE_META.clear_zone.ufcCriteria(criteria),
      color: UFC_SURFACE_META.clear_zone.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${maxAGL} ft (max height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- Graded Portion of Clear Zone (both ends) ---
  {
    const c = criteria.graded_area
    const withinEnd1 = beyondEnd1 > 0 && beyondEnd1 <= c.length && relation.distanceFromCenterline <= c.halfWidth
    const withinEnd2 = beyondEnd2 > 0 && beyondEnd2 <= c.length && relation.distanceFromCenterline <= c.halfWidth
    const isWithin = withinEnd1 || withinEnd2
    const maxAGL = c.maxHeight // 0 ft
    const maxMSL = airfieldElev + maxAGL
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'graded_area',
      surfaceName: UFC_SURFACE_META.graded_area.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: UFC_SURFACE_META.graded_area.ufcRef,
      ufcCriteria: UFC_SURFACE_META.graded_area.ufcCriteria(criteria),
      color: UFC_SURFACE_META.graded_area.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${maxAGL} ft (max height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- APZ I (Accident Potential Zone I) ---
  // Land-use zone, no height restriction. 3,000–8,000 ft from threshold, 3,000 ft wide.
  {
    const c = criteria.apz_i
    const withinEnd1 = beyondEnd1 > c.startOffset && beyondEnd1 <= (c.startOffset + c.length) && relation.distanceFromCenterline <= c.halfWidth
    const withinEnd2 = beyondEnd2 > c.startOffset && beyondEnd2 <= (c.startOffset + c.length) && relation.distanceFromCenterline <= c.halfWidth
    const isWithin = withinEnd1 || withinEnd2
    surfaces.push({
      surfaceKey: 'apz_i',
      surfaceName: UFC_SURFACE_META.apz_i.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: -1,
      maxAllowableHeightMSL: -1,
      obstructionTopMSL,
      violated: false,
      penetrationFt: 0,
      ufcReference: UFC_SURFACE_META.apz_i.ufcRef,
      ufcCriteria: UFC_SURFACE_META.apz_i.ufcCriteria(criteria),
      color: UFC_SURFACE_META.apz_i.color,
    })
  }

  // --- APZ II (Accident Potential Zone II) ---
  // Land-use zone, no height restriction. 8,000–15,000 ft from threshold, 3,000 ft wide.
  {
    const c = criteria.apz_ii
    const withinEnd1 = beyondEnd1 > c.startOffset && beyondEnd1 <= (c.startOffset + c.length) && relation.distanceFromCenterline <= c.halfWidth
    const withinEnd2 = beyondEnd2 > c.startOffset && beyondEnd2 <= (c.startOffset + c.length) && relation.distanceFromCenterline <= c.halfWidth
    const isWithin = withinEnd1 || withinEnd2
    surfaces.push({
      surfaceKey: 'apz_ii',
      surfaceName: UFC_SURFACE_META.apz_ii.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: -1,
      maxAllowableHeightMSL: -1,
      obstructionTopMSL,
      violated: false,
      penetrationFt: 0,
      ufcReference: UFC_SURFACE_META.apz_ii.ufcRef,
      ufcCriteria: UFC_SURFACE_META.apz_ii.ufcCriteria(criteria),
      color: UFC_SURFACE_META.apz_ii.color,
    })
  }

  // --- Aggregate results ---
  const violatedSurfaces = surfaces.filter((s) => s.violated)
  const hasViolation = violatedSurfaces.length > 0

  // Controlling surface = the one with the lowest max allowable height
  // among height-restricted surfaces the point is within.
  // Land-use zones (APZ I/II, maxAllowableHeightMSL === -1) are excluded.
  const applicableSurfaces = surfaces.filter((s) => s.isWithinBounds && s.maxAllowableHeightMSL !== -1)
  const controllingSurface = applicableSurfaces.length > 0
    ? applicableSurfaces.reduce((min, s) =>
        s.maxAllowableHeightMSL < min.maxAllowableHeightMSL ? s : min,
      )
    : null

  // --- Waiver guidance ---
  const waiverGuidance: string[] = []
  if (hasViolation) {
    waiverGuidance.push(
      'OBSTRUCTION VIOLATION DETECTED — The following actions are required:',
    )
    waiverGuidance.push(
      '1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.',
    )
    waiverGuidance.push(
      '2. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding any obstruction that may affect flying operations, approach/departure procedures, or instrument procedures.',
    )
    waiverGuidance.push(
      '3. Submit a work order to CES and coordinate with the BCE to request a Permanent or Temporary Airspace Criteria Waiver.',
    )
    for (const vs of violatedSurfaces) {
      waiverGuidance.push(
        `4. ${vs.surfaceName} violation (${vs.penetrationFt.toFixed(1)} ft penetration) — Reference: ${vs.ufcReference}`,
      )
    }
  }

  return {
    point,
    groundElevationMSL: groundElev,
    obstructionHeightAGL,
    obstructionTopMSL,
    distanceFromCenterline: relation.distanceFromCenterline,
    alongTrackFromMidpoint: relation.alongTrackFromMidpoint,
    nearerEnd: relation.nearerEnd,
    side: relation.side,
    surfaces,
    hasViolation,
    controllingSurface,
    violatedSurfaces,
    waiverGuidance,
  }
}

/**
 * Full obstruction evaluation against the 5 FAA Part 77 §77.19 imaginary surfaces.
 * Surface dimensions are determined by `approachType` (defaults to the Phase 1
 * non_utility_non_precision_low set so callers without a per-runway type pinned
 * see the same numbers as before).
 *
 * Mirrors evaluateObstruction's per-surface structure but with only the 5 Part
 * 77 surfaces (primary, approach, transitional, horizontal, conical) — no
 * outer-horizontal, clear-zone, graded-area, or APZ zones; those are UFC-only.
 *
 * The geometry helper used to hardcode UFC's 1,000-ft primary
 * halfWidth, which forced this evaluator to recompute `withinPrimary`
 * locally. After geometry.ts grew the `opts.primaryHalfWidth` knob,
 * the per-approach-type half-width is passed straight through to
 * `pointToRunwayRelation` and `relation.withinPrimary` is the truth.
 */
export function evaluateObstructionPart77(
  point: LatLon,
  obstructionHeightAGL: number,
  groundElevationMSL: number | null,
  rwy: RunwayGeometry,
  airfieldElevMSL = 580,
  approachType: FaaApproachType = 'non_utility_non_precision_low',
): ObstructionAnalysis {
  const runway = rwy
  const airfieldElev = airfieldElevMSL
  const surfacesMeta = getPart77Surfaces(approachType)
  const groundElev = groundElevationMSL ?? airfieldElev
  const obstructionTopMSL = groundElev + obstructionHeightAGL

  const relation = pointToRunwayRelation(point, runway, {
    primaryHalfWidth: surfacesMeta.primary.criteria.halfWidth,
  })
  const stadiumDist = distanceFromStadiumCenter(point, runway)

  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })
  const airfieldBaselineLabel = 'Airport elevation'

  const surfaces: SurfaceEvaluation[] = []
  const halfLength = runway.lengthFt / 2

  // Per-approach-type primary dimensions; used by the transitional-
  // surface block below to compute "alongside primary" extent.
  const primaryHW = surfacesMeta.primary.criteria.halfWidth
  const primaryExt = surfacesMeta.primary.criteria.extension

  // relation.withinPrimary now reflects Part 77's narrower half-width.
  const withinPrimary = relation.withinPrimary

  // --- 1. Primary Surface ---
  {
    const c = surfacesMeta.primary.criteria
    const maxAGL = c.maxHeight
    const maxMSL = airfieldElev + maxAGL
    const violated = withinPrimary && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'primary',
      surfaceName: surfacesMeta.primary.name,
      isWithinBounds: withinPrimary,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: surfacesMeta.primary.ufcRef,
      ufcCriteria: surfacesMeta.primary.ufcCriteria,
      color: surfacesMeta.primary.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airport elev) + ${maxAGL} ft = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 2. Approach Surface ---
  // Precision approach has a 2nd slope segment (50:1 first 10kft + 40:1 next 40kft)
  // encoded via secondSegmentSlope + segmentLength on the criteria.
  {
    const c = surfacesMeta.approach.criteria
    const distAlongApproach = relation.distanceFromNearestPrimaryEnd
    const beyondPrimary = !withinPrimary && distAlongApproach > 0
    const withinLength = distAlongApproach <= c.length

    const widthAtDistance =
      c.innerHalfWidth +
      (distAlongApproach / c.length) * (c.outerHalfWidth - c.innerHalfWidth)
    const withinWidth = relation.distanceFromCenterline <= widthAtDistance
    const isWithin = beyondPrimary && withinLength && withinWidth

    // Threshold elevation baseline (matches UFC pattern)
    const primaryEndInfo = distanceFromNearestPrimaryEndCenter(point, runway)
    const thresholdElev = primaryEndInfo.end === 'end1'
      ? (runway.end1ElevationMSL ?? airfieldElev)
      : (runway.end2ElevationMSL ?? airfieldElev)
    const nearerDesignator = primaryEndInfo.end === 'end1'
      ? runway.end1Designator
      : runway.end2Designator
    const usedThreshold = primaryEndInfo.end === 'end1'
      ? runway.end1ElevationMSL !== undefined
      : runway.end2ElevationMSL !== undefined
    const thresholdLabel = nearerDesignator
      ? `RWY ${nearerDesignator} threshold`
      : usedThreshold
        ? `Nearest threshold (${primaryEndInfo.end})`
        : 'Airport elevation (threshold not set)'

    // Two-segment slope for precision approach
    let maxHeightAboveThreshold: number
    let slopeBreakdown: string
    const seg2Slope = c.secondSegmentSlope
    const seg1Length = c.segmentLength
    if (seg2Slope !== undefined && seg1Length !== undefined && distAlongApproach > seg1Length) {
      const firstSeg = seg1Length / c.slope
      const secondSeg = (distAlongApproach - seg1Length) / seg2Slope
      maxHeightAboveThreshold = firstSeg + secondSeg
      slopeBreakdown = `${seg1Length}/${c.slope} (1st segment) + ${fmt(distAlongApproach - seg1Length)}/${seg2Slope} (2nd segment) = ${fmt(maxHeightAboveThreshold)} ft`
    } else {
      maxHeightAboveThreshold = distAlongApproach / c.slope
      slopeBreakdown = `${fmt(distAlongApproach)} ft / ${c.slope} (slope) = ${fmt(maxHeightAboveThreshold)} ft`
    }

    // Parallel to the UFC ADCS cap: level off at EAE + horizontalElevation when
    // present. FAA Part 77 §77.19 approach surfaces have NO horizontal portion
    // (the criteria carry no horizontalElevation), so the guard is a runtime
    // no-op here — the surface slopes all the way to its length.
    const slopedMSL = thresholdElev + maxHeightAboveThreshold
    const horizontalElev = c.horizontalElevation
    const capMSL = horizontalElev != null ? airfieldElev + horizontalElev : null
    const maxMSL = capMSL != null ? Math.min(slopedMSL, capMSL) : slopedMSL
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'approach',
      surfaceName: surfacesMeta.approach.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: surfacesMeta.approach.ufcRef,
      ufcCriteria: surfacesMeta.approach.ufcCriteria,
      color: surfacesMeta.approach.color,
      baselineElevation: thresholdElev,
      baselineLabel: thresholdLabel,
      calculationBreakdown: `${fmt(thresholdElev)} ft (${thresholdLabel}) + ${slopeBreakdown} = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 3. Transitional Surface ---
  // Mirrors the UFC transitional logic but bounded against Part 77
  // primary + approach dimensions.
  {
    const tc = surfacesMeta.transitional.criteria
    const ac = surfacesMeta.approach.criteria
    const maxTransitionalExtent = 150 * tc.slope // 1,050 ft

    // Case A: alongside primary surface
    const distFromPrimaryEdge = Math.max(0, relation.distanceFromCenterline - primaryHW)
    const withinPrimaryTransitional =
      distFromPrimaryEdge > 0 &&
      distFromPrimaryEdge <= maxTransitionalExtent &&
      !withinPrimary &&
      Math.abs(relation.alongTrackFromMidpoint) <= halfLength + primaryExt

    // Case B: alongside approach trapezoid (up to where the approach surface reaches 150 ft)
    const approachCutoff = 150 * ac.slope
    const distAlongApproach = relation.distanceFromNearestPrimaryEnd
    const beyondPrimary = !withinPrimary && distAlongApproach > 0
    const withinApproachCutoff = distAlongApproach <= approachCutoff

    const approachEdgeHalfWidth = beyondPrimary
      ? ac.innerHalfWidth +
        (distAlongApproach / ac.length) * (ac.outerHalfWidth - ac.innerHalfWidth)
      : primaryHW
    const distFromApproachEdge = beyondPrimary
      ? Math.max(0, relation.distanceFromCenterline - approachEdgeHalfWidth)
      : Infinity
    const withinApproachTransitional =
      beyondPrimary &&
      withinApproachCutoff &&
      distFromApproachEdge > 0 &&
      distFromApproachEdge <= maxTransitionalExtent

    const isWithin = withinPrimaryTransitional || withinApproachTransitional
    const distFromEdge = Math.min(
      withinPrimaryTransitional ? distFromPrimaryEdge : Infinity,
      withinApproachTransitional ? distFromApproachEdge : Infinity,
    )

    const maxHeightAboveField = isWithin ? distFromEdge / tc.slope : 0
    const maxMSL = airfieldElev + maxHeightAboveField
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'transitional',
      surfaceName: surfacesMeta.transitional.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: surfacesMeta.transitional.ufcRef,
      ufcCriteria: surfacesMeta.transitional.ufcCriteria,
      color: surfacesMeta.transitional.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: isWithin
        ? `${fmt(airfieldElev)} ft (airport elev) + ${fmt(distFromEdge)} ft / ${tc.slope} (slope) = ${fmt(maxMSL)} ft MSL`
        : undefined,
    })
  }

  // --- 4. Horizontal Surface ---
  // Excludes areas already governed by primary, approach, or transitional.
  {
    const hc = surfacesMeta.horizontal.criteria
    const inMoreSpecific = surfaces.some(
      (s) => s.isWithinBounds && (s.surfaceKey === 'primary' || s.surfaceKey === 'approach' || s.surfaceKey === 'transitional'),
    )
    const isWithin = stadiumDist <= hc.radius && !inMoreSpecific
    const maxMSL = airfieldElev + hc.height
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'horizontal',
      surfaceName: surfacesMeta.horizontal.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: surfacesMeta.horizontal.ufcRef,
      ufcCriteria: surfacesMeta.horizontal.ufcCriteria,
      color: surfacesMeta.horizontal.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airport elev) + ${hc.height} ft = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 5. Conical Surface ---
  {
    const cc = surfacesMeta.conical.criteria
    const innerR = surfacesMeta.horizontal.criteria.radius
    const distFromHoriz = Math.max(0, stadiumDist - innerR)
    const isWithin = stadiumDist > innerR && distFromHoriz <= cc.horizontalExtent
    const maxHeightAboveField = cc.baseHeight + distFromHoriz / cc.slope
    const maxMSL = airfieldElev + maxHeightAboveField
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'conical',
      surfaceName: surfacesMeta.conical.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: surfacesMeta.conical.ufcRef,
      ufcCriteria: surfacesMeta.conical.ufcCriteria,
      color: surfacesMeta.conical.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airport elev) + ${cc.baseHeight} ft + ${fmt(distFromHoriz)} ft / ${cc.slope} (slope) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- Aggregate ---
  const violatedSurfaces = surfaces.filter((s) => s.violated)
  const hasViolation = violatedSurfaces.length > 0
  const applicable = surfaces.filter((s) => s.isWithinBounds && s.maxAllowableHeightMSL !== -1)
  const controllingSurface = applicable.length > 0
    ? applicable.reduce((min, s) => s.maxAllowableHeightMSL < min.maxAllowableHeightMSL ? s : min)
    : null

  const waiverGuidance: string[] = []
  if (hasViolation) {
    waiverGuidance.push('PART 77 OBSTRUCTION DETECTED — Required actions:')
    waiverGuidance.push('1. File FAA Form 7460-1 "Notice of Proposed Construction or Alteration" per 14 CFR Part 77.')
    waiverGuidance.push('2. Coordinate with the FAA Regional Office for an aeronautical study to determine if the obstruction is a hazard to air navigation.')
    waiverGuidance.push('3. Update airport NOTAM and AEP coordination as appropriate; flag the discrepancy in the SMS hazard register if it affects ongoing operations.')
    for (const vs of violatedSurfaces) {
      waiverGuidance.push(`4. ${vs.surfaceName} penetration ${vs.penetrationFt.toFixed(1)} ft — ${vs.ufcReference}`)
    }
  }

  return {
    point,
    groundElevationMSL: groundElev,
    obstructionHeightAGL,
    obstructionTopMSL,
    distanceFromCenterline: relation.distanceFromCenterline,
    alongTrackFromMidpoint: relation.alongTrackFromMidpoint,
    nearerEnd: relation.nearerEnd,
    side: relation.side,
    surfaces,
    hasViolation,
    controllingSurface,
    violatedSurfaces,
    waiverGuidance,
  }
}

/**
 * Per-runway input shape — includes optional Part 77 approach type so
 * each runway can drive its own surface dimensions. Class III/IV airports
 * commonly mix visual GA runways with non-precision commercial runways.
 */
export type RunwayEvalInput = {
  label: string
  geometry: RunwayGeometry
  approachType?: FaaApproachType | null
}

/**
 * Evaluate an obstruction against ALL runways at an airfield.
 * Returns per-runway results plus a merged summary with the most restrictive
 * controlling surface across all runways. Dispatches to the UFC or Part 77
 * evaluator based on `surfaceSet`; per-runway `approachType` drives Part 77
 * surface selection (defaults to `non_utility_non_precision_low`).
 */
export function evaluateObstructionAllRunways(
  point: LatLon,
  obstructionHeightAGL: number,
  groundElevationMSL: number | null,
  runwayGeometries: RunwayEvalInput[],
  airfieldElevMSL = 580,
  runwayClass = 'B',
  surfaceSet: SurfaceSet = 'ufc_3_260_01',
): MultiRunwayAnalysis {
  const perRunway = runwayGeometries.map(({ label, geometry, approachType }) => {
    const analysis = surfaceSet === 'faa_part77'
      ? evaluateObstructionPart77(
          point,
          obstructionHeightAGL,
          groundElevationMSL,
          geometry,
          airfieldElevMSL,
          approachType ?? 'non_utility_non_precision_low',
        )
      : evaluateObstruction(
          point,
          obstructionHeightAGL,
          groundElevationMSL,
          geometry,
          airfieldElevMSL,
          runwayClass,
        )
    // Tag each surface evaluation with the runway label
    for (const s of analysis.surfaces) {
      s.runwayLabel = label
    }
    analysis.runwayLabel = label
    return { runwayLabel: label, analysis }
  })

  const groundElev = groundElevationMSL ?? airfieldElevMSL
  const obstructionTopMSL = groundElev + obstructionHeightAGL

  // Merge: any violation across any runway
  const hasViolation = perRunway.some((r) => r.analysis.hasViolation)

  // Collect all violated surfaces across all runways
  const violatedSurfaces = perRunway.flatMap((r) => r.analysis.violatedSurfaces)

  // Controlling surface = the most restrictive (lowest max allowable height)
  // across all runways
  const allApplicable = perRunway.flatMap((r) =>
    r.analysis.surfaces.filter((s) => s.isWithinBounds && s.maxAllowableHeightMSL !== -1),
  )
  const controllingSurface = allApplicable.length > 0
    ? allApplicable.reduce((min, s) =>
        s.maxAllowableHeightMSL < min.maxAllowableHeightMSL ? s : min,
      )
    : null

  // Merge waiver guidance
  const waiverGuidance: string[] = []
  if (hasViolation) {
    waiverGuidance.push(
      'OBSTRUCTION VIOLATION DETECTED — The following actions are required:',
    )
    waiverGuidance.push(
      '1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.',
    )
    waiverGuidance.push(
      '2. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding any obstruction that may affect flying operations, approach/departure procedures, or instrument procedures.',
    )
    waiverGuidance.push(
      '3. Submit a work order to CES and coordinate with the BCE to request a Permanent or Temporary Airspace Criteria Waiver.',
    )
    for (const vs of violatedSurfaces) {
      waiverGuidance.push(
        `4. ${vs.surfaceName} violation on RWY ${vs.runwayLabel} (${vs.penetrationFt.toFixed(1)} ft penetration) — Reference: ${vs.ufcReference}`,
      )
    }
  }

  return {
    perRunway,
    point,
    groundElevationMSL: groundElev,
    obstructionHeightAGL,
    obstructionTopMSL,
    hasViolation,
    controllingSurface,
    violatedSurfaces,
    waiverGuidance,
  }
}

/**
 * Quick surface identification — which surface zone does this point fall in?
 * Returns the name of the controlling (most restrictive) surface.
 * Supports single or multiple runways. Dispatches to the UFC or Part 77
 * evaluator based on `surfaceSet`; per-runway `approachType` (only carried by
 * the `RunwayEvalInput[]` form) drives Part 77 surface selection, defaulting
 * to `non_utility_non_precision_low` when absent — same default as
 * `evaluateObstructionAllRunways`.
 */
export function identifySurface(
  point: LatLon,
  rwy: RunwayGeometry | RunwayGeometry[] | RunwayEvalInput[],
  airfieldElevMSL = 580,
  runwayClass = 'B',
  surfaceSet: SurfaceSet = 'ufc_3_260_01',
): string {
  const rwyArray = Array.isArray(rwy) ? rwy : [rwy]
  const runways: RunwayEvalInput[] = rwyArray.map((r) =>
    'geometry' in r ? r : { label: '', geometry: r },
  )
  // Evaluate against each runway, find the most restrictive surface
  let bestSurface: SurfaceEvaluation | null = null
  let bestLandUse: SurfaceEvaluation | null = null

  for (const { geometry, approachType } of runways) {
    const analysis = surfaceSet === 'faa_part77'
      ? evaluateObstructionPart77(
          point, 0, null, geometry, airfieldElevMSL,
          approachType ?? 'non_utility_non_precision_low',
        )
      : evaluateObstruction(point, 0, null, geometry, airfieldElevMSL, runwayClass)
    if (analysis.controllingSurface) {
      if (!bestSurface || analysis.controllingSurface.maxAllowableHeightMSL < bestSurface.maxAllowableHeightMSL) {
        bestSurface = analysis.controllingSurface
      }
    }
    if (!bestLandUse) {
      const landUseZone = analysis.surfaces.find((s) => s.isWithinBounds && s.maxAllowableHeightMSL === -1)
      if (landUseZone) bestLandUse = landUseZone
    }
  }

  if (bestSurface) return bestSurface.surfaceName
  if (bestLandUse) return bestLandUse.surfaceName
  return 'Outside all surfaces'
}

// ---------------------------------------------------------------------------
// Taxiway surface evaluation (UFC 3-260-01, Table 3-1)
// ---------------------------------------------------------------------------

export type TaxiwayGeometry = {
  id: string
  designator: string
  taxiwayType: 'taxiway' | 'taxilane'
  tdg: number | null
  centerline: LatLon[]
  standard: 'faa' | 'ufc'
  runwayClass?: RunwayClass | null
  serviceBranch?: ServiceBranch | null
}

export type TaxiwaySurfaceEvaluation = {
  taxiwayId: string
  taxiwayDesignator: string
  distanceFromCenterlineFt: number
  surfaceKey: 'taxiway_ofa' | 'taxiway_safety_area'
  surfaceName: string
  isWithinBounds: boolean
  violated: boolean
  ufcReference: string
  ufcCriteria: string
  color: string
  halfWidthFt: number
}

/**
 * Evaluate an obstruction against all taxiway surfaces.
 * FAA standard: evaluates OFA and Safety Area per AC 150/5300-13A.
 * UFC standard: evaluates Taxiway Clearance Line per UFC 3-260-01, Table 5-1, Item 10.
 */
export function evaluateObstructionTaxiways(
  point: LatLon,
  taxiways: TaxiwayGeometry[],
): TaxiwaySurfaceEvaluation[] {
  const results: TaxiwaySurfaceEvaluation[] = []

  for (const tw of taxiways) {
    if (tw.centerline.length < 2) continue

    const dist = pointToPolylineDistanceFt(point, tw.centerline)

    if (tw.standard === 'ufc') {
      // UFC 3-260-01, Table 5-1, Item 10 — Taxiway Clearance Line
      const rc = tw.runwayClass || 'A'
      const sb = tw.serviceBranch || 'air_force'
      const ufcCrit = getUfcCriteria(rc, sb)
      const clearanceHalf = ufcCrit.clearanceLineFt

      const inClearance = dist <= clearanceHalf
      results.push({
        taxiwayId: tw.id,
        taxiwayDesignator: tw.designator,
        distanceFromCenterlineFt: Math.round(dist),
        surfaceKey: 'taxiway_ofa', // reuse key for display compatibility
        surfaceName: `TWY ${tw.designator} Clearance Line`,
        isWithinBounds: inClearance,
        violated: inClearance,
        ufcReference: TAXIWAY_SURFACES.taxiway_clearance_line.ufcRef,
        ufcCriteria: TAXIWAY_SURFACES.taxiway_clearance_line.ufcCriteria
          .replace('{clearanceFt}', String(clearanceHalf))
          .replace('{classLabel}', ufcCrit.label),
        color: TAXIWAY_SURFACES.taxiway_clearance_line.color,
        halfWidthFt: clearanceHalf,
      })
    } else {
      // FAA AC 150/5300-13A — OFA + Safety Area
      const tdg = tw.tdg ?? 3
      const ofaHalf = getOFAHalfWidth(tdg, tw.taxiwayType)
      const safetyHalf = getSafetyAreaHalfWidth(tdg)

      const inOFA = dist <= ofaHalf
      results.push({
        taxiwayId: tw.id,
        taxiwayDesignator: tw.designator,
        distanceFromCenterlineFt: Math.round(dist),
        surfaceKey: 'taxiway_ofa',
        surfaceName: `TWY ${tw.designator} Object Free Area`,
        isWithinBounds: inOFA,
        violated: inOFA,
        ufcReference: TAXIWAY_SURFACES.taxiway_ofa.ufcRef,
        ufcCriteria: TAXIWAY_SURFACES.taxiway_ofa.ufcCriteria
          .replace('{ofaWidth}', String(ofaHalf * 2))
          .replace('{tdg}', String(tdg)),
        color: TAXIWAY_SURFACES.taxiway_ofa.color,
        halfWidthFt: ofaHalf,
      })

      const inSafety = dist <= safetyHalf
      results.push({
        taxiwayId: tw.id,
        taxiwayDesignator: tw.designator,
        distanceFromCenterlineFt: Math.round(dist),
        surfaceKey: 'taxiway_safety_area',
        surfaceName: `TWY ${tw.designator} Safety Area`,
        isWithinBounds: inSafety,
        violated: inSafety,
        ufcReference: TAXIWAY_SURFACES.taxiway_safety_area.ufcRef,
        ufcCriteria: TAXIWAY_SURFACES.taxiway_safety_area.ufcCriteria
          .replace('{safetyWidth}', String(safetyHalf * 2))
          .replace('{tdg}', String(tdg)),
        color: TAXIWAY_SURFACES.taxiway_safety_area.color,
        halfWidthFt: safetyHalf,
      })
    }
  }

  return results
}
