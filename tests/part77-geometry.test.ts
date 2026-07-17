import { describe, it, expect } from 'vitest'
import {
  offsetPoint,
  distanceFt,
  normalizeBearing,
  getRunwayGeometry,
  type LatLon,
} from '@/lib/calculations/geometry'
import { getPart77Surfaces, type FaaApproachType } from '@/lib/calculations/obstructions'
import {
  generatePart77PrimaryPolygon,
  generatePart77ApproachPolygons,
  generatePart77TransitionalPolygons,
  generatePart77HorizontalPolygon,
  generatePart77ConicalPolygon,
  buildPart77SurfacePolygons,
} from '@/lib/calculations/part77-geometry'

// ─────────────────────────────────────────────────────────────
// Fixture — realistic CONUS east-west runway, 10,000 ft long.
// Endpoints placed geodesically 5,000 ft either side of a Colorado
// centerpoint, so the derived bearing ≈ 090° and halfLength = 5,000 ft.
// ─────────────────────────────────────────────────────────────

const CENTER: LatLon = { lat: 39.0, lon: -104.0 }
const RWY_LENGTH_FT = 10000
const HALF_LEN_FT = RWY_LENGTH_FT / 2
const EXTENSION_FT = 200 // §77.19 primary-surface extension past each end

const west = offsetPoint(CENTER, 270, HALF_LEN_FT)
const east = offsetPoint(CENTER, 90, HALF_LEN_FT)

const RUNWAY = getRunwayGeometry({
  end1: { latitude: west.lat, longitude: west.lon },
  end2: { latitude: east.lat, longitude: east.lon },
  length_ft: RWY_LENGTH_FT,
  width_ft: 150,
  true_heading: 90,
  end1_designator: '09',
  end2_designator: '27',
})

// ── coordinate helpers (module output is [lon, lat]) ──
function toLL(c: [number, number]): LatLon {
  return { lon: c[0], lat: c[1] }
}
function midOf(a: [number, number], b: [number, number]): LatLon {
  return { lon: (a[0] + b[0]) / 2, lat: (a[1] + b[1]) / 2 }
}

const revBearing = normalizeBearing(RUNWAY.bearingDeg + 180)
const perpL = normalizeBearing(RUNWAY.bearingDeg - 90)
// On-axis reference points at each primary-surface end (200 ft past threshold)
const primaryEnd1 = offsetPoint(RUNWAY.end1, revBearing, EXTENSION_FT)
const primaryEnd2 = offsetPoint(RUNWAY.end2, RUNWAY.bearingDeg, EXTENSION_FT)

const ALL_TYPES: FaaApproachType[] = [
  'utility_visual',
  'utility_non_precision',
  'non_utility_visual',
  'non_utility_non_precision_3_4',
  'non_utility_non_precision_low',
  'non_utility_precision',
]

// ─────────────────────────────────────────────────────────────
// §77.19(c) Primary surface rectangle
// ─────────────────────────────────────────────────────────────

describe('generatePart77PrimaryPolygon', () => {
  it('returns a closed ring (first vertex repeated)', () => {
    const c = getPart77Surfaces('non_utility_non_precision_low').primary.criteria
    const ring = generatePart77PrimaryPolygon(RUNWAY, { halfWidth: c.halfWidth, extension: c.extension })
    expect(ring.length).toBe(5)
    expect(ring[0]).toEqual(ring[4])
  })

  it('half-width matches per-type criteria for every approach type', () => {
    for (const t of ALL_TYPES) {
      const c = getPart77Surfaces(t).primary.criteria
      const ring = generatePart77PrimaryPolygon(RUNWAY, { halfWidth: c.halfWidth, extension: c.extension })
      // Corner 0 = primaryEnd1 offset perpendicular by the half-width.
      expect(distanceFt(primaryEnd1, toLL(ring[0]))).toBeCloseTo(c.halfWidth, 0)
      expect(distanceFt(primaryEnd1, toLL(ring[1]))).toBeCloseTo(c.halfWidth, 0)
    }
  })

  it('length ≈ runway length + 400 ft (200 ft past each end)', () => {
    const c = getPart77Surfaces('non_utility_non_precision_low').primary.criteria
    const ring = generatePart77PrimaryPolygon(RUNWAY, { halfWidth: c.halfWidth, extension: c.extension })
    // Left edge runs corner 0 (near end1) → corner 3 (near end2).
    expect(distanceFt(toLL(ring[0]), toLL(ring[3]))).toBeCloseTo(RWY_LENGTH_FT + 400, -2)
  })

  it('extension is honored (not hard-coded) — a 500-ft extension lengthens the rectangle', () => {
    const ring = generatePart77PrimaryPolygon(RUNWAY, { halfWidth: 500, extension: 500 })
    expect(distanceFt(toLL(ring[0]), toLL(ring[3]))).toBeCloseTo(RWY_LENGTH_FT + 1000, -2)
  })
})

