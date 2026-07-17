import { describe, it, expect } from 'vitest'
import {
  SURFACE_STANDARD_OPTIONS,
  SURFACE_STANDARD_IDS,
  SURFACE_SET_LABELS,
  SURFACE_SET_REGISTRY,
  resolveStandard,
  resolveStandardLabel,
  deriveRunwayClassFromRunways,
  buildUfcSurfacePolygons,
} from '@/lib/calculations/surface-standards'
import {
  getRunwayGeometry,
  distanceFt,
  type LatLon,
} from '@/lib/calculations/geometry'
import { IMAGINARY_SURFACES, getPart77Surfaces, ANNEX14_SURFACE_META } from '@/lib/calculations/obstructions'

// ─────────────────────────────────────────────────────────────
// SSE Task 5 — surface-standards registry
//
// Synthetic east-west runway centered at lat=0/lon=0, 10,000 ft long,
// heading 090° — mirrors tests/ufc-surface-geometry.test.ts.
// ─────────────────────────────────────────────────────────────

const LON_FT_PER_DEG = 364567
const RUNWAY_LENGTH_FT = 10000
const RUNWAY_HALF_LEN_FT = RUNWAY_LENGTH_FT / 2

function lonOffset(ft: number): number { return ft / LON_FT_PER_DEG }

const RWY = getRunwayGeometry({
  end1: { latitude: 0, longitude: -lonOffset(RUNWAY_HALF_LEN_FT) },
  end2: { latitude: 0, longitude: lonOffset(RUNWAY_HALF_LEN_FT) },
  length_ft: RUNWAY_LENGTH_FT,
  width_ft: 150,
  true_heading: 90,
})

function toLatLon(v: [number, number]): LatLon {
  return { lon: v[0], lat: v[1] }
}

/** Inner/outer half-width + length of an approach-departure trapezoid ring. */
function trapezoidDims(ring: [number, number][]) {
  const p1 = toLatLon(ring[0])
  const p2 = toLatLon(ring[1])
  const p3 = toLatLon(ring[2])
  const p4 = toLatLon(ring[3])
  return {
    innerHalfWidth: distanceFt(p1, p2) / 2,
    outerHalfWidth: distanceFt(p3, p4) / 2,
  }
}

// ── 1. SURFACE_STANDARD_OPTIONS locks all four tuples ────────────────────────

describe('SURFACE_STANDARD_OPTIONS', () => {
  it('locks the five (set, runwayClass, label, citation) tuples', () => {
    expect(SURFACE_STANDARD_OPTIONS).toEqual({
      af_class_a:   { set: 'ufc_3_260_01', runwayClass: 'A',      label: 'Air Force Class A', citation: 'UFC 3-260-01 Table 3-7' },
      af_class_b:   { set: 'ufc_3_260_01', runwayClass: 'B',      label: 'Air Force Class B', citation: 'UFC 3-260-01 Table 3-7' },
      army_class_b: { set: 'ufc_3_260_01', runwayClass: 'Army_B', label: 'Army Class B',      citation: 'UFC 3-260-01 Table 3-7' },
      icao_annex14: { set: 'icao_annex14', runwayClass: null,     label: 'ICAO Annex 14',     citation: 'ICAO Annex 14 Vol I Table 4-1' },
      faa_part77:   { set: 'faa_part77',   runwayClass: null,     label: 'FAA Part 77',       citation: '14 CFR §77.19' },
    })
  })

  it('SURFACE_STANDARD_IDS is the stable display order', () => {
    expect(SURFACE_STANDARD_IDS).toEqual(['af_class_a', 'af_class_b', 'army_class_b', 'icao_annex14', 'faa_part77'])
  })

  it('SURFACE_SET_LABELS locks all three engine-set labels', () => {
    expect(SURFACE_SET_LABELS).toEqual({
      ufc_3_260_01: 'UFC 3-260-01',
      faa_part77: 'FAA Part 77 (14 CFR §77.19)',
      icao_annex14: 'ICAO Annex 14 (Vol I, 7th Ed.)',
    })
  })
})

// ── 2. resolveStandard ───────────────────────────────────────────────────────

