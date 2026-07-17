import { describe, it, expect } from 'vitest'
import {
  offsetPoint,
  distanceFt,
  normalizeBearing,
  getRunwayGeometry,
  type LatLon,
} from '@/lib/calculations/geometry'
import {
  getAnnex14Criteria,
  M_TO_FT,
} from '@/lib/calculations/annex14-criteria'
import {
  generateAnnex14ApproachPolygons,
  generateAnnex14TakeoffClimbPolygons,
  generateAnnex14InnerHorizontalPolygon,
  generateAnnex14ConicalPolygon,
  generateAnnex14TransitionalPolygons,
  buildAnnex14SurfacePolygons,
} from '@/lib/calculations/annex14-geometry'

// ─────────────────────────────────────────────────────────────
// ICAO Task 1 — annex14-geometry. Realistic CONUS east-west runway,
// 10,000 ft long (mirrors tests/part77-geometry.test.ts). distanceFt
// closeness checks per that test's idiom.
// ─────────────────────────────────────────────────────────────

const CENTER: LatLon = { lat: 39.0, lon: -104.0 }
const RWY_LENGTH_FT = 10000
const HALF_LEN_FT = RWY_LENGTH_FT / 2
const EXTENSION_FT = 200 // stadium arc centers sit 200 ft past each end

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

function toLL(c: [number, number]): LatLon {
  return { lon: c[0], lat: c[1] }
}
function midOf(a: [number, number], b: [number, number]): LatLon {
  return { lon: (a[0] + b[0]) / 2, lat: (a[1] + b[1]) / 2 }
}
function maxDistFromMidpoint(coords: [number, number][]): number {
  let max = 0
  for (const c of coords) {
    const d = distanceFt(RUNWAY.midpoint, toLL(c))
    if (d > max) max = d
  }
  return max
}

// ── Approach trapezoid ───────────────────────────────────────────────────────

describe('generateAnnex14ApproachPolygons', () => {
  it('code 3/4 instrument (non-precision code 4): far edge ≈ (60 + 15 000) m from threshold', () => {
    const criteria = getAnnex14Criteria('non_precision', 4)
    const { end2 } = generateAnnex14ApproachPolygons(RUNWAY, criteria)
    // Ring: [innerL, innerR, outerR, outerL, close]
    const farMid = midOf(end2[2], end2[3])
    expect(distanceFt(RUNWAY.end2, farMid)).toBeCloseTo((60 + 15000) * M_TO_FT, -2)
    // Inner edge sits distFromThreshold (60 m) beyond the threshold.
    const nearMid = midOf(end2[0], end2[1])
    expect(distanceFt(RUNWAY.end2, nearMid)).toBeCloseTo(60 * M_TO_FT, -1)
  })

  it('divergence 15% (non-precision) vs 10% (non-instrument)', () => {
    // Non-precision code 4: div 15%, plan length 15 000 m.
    const np = getAnnex14Criteria('non_precision', 4)
    const npRing = generateAnnex14ApproachPolygons(RUNWAY, np).end2
    const npInnerHalf = distanceFt(toLL(npRing[0]), toLL(npRing[1])) / 2
    const npOuterHalf = distanceFt(toLL(npRing[2]), toLL(npRing[3])) / 2
    const npPlanFt = 15000 * M_TO_FT
    expect((npOuterHalf - npInnerHalf) / npPlanFt).toBeCloseTo(0.15, 2)

    // Non-instrument code 4: div 10%, single section 3 000 m (no total).
    const ni = getAnnex14Criteria('non_instrument', 4)
    const niRing = generateAnnex14ApproachPolygons(RUNWAY, ni).end2
    const niInnerHalf = distanceFt(toLL(niRing[0]), toLL(niRing[1])) / 2
    const niOuterHalf = distanceFt(toLL(niRing[2]), toLL(niRing[3])) / 2
    const niPlanFt = 3000 * M_TO_FT
    expect((niOuterHalf - niInnerHalf) / niPlanFt).toBeCloseTo(0.10, 2)
  })

  it('outer half-width = innerEdge/2 + planLength × divergence (non-precision code 4)', () => {
    const criteria = getAnnex14Criteria('non_precision', 4)
    const ring = generateAnnex14ApproachPolygons(RUNWAY, criteria).end2
    const outerHalf = distanceFt(toLL(ring[2]), toLL(ring[3])) / 2
    // inner edge 300 m → 150 m half; 150 + 15 000 × 0.15 = 150 + 2 250 = 2 400 m half-width.
    expect(outerHalf).toBeCloseTo(2400 * M_TO_FT, -2)
  })
})