// ─────────────────────────────────────────────────────────────
// §77.19(d) Approach trapezoids
// ─────────────────────────────────────────────────────────────

describe('generatePart77ApproachPolygons', () => {
  it('inner corners sit at the primary half-width; outer corners at outerHalfWidth', () => {
    for (const t of ALL_TYPES) {
      const c = getPart77Surfaces(t).approach.criteria
      const { end2 } = generatePart77ApproachPolygons(RUNWAY, {
        innerHalfWidth: c.innerHalfWidth,
        outerHalfWidth: c.outerHalfWidth,
        length: c.length,
      })
      const far2 = offsetPoint(RUNWAY.end2, RUNWAY.bearingDeg, EXTENSION_FT + c.length)
      // Inner edge (corners 0/1) hugs the primary-surface end at innerHalfWidth.
      expect(distanceFt(primaryEnd2, toLL(end2[0]))).toBeCloseTo(c.innerHalfWidth, 0)
      // Outer edge (corners 2/3) flares to outerHalfWidth at the far station.
      expect(distanceFt(far2, toLL(end2[2]))).toBeCloseTo(c.outerHalfWidth, 0)
    }
  })

  it('far edge sits ≈ extension + length from the runway end per type', () => {
    const cases: Array<[FaaApproachType, number]> = [
      ['utility_visual', 5000],
      ['non_utility_non_precision_low', 10000],
      ['non_utility_precision', 50000],
    ]
    for (const [t, length] of cases) {
      const c = getPart77Surfaces(t).approach.criteria
      const { end2 } = generatePart77ApproachPolygons(RUNWAY, {
        innerHalfWidth: c.innerHalfWidth,
        outerHalfWidth: c.outerHalfWidth,
        length: c.length,
      })
      const farMid = midOf(end2[2], end2[3])
      expect(distanceFt(RUNWAY.end2, farMid)).toBeCloseTo(EXTENSION_FT + length, -2)
    }
  })

  it('defaults extension to 200 ft and honors an override', () => {
    const c = getPart77Surfaces('non_utility_non_precision_low').approach.criteria
    const crit = { innerHalfWidth: c.innerHalfWidth, outerHalfWidth: c.outerHalfWidth, length: c.length }
    const dflt = generatePart77ApproachPolygons(RUNWAY, crit)
    const startMidDefault = midOf(dflt.end2[0], dflt.end2[1])
    expect(distanceFt(RUNWAY.end2, startMidDefault)).toBeCloseTo(200, -1)

    const override = generatePart77ApproachPolygons(RUNWAY, crit, 500)
    const startMidOverride = midOf(override.end2[0], override.end2[1])
    expect(distanceFt(RUNWAY.end2, startMidOverride)).toBeCloseTo(500, -1)
  })

  it('produces a trapezoid at both ends', () => {
    const c = getPart77Surfaces('non_utility_non_precision_low').approach.criteria
    const both = generatePart77ApproachPolygons(RUNWAY, {
      innerHalfWidth: c.innerHalfWidth,
      outerHalfWidth: c.outerHalfWidth,
      length: c.length,
    })
    expect(both.end1.length).toBe(5)
    expect(both.end2.length).toBe(5)
    // end1 far edge points the other way — distinct from end2 far edge.
    const farMid1 = midOf(both.end1[2], both.end1[3])
    const farMid2 = midOf(both.end2[2], both.end2[3])
    expect(distanceFt(farMid1, farMid2)).toBeGreaterThan(2 * (EXTENSION_FT + c.length) - 100)
  })
})

// ─────────────────────────────────────────────────────────────
// §77.19(e) Transitional bands
// ─────────────────────────────────────────────────────────────

function transitionalCriteria(t: FaaApproachType) {
  const set = getPart77Surfaces(t)
  return {
    primaryHalfWidth: set.transitional.criteria.primaryHalfWidth,
    approachSlope: set.approach.criteria.slope,
    approachInnerHalfWidth: set.approach.criteria.innerHalfWidth,
    approachOuterHalfWidth: set.approach.criteria.outerHalfWidth,
    approachLength: set.approach.criteria.length,
  }
}

/** Reconstruct the along-track cutoff distance (from the primary end) that a
 *  transitional band reaches on the approach side, from its generated ring. */
function measuredApproachCutoff(left: [number, number][], right: [number, number][]): number {
  // Vertex 0 of each side is the approach-side inner cutoff corner; the two
  // sides are symmetric about the extended centerline, so their midpoint lies
  // on the axis at (extension + cutoff) from end1.
  const axisPt = midOf(left[0], right[0])
  return distanceFt(RUNWAY.end1, axisPt) - EXTENSION_FT
}