describe('resolveStandard', () => {
  it('ufc + [B, B] → af_class_b', () => {
    expect(resolveStandard('ufc_3_260_01', ['B', 'B'])).toBe('af_class_b')
  })
  it('ufc + [A] → af_class_a', () => {
    expect(resolveStandard('ufc_3_260_01', ['A'])).toBe('af_class_a')
  })
  it('ufc + [Army_B] → army_class_b', () => {
    expect(resolveStandard('ufc_3_260_01', ['Army_B'])).toBe('army_class_b')
  })
  it('ufc + [A, B] → mixed', () => {
    expect(resolveStandard('ufc_3_260_01', ['A', 'B'])).toBe('mixed')
  })
  it('ufc + [null, B] → af_class_b (NULL→B rule)', () => {
    expect(resolveStandard('ufc_3_260_01', [null, 'B'])).toBe('af_class_b')
  })
  it('ufc + [] → af_class_b (empty UFC default)', () => {
    expect(resolveStandard('ufc_3_260_01', [])).toBe('af_class_b')
  })
  it('faa_part77 + anything → faa_part77', () => {
    expect(resolveStandard('faa_part77', ['A', 'B', null, 'Army_B'])).toBe('faa_part77')
    expect(resolveStandard('faa_part77', [])).toBe('faa_part77')
  })
  it('icao_annex14 + anything → icao_annex14', () => {
    expect(resolveStandard('icao_annex14', ['A', 'B', null])).toBe('icao_annex14')
    expect(resolveStandard('icao_annex14', [])).toBe('icao_annex14')
  })
})

// ── 3. resolveStandardLabel ──────────────────────────────────────────────────

describe('resolveStandardLabel', () => {
  it('UFC class labels', () => {
    expect(resolveStandardLabel('ufc_3_260_01', 'A')).toBe('UFC 3-260-01 — Air Force Class A')
    expect(resolveStandardLabel('ufc_3_260_01', 'B')).toBe('UFC 3-260-01 — Air Force Class B')
    expect(resolveStandardLabel('ufc_3_260_01', 'Army_B')).toBe('UFC 3-260-01 — Army Class B')
  })
  it('NULL class → Class B label', () => {
    expect(resolveStandardLabel('ufc_3_260_01', null)).toBe('UFC 3-260-01 — Air Force Class B')
    expect(resolveStandardLabel('ufc_3_260_01', undefined)).toBe('UFC 3-260-01 — Air Force Class B')
  })
  it('Part 77 label', () => {
    expect(resolveStandardLabel('faa_part77', null)).toBe('FAA Part 77 (14 CFR §77.19)')
    expect(resolveStandardLabel('faa_part77', 'B')).toBe('FAA Part 77 (14 CFR §77.19)')
  })
  it('ICAO Annex 14 label (no class suffix)', () => {
    expect(resolveStandardLabel('icao_annex14', null)).toBe('ICAO Annex 14 (Vol I, 7th Ed.)')
    expect(resolveStandardLabel('icao_annex14', 'B')).toBe('ICAO Annex 14 (Vol I, 7th Ed.)')
  })
})

// ── 3b. deriveRunwayClassFromRunways ─────────────────────────────────────────
// SSE Task 6 — the pure helper that replaces the :94 collapse bug (a stored
// 'A' silently degrading to 'B'). First runway's class wins; NULL/unknown
// and empty lists fall back to Class B.

describe('deriveRunwayClassFromRunways', () => {
  it('honors a stored Class A (the collapse-bug regression)', () => {
    expect(deriveRunwayClassFromRunways(['A'])).toBe('A')
    expect(deriveRunwayClassFromRunways(['A', 'A'])).toBe('A')
  })
  it('honors a stored Army_B', () => {
    expect(deriveRunwayClassFromRunways(['Army_B'])).toBe('Army_B')
  })
  it('NULL/undefined → B', () => {
    expect(deriveRunwayClassFromRunways([null])).toBe('B')
    expect(deriveRunwayClassFromRunways([undefined])).toBe('B')
  })
  it('unrecognized value → B', () => {
    expect(deriveRunwayClassFromRunways(['bogus'])).toBe('B')
  })
  it('mixed classes → first runway wins', () => {
    expect(deriveRunwayClassFromRunways(['A', 'B'])).toBe('A')
    expect(deriveRunwayClassFromRunways(['Army_B', 'A'])).toBe('Army_B')
    expect(deriveRunwayClassFromRunways([null, 'A'])).toBe('B')
  })
  it('empty list → B', () => {
    expect(deriveRunwayClassFromRunways([])).toBe('B')
  })
})

// ── 4. Registry legend/layer constants locked to pre-move values ─────────────