// ── Take-off climb (diverge then parallel) ──────────────────────────────────

describe('generateAnnex14TakeoffClimbPolygons', () => {
  it('code 3/4: reaches 1 200 m final width, then stays parallel at that width', () => {
    const criteria = getAnnex14Criteria('non_precision', 4) // take-off climb code 4
    const { end2 } = generateAnnex14TakeoffClimbPolygons(RUNWAY, criteria)
    // Ring: [innerL, innerR, flareR, farR, farL, flareL, close]
    const flareR = end2[2], farR = end2[3], farL = end2[4], flareL = end2[5]
    // Two stations beyond the flare point (flare corner and far corner) both at 1 200 m.
    const widthAtFlare = distanceFt(toLL(flareL), toLL(flareR))
    const widthAtFar = distanceFt(toLL(farL), toLL(farR))
    expect(widthAtFlare).toBeCloseTo(1200 * M_TO_FT, -2)
    expect(widthAtFar).toBeCloseTo(1200 * M_TO_FT, -2)
    // Parallel: the width is unchanged between the two stations.
    expect(widthAtFar).toBeCloseTo(widthAtFlare, -1)
  })

  it('inner edge is 180 m wide at 60 m beyond the runway end (code 4)', () => {
    const criteria = getAnnex14Criteria('non_precision', 4)
    const { end2 } = generateAnnex14TakeoffClimbPolygons(RUNWAY, criteria)
    const innerWidth = distanceFt(toLL(end2[0]), toLL(end2[1]))
    expect(innerWidth).toBeCloseTo(180 * M_TO_FT, -1)
    const innerMid = midOf(end2[0], end2[1])
    expect(distanceFt(RUNWAY.end2, innerMid)).toBeCloseTo(60 * M_TO_FT, -1)
  })

  it('far edge sits 15 000 m (+ 60 m offset) from the runway end (code 4)', () => {
    const criteria = getAnnex14Criteria('non_precision', 4)
    const { end2 } = generateAnnex14TakeoffClimbPolygons(RUNWAY, criteria)
    const farMid = midOf(end2[3], end2[4])
    expect(distanceFt(RUNWAY.end2, farMid)).toBeCloseTo((60 + 15000) * M_TO_FT, -2)
  })
})

// ── Inner horizontal + conical stadiums ──────────────────────────────────────

describe('generateAnnex14InnerHorizontalPolygon', () => {
  it('stadium radius per code (2 000 m code 1 vs 4 000 m code 4)', () => {
    const c1 = getAnnex14Criteria('non_instrument', 1) // radius 2 000 m
    const c4 = getAnnex14Criteria('non_precision', 4) // radius 4 000 m
    expect(maxDistFromMidpoint(generateAnnex14InnerHorizontalPolygon(RUNWAY, c1)))
      .toBeCloseTo(2000 * M_TO_FT + HALF_LEN_FT + EXTENSION_FT, -2)
    expect(maxDistFromMidpoint(generateAnnex14InnerHorizontalPolygon(RUNWAY, c4)))
      .toBeCloseTo(4000 * M_TO_FT + HALF_LEN_FT + EXTENSION_FT, -2)
  })
})

describe('generateAnnex14ConicalPolygon', () => {
  it('conical outer extent = height ÷ slope beyond the inner horizontal (code 4)', () => {
    const criteria = getAnnex14Criteria('non_precision', 4) // radius 4 000, conical 100 m @ 5%
    const innerH = maxDistFromMidpoint(generateAnnex14InnerHorizontalPolygon(RUNWAY, criteria))
    const conical = maxDistFromMidpoint(generateAnnex14ConicalPolygon(RUNWAY, criteria))
    // extent = 100 / 0.05 = 2 000 m.
    expect(conical - innerH).toBeCloseTo(2000 * M_TO_FT, -2)
    // Absolute reach = (4 000 + 2 000) m + halfLen + 200.
    expect(conical).toBeCloseTo(6000 * M_TO_FT + HALF_LEN_FT + EXTENSION_FT, -2)
  })
})