describe('generatePart77TransitionalPolygons', () => {
  it('outer edge sits 1,050 ft (150 ft × 7) beyond the primary edge', () => {
    for (const t of ALL_TYPES) {
      const { left } = generatePart77TransitionalPolygons(RUNWAY, transitionalCriteria(t))
      // Vertex 1 = inner primary edge; vertex 6 = outer primary edge (same station).
      expect(distanceFt(toLL(left[1]), toLL(left[6]))).toBeCloseTo(1050, -1)
    }
  })

  it('approach-side cutoff = 150 × slope (unclamped) per type', () => {
    const cases: Array<[FaaApproachType, number]> = [
      ['utility_visual', 3000], // 150 × 20
      ['non_utility_non_precision_low', 5100], // 150 × 34
      ['non_utility_precision', 7500], // 150 × 50
    ]
    for (const [t, expected] of cases) {
      const { left, right } = generatePart77TransitionalPolygons(RUNWAY, transitionalCriteria(t))
      expect(measuredApproachCutoff(left, right)).toBeCloseTo(expected, -2)
    }
  })

  it('clamps the cutoff to the approach length when 150 × slope would overshoot', () => {
    // Synthetic: 50:1 slope wants 7,500 ft, but the approach is only 5,000 ft long.
    const crit = {
      primaryHalfWidth: 500,
      approachSlope: 50,
      approachInnerHalfWidth: 500,
      approachOuterHalfWidth: 8000,
      approachLength: 5000,
    }
    const { left, right } = generatePart77TransitionalPolygons(RUNWAY, crit)
    const cutoff = measuredApproachCutoff(left, right)
    expect(cutoff).toBeCloseTo(5000, -2)
    expect(cutoff).toBeLessThanOrEqual(crit.approachLength + 1)
  })

  it('never lets the cutoff exceed the approach length for any real type', () => {
    for (const t of ALL_TYPES) {
      const crit = transitionalCriteria(t)
      const { left, right } = generatePart77TransitionalPolygons(RUNWAY, crit)
      expect(measuredApproachCutoff(left, right)).toBeLessThanOrEqual(crit.approachLength + 1)
    }
  })

  it('returns closed left and right rings', () => {
    const { left, right } = generatePart77TransitionalPolygons(RUNWAY, transitionalCriteria('non_utility_non_precision_low'))
    expect(left[0]).toEqual(left[left.length - 1])
    expect(right[0]).toEqual(right[right.length - 1])
  })
})

// ─────────────────────────────────────────────────────────────
// §77.19(a)/(b) Horizontal + Conical stadiums
// ─────────────────────────────────────────────────────────────

function maxDistFromMidpoint(coords: [number, number][]): number {
  let max = 0
  for (const c of coords) {
    const d = distanceFt(RUNWAY.midpoint, toLL(c))
    if (d > max) max = d
  }
  return max
}

describe('generatePart77HorizontalPolygon', () => {
  it('max reach from the runway midpoint ≈ radius + halfLength + 200', () => {
    for (const radius of [5000, 10000]) {
      const ring = generatePart77HorizontalPolygon(RUNWAY, radius)
      expect(maxDistFromMidpoint(ring)).toBeCloseTo(radius + HALF_LEN_FT + EXTENSION_FT, -2)
    }
  })
})

describe('generatePart77ConicalPolygon', () => {
  it('is a stadium at (radius + extent)', () => {
    expect(generatePart77ConicalPolygon(RUNWAY, 10000, 4000))
      .toEqual(generatePart77HorizontalPolygon(RUNWAY, 14000))
  })

  it('max reach ≈ horizontal radius + 4,000 + halfLength + 200', () => {
    const ring = generatePart77ConicalPolygon(RUNWAY, 10000, 4000)
    expect(maxDistFromMidpoint(ring)).toBeCloseTo(14000 + HALF_LEN_FT + EXTENSION_FT, -2)
  })

  it('conical extends exactly 4,000 ft beyond the horizontal surface', () => {
    const horiz = maxDistFromMidpoint(generatePart77HorizontalPolygon(RUNWAY, 10000))
    const conic = maxDistFromMidpoint(generatePart77ConicalPolygon(RUNWAY, 10000, 4000))
    expect(conic - horiz).toBeCloseTo(4000, -2)
  })
})

// ─────────────────────────────────────────────────────────────
// Assembly — buildPart77SurfacePolygons
// ─────────────────────────────────────────────────────────────

const NON_PRECISION_IDS = [
  'p77-approach-end1',
  'p77-approach-end2',
  'p77-conical',
  'p77-horizontal',
  'p77-primary',
  'p77-transitional-left',
  'p77-transitional-right',
].sort()

const PRECISION_IDS = [
  ...NON_PRECISION_IDS,
  'p77-segment-break-end1',
  'p77-segment-break-end2',
].sort()