describe('SURFACE_SET_REGISTRY', () => {
  it('holds all three engine sets', () => {
    expect(Object.keys(SURFACE_SET_REGISTRY).sort()).toEqual(['faa_part77', 'icao_annex14', 'ufc_3_260_01'])
  })

  it('UFC legendItems match the pre-move LEGEND_ITEMS verbatim', () => {
    expect(SURFACE_SET_REGISTRY.ufc_3_260_01.legendItems).toEqual([
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
    ])
  })

  it('UFC surfaceLayers match the pre-move SURFACE_LAYERS verbatim (incl. runway outline last)', () => {
    expect(SURFACE_SET_REGISTRY.ufc_3_260_01.surfaceLayers).toEqual([
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
      { id: 'runway', color: '#FFFFFF', opacity: 0.5 },
    ])
  })

  it('Part 77 legendItems match the pre-move PART77_LEGEND_ITEMS verbatim', () => {
    const p77 = getPart77Surfaces()
    expect(SURFACE_SET_REGISTRY.faa_part77.legendItems).toEqual([
      { label: 'Conical', color: p77.conical.color, toggleKey: 'p77-conical', defaultOn: true },
      { label: 'Horizontal', color: p77.horizontal.color, toggleKey: 'p77-horizontal', defaultOn: true },
      { label: 'Transitional', color: p77.transitional.color, toggleKey: 'p77-transitional', defaultOn: true },
      { label: 'Approach', color: p77.approach.color, toggleKey: 'p77-approach', defaultOn: true },
      { label: 'Primary', color: p77.primary.color, toggleKey: 'p77-primary', defaultOn: true },
    ])
  })

  it('Part 77 surfaceLayers match the pre-move PART77_SURFACE_LAYERS verbatim (incl. runway outline last)', () => {
    const p77 = getPart77Surfaces()
    expect(SURFACE_SET_REGISTRY.faa_part77.surfaceLayers).toEqual([
      { id: 'p77-conical', color: p77.conical.color, opacity: 0.08 },
      { id: 'p77-horizontal', color: p77.horizontal.color, opacity: 0.1 },
      { id: 'p77-transitional-left', color: p77.transitional.color, opacity: 0.15 },
      { id: 'p77-transitional-right', color: p77.transitional.color, opacity: 0.15 },
      { id: 'p77-approach-end1', color: p77.approach.color, opacity: 0.14 },
      { id: 'p77-approach-end2', color: p77.approach.color, opacity: 0.14 },
      { id: 'p77-segment-break-end1', color: p77.approach.color, opacity: 0.32 },
      { id: 'p77-segment-break-end2', color: p77.approach.color, opacity: 0.32 },
      { id: 'p77-primary', color: p77.primary.color, opacity: 0.18 },
      { id: 'runway', color: '#FFFFFF', opacity: 0.5 },
    ])
  })

  it('ICAO Annex 14 legendItems lock the five phase-1 surfaces', () => {
    expect(SURFACE_SET_REGISTRY.icao_annex14.legendItems).toEqual([
      { label: 'Conical', color: ANNEX14_SURFACE_META.conical.color, toggleKey: 'a14-conical', defaultOn: true },
      { label: 'Inner Horizontal', color: ANNEX14_SURFACE_META.inner_horizontal.color, toggleKey: 'a14-inner-horizontal', defaultOn: true },
      { label: 'Transitional', color: ANNEX14_SURFACE_META.transitional.color, toggleKey: 'a14-transitional', defaultOn: true },
      { label: 'Approach', color: ANNEX14_SURFACE_META.approach.color, toggleKey: 'a14-approach', defaultOn: true },
      { label: 'Take-Off Climb', color: ANNEX14_SURFACE_META.takeoff_climb.color, toggleKey: 'a14-takeoff-climb', defaultOn: true },
    ])
  })

  it('ICAO Annex 14 surfaceLayers lock the a14-* ids + runway outline last', () => {
    expect(SURFACE_SET_REGISTRY.icao_annex14.surfaceLayers).toEqual([
      { id: 'a14-conical', color: ANNEX14_SURFACE_META.conical.color, opacity: 0.08 },
      { id: 'a14-inner-horizontal', color: ANNEX14_SURFACE_META.inner_horizontal.color, opacity: 0.1 },
      { id: 'a14-transitional-left', color: ANNEX14_SURFACE_META.transitional.color, opacity: 0.15 },
      { id: 'a14-transitional-right', color: ANNEX14_SURFACE_META.transitional.color, opacity: 0.15 },
      { id: 'a14-approach-end1', color: ANNEX14_SURFACE_META.approach.color, opacity: 0.14 },
      { id: 'a14-approach-end2', color: ANNEX14_SURFACE_META.approach.color, opacity: 0.14 },
      { id: 'a14-takeoff-climb-end1', color: ANNEX14_SURFACE_META.takeoff_climb.color, opacity: 0.12 },
      { id: 'a14-takeoff-climb-end2', color: ANNEX14_SURFACE_META.takeoff_climb.color, opacity: 0.12 },
      { id: 'runway', color: '#FFFFFF', opacity: 0.5 },
    ])
  })

  it('ICAO Annex 14 buildPolygons emits the a14-* features + a shared runway outline', () => {
    const feats = SURFACE_SET_REGISTRY.icao_annex14.buildPolygons([{ geometry: RWY }])
    expect([...new Set(feats.map((f) => f.id))].sort()).toEqual([
      'a14-approach-end1',
      'a14-approach-end2',
      'a14-conical',
      'a14-inner-horizontal',
      'a14-takeoff-climb-end1',
      'a14-takeoff-climb-end2',
      'a14-transitional-left',
      'a14-transitional-right',
      'runway',
    ])
  })

  it('ICAO Annex 14 buildPolygons threads the per-runway variant (classification / code) into the geometry', () => {
    // Non-instrument code 1 (60 m inner edge, 1 600 m first section) vs the
    // default non-precision code 4 (300 m inner edge, 15 000 m total) produce
    // materially different approach footprints — proving the registry passes
    // the variant through rather than always drawing the default.
    const ni1 = SURFACE_SET_REGISTRY.icao_annex14.buildPolygons([
      { geometry: RWY, classification: 'non_instrument', codeNumber: 1 },
    ])
    const defaultVariant = SURFACE_SET_REGISTRY.icao_annex14.buildPolygons([{ geometry: RWY }])
    const ni1Approach = ni1.find((f) => f.id === 'a14-approach-end1')!.coords
    const defApproach = defaultVariant.find((f) => f.id === 'a14-approach-end1')!.coords
    expect(ni1Approach).not.toEqual(defApproach)
  })

  it('ICAO Annex 14 buildPolygons: NULL strip width draws the transitional from the runway edge; a value moves the lower edge', () => {
    const noStrip = SURFACE_SET_REGISTRY.icao_annex14.buildPolygons([{ geometry: RWY }])
    const withStrip = SURFACE_SET_REGISTRY.icao_annex14.buildPolygons([
      { geometry: RWY, stripWidthM: 300 },
    ])
    const noStripLeft = noStrip.find((f) => f.id === 'a14-transitional-left')!.coords
    const withStripLeft = withStrip.find((f) => f.id === 'a14-transitional-left')!.coords
    expect(withStripLeft).not.toEqual(noStripLeft)
  })
})