// ── Transitional: strip-width vs runway-edge origin ──────────────────────────

describe('generateAnnex14TransitionalPolygons', () => {
  it('lower edge sits at the strip half-width when configured', () => {
    const criteria = getAnnex14Criteria('non_precision', 4)
    const { left } = generateAnnex14TransitionalPolygons(RUNWAY, criteria, 300) // 300 m strip
    // Ring: [inner1, inner2, outer2, outer1, close] — inner1 = end1 + perp × stripHalf.
    expect(distanceFt(RUNWAY.end1, toLL(left[0]))).toBeCloseTo((300 / 2) * M_TO_FT, -1)
  })

  it('falls back to the runway edge when strip width is not configured', () => {
    const criteria = getAnnex14Criteria('non_precision', 4)
    const { left } = generateAnnex14TransitionalPolygons(RUNWAY, criteria) // no strip width
    // Runway is 150 ft wide → lower edge 75 ft from centerline.
    expect(distanceFt(RUNWAY.end1, toLL(left[0]))).toBeCloseTo(75, 0)
  })

  it('outer edge sits the horizontal run (45 m ÷ slope) beyond the lower edge', () => {
    const criteria = getAnnex14Criteria('non_precision', 4) // transitional 14.3%
    const { left } = generateAnnex14TransitionalPolygons(RUNWAY, criteria, 300)
    const lowerFt = (300 / 2) * M_TO_FT
    const runFt = (45 / (14.3 / 100)) * M_TO_FT
    // outer1 (index 3) at end1 + perp × (lower + run).
    expect(distanceFt(RUNWAY.end1, toLL(left[3]))).toBeCloseTo(lowerFt + runFt, -1)
  })
})

// ── Assembly: layer ids, rwyIndex tagging, NULL-variant fallback ─────────────

const A14_FEATURE_IDS = [
  'a14-conical',
  'a14-inner-horizontal',
  'a14-transitional-left',
  'a14-transitional-right',
  'a14-approach-end1',
  'a14-approach-end2',
  'a14-takeoff-climb-end1',
  'a14-takeoff-climb-end2',
].sort()

describe('buildAnnex14SurfacePolygons', () => {
  it('emits the locked layer-id set for a single runway', () => {
    const feats = buildAnnex14SurfacePolygons([{ geometry: RUNWAY, classification: 'non_precision', codeNumber: 4 }])
    expect([...new Set(feats.map((f) => f.id))].sort()).toEqual(A14_FEATURE_IDS)
    expect(feats.every((f) => f.rwyIndex === 0)).toBe(true)
  })

  it('NULL / absent variant falls back to ANNEX14_DEFAULT_VARIANT (non-precision code 4)', () => {
    const nullBuild = buildAnnex14SurfacePolygons([{ geometry: RUNWAY }])
    const explicit = buildAnnex14SurfacePolygons([{ geometry: RUNWAY, classification: 'non_precision', codeNumber: 4 }])
    expect(nullBuild).toEqual(explicit)
  })

  it('per-runway variant mixing tags each runway with its own rwyIndex + dimensions', () => {
    const feats = buildAnnex14SurfacePolygons([
      { geometry: RUNWAY, classification: 'non_instrument', codeNumber: 1 }, // rwyIndex 0, radius 2 000
      { geometry: RUNWAY, classification: 'non_precision', codeNumber: 4 },  // rwyIndex 1, radius 4 000
    ])
    const ih0 = feats.find((f) => f.id === 'a14-inner-horizontal' && f.rwyIndex === 0)!
    const ih1 = feats.find((f) => f.id === 'a14-inner-horizontal' && f.rwyIndex === 1)!
    expect(maxDistFromMidpoint(ih0.coords)).toBeCloseTo(2000 * M_TO_FT + HALF_LEN_FT + EXTENSION_FT, -2)
    expect(maxDistFromMidpoint(ih1.coords)).toBeCloseTo(4000 * M_TO_FT + HALF_LEN_FT + EXTENSION_FT, -2)
  })
})