describe('buildPart77SurfacePolygons', () => {
  it('emits exactly the non-precision layer-id set (no segment break)', () => {
    const feats = buildPart77SurfacePolygons([{ geometry: RUNWAY, approachType: 'non_utility_non_precision_low' }])
    expect([...new Set(feats.map(f => f.id))].sort()).toEqual(NON_PRECISION_IDS)
    expect(feats.every(f => f.rwyIndex === 0)).toBe(true)
  })

  it('adds the segment-break cross-lines only for precision', () => {
    const feats = buildPart77SurfacePolygons([{ geometry: RUNWAY, approachType: 'non_utility_precision' }])
    expect([...new Set(feats.map(f => f.id))].sort()).toEqual(PRECISION_IDS)
  })

  it('omits the segment break for every non-precision type', () => {
    for (const t of ALL_TYPES.filter(x => x !== 'non_utility_precision')) {
      const feats = buildPart77SurfacePolygons([{ geometry: RUNWAY, approachType: t }])
      expect(feats.some(f => f.id.startsWith('p77-segment-break'))).toBe(false)
    }
  })

  it('places the precision segment break ≈ 10,000 ft (+200 extension) from the runway end', () => {
    const feats = buildPart77SurfacePolygons([{ geometry: RUNWAY, approachType: 'non_utility_precision' }])
    const seg = feats.find(f => f.id === 'p77-segment-break-end2')!
    // Cross-line midpoint lies on the axis at the 50:1 → 40:1 station.
    const distinct = seg.coords.slice(0, 4)
    const center: LatLon = {
      lon: distinct.reduce((s, c) => s + c[0], 0) / 4,
      lat: distinct.reduce((s, c) => s + c[1], 0) / 4,
    }
    expect(distanceFt(RUNWAY.end2, center)).toBeCloseTo(10200, -2)
    // Spans the approach width at that station: 2 × 2,000 ft = 4,000 ft.
    expect(distanceFt(toLL(seg.coords[0]), toLL(seg.coords[3]))).toBeCloseTo(4000, -2)
  })

  it('tags each runway with its own rwyIndex and per-type approach length', () => {
    const feats = buildPart77SurfacePolygons([
      { geometry: RUNWAY, approachType: 'non_utility_precision' }, // rwyIndex 0
      { geometry: RUNWAY, approachType: 'utility_visual' },        // rwyIndex 1
    ])
    const app0 = feats.find(f => f.id === 'p77-approach-end2' && f.rwyIndex === 0)!
    const app1 = feats.find(f => f.id === 'p77-approach-end2' && f.rwyIndex === 1)!
    const far0 = midOf(app0.coords[2], app0.coords[3])
    const far1 = midOf(app1.coords[2], app1.coords[3])
    expect(distanceFt(RUNWAY.end2, far0)).toBeCloseTo(EXTENSION_FT + 50000, -2) // precision
    expect(distanceFt(RUNWAY.end2, far1)).toBeCloseTo(EXTENSION_FT + 5000, -2)  // utility visual
    // Precision runway carries a segment break; the visual runway does not.
    expect(feats.some(f => f.id.startsWith('p77-segment-break') && f.rwyIndex === 0)).toBe(true)
    expect(feats.some(f => f.id.startsWith('p77-segment-break') && f.rwyIndex === 1)).toBe(false)
    // Each runway's p77-horizontal stadium uses its own type's radius, not a
    // shared/default one: precision (10,000-ft radius) vs utility visual (5,000-ft).
    const horiz0 = feats.find(f => f.id === 'p77-horizontal' && f.rwyIndex === 0)!
    const horiz1 = feats.find(f => f.id === 'p77-horizontal' && f.rwyIndex === 1)!
    expect(maxDistFromMidpoint(horiz0.coords)).toBeCloseTo(10000 + HALF_LEN_FT + EXTENSION_FT, -2) // precision
    expect(maxDistFromMidpoint(horiz1.coords)).toBeCloseTo(5000 + HALF_LEN_FT + EXTENSION_FT, -2)   // utility visual
  })

  it('NULL approach type falls back to non_utility_non_precision_low', () => {
    const nullBuild = buildPart77SurfacePolygons([{ geometry: RUNWAY, approachType: null }])
    const explicit = buildPart77SurfacePolygons([{ geometry: RUNWAY, approachType: 'non_utility_non_precision_low' }])
    expect(nullBuild).toEqual(explicit)
  })

  it('missing approach type also falls back to the default set', () => {
    const noType = buildPart77SurfacePolygons([{ geometry: RUNWAY }])
    const explicit = buildPart77SurfacePolygons([{ geometry: RUNWAY, approachType: 'non_utility_non_precision_low' }])
    expect(noType).toEqual(explicit)
  })
})