// ── 5. buildUfcSurfacePolygons ───────────────────────────────────────────────

const UFC_FEATURE_IDS_ONE_RUNWAY = [
  'outer-horizontal',
  'conical',
  'inner-horizontal',
  'transitional-left',
  'transitional-right',
  'approach-end1',
  'approach-end2',
  'apz-i-end1',
  'apz-i-end2',
  'apz-ii-end1',
  'apz-ii-end2',
  'clear-zone-end1',
  'clear-zone-end2',
  'primary-surface',
  'graded-area-end1',
  'graded-area-end2',
  'runway',
]

describe('buildUfcSurfacePolygons', () => {
  it('emits the locked feature-id list for a single runway (Class B)', () => {
    const features = buildUfcSurfacePolygons([RWY], 'B')
    expect(features.map(f => f.id)).toEqual(UFC_FEATURE_IDS_ONE_RUNWAY)
  })

  it('default class arg equals explicit Class B (pixel-identical builder)', () => {
    expect(buildUfcSurfacePolygons([RWY])).toEqual(buildUfcSurfacePolygons([RWY], 'B'))
  })

  it('includes the shared runway outline feature (regression guard for c9c4f955)', () => {
    const features = buildUfcSurfacePolygons([RWY], 'B')
    expect(features.some(f => f.id === 'runway')).toBe(true)
  })

  it("Army_B primary polygon half-width ≈ 500 ft (narrower Army primary)", () => {
    const features = buildUfcSurfacePolygons([RWY], 'Army_B')
    const primary = features.find(f => f.id === 'primary-surface')!
    const halfWidth = distanceFt(toLatLon(primary.coords[0]), toLatLon(primary.coords[1])) / 2
    expect(halfWidth).toBeGreaterThan(450)
    expect(halfWidth).toBeLessThan(550)
  })

  it("Class A ADCS inner half-width ≈ 500 ft", () => {
    const features = buildUfcSurfacePolygons([RWY], 'A')
    const approach = features.find(f => f.id === 'approach-end2')!
    const d = trapezoidDims(approach.coords)
    expect(d.innerHalfWidth).toBeGreaterThan(450)
    expect(d.innerHalfWidth).toBeLessThan(550)
  })
})
