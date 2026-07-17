import { describe, it, expect } from 'vitest'
import {
  getRunwayGeometry,
  generatePrimarySurfacePolygon,
  generateApproachDeparturePolygons,
  generateTransitionalPolygons,
  generateClearZonePolygons,
  generateAPZPolygons,
  distanceFt,
  type LatLon,
} from '@/lib/calculations/geometry'
import { getSurfaceCriteria } from '@/lib/calculations/surface-criteria'

// ─────────────────────────────────────────────────────────────
// SSE Task 3 — criteria-driven UFC polygon generators
//
// Synthetic east-west runway centered at lat=0/lon=0, 10,000 ft long,
// heading 090°. 1° longitude at the equator ≈ 364,567 ft.
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

const CLASS_B = getSurfaceCriteria('B')
const ARMY_B = getSurfaceCriteria('Army_B')
const CLASS_A = getSurfaceCriteria('A')

/** [lon, lat] ring vertex → LatLon */
function toLatLon(v: [number, number]): LatLon {
  return { lon: v[0], lat: v[1] }
}

/** For a single approach-departure trapezoid ring [p1,p2,p3,p4,p1]:
 *  p1/p2 = inner edge, p3/p4 = outer edge. Measure inner half-width,
 *  outer half-width, and along-axis length between the edge midpoints. */
function trapezoidDims(ring: [number, number][]) {
  const p1 = toLatLon(ring[0])
  const p2 = toLatLon(ring[1])
  const p3 = toLatLon(ring[2])
  const p4 = toLatLon(ring[3])
  const innerMid: LatLon = { lat: (p1.lat + p2.lat) / 2, lon: (p1.lon + p2.lon) / 2 }
  const outerMid: LatLon = { lat: (p3.lat + p4.lat) / 2, lon: (p3.lon + p4.lon) / 2 }
  return {
    innerHalfWidth: distanceFt(p1, p2) / 2,
    outerHalfWidth: distanceFt(p3, p4) / 2,
    length: distanceFt(innerMid, outerMid),
  }
}

// ── Default-equivalence: no criteria arg === explicit Class B ────────────────
// (These lock that the defaulted parameter reproduces the un-parameterized call
//  for the surfaces whose Class-B criteria equal the historical baked constants.)

describe('UFC generators — default arg equals explicit Class B', () => {
  it('generatePrimarySurfacePolygon(rwy) === generatePrimarySurfacePolygon(rwy, ClassB)', () => {
    expect(generatePrimarySurfacePolygon(RWY)).toEqual(generatePrimarySurfacePolygon(RWY, CLASS_B))
  })

  it('generateClearZonePolygons(rwy) === generateClearZonePolygons(rwy, ClassB)', () => {
    expect(generateClearZonePolygons(RWY)).toEqual(generateClearZonePolygons(RWY, CLASS_B))
  })

  it('generateAPZPolygons(rwy) === generateAPZPolygons(rwy, ClassB)', () => {
    expect(generateAPZPolygons(RWY)).toEqual(generateAPZPolygons(RWY, CLASS_B))
  })

  it('generateTransitionalPolygons(rwy) === generateTransitionalPolygons(rwy, ClassB)', () => {
    expect(generateTransitionalPolygons(RWY)).toEqual(generateTransitionalPolygons(RWY, CLASS_B))
  })

  it('generateApproachDeparturePolygons(rwy) === generateApproachDeparturePolygons(rwy, ClassB)', () => {
    expect(generateApproachDeparturePolygons(RWY)).toEqual(generateApproachDeparturePolygons(RWY, CLASS_B))
  })
})

// ── ADCS trapezoid now reflects the corrected Class-B dimensions ─────────────

describe('generateApproachDeparturePolygons — criteria-driven ADCS', () => {
  it('Class B reaches ≈50,000 ft length and ≈8,000-ft outer half-width (corrected, not the old 25,000×2,550)', () => {
    const { end2 } = generateApproachDeparturePolygons(RWY, CLASS_B)
    const d = trapezoidDims(end2)
    expect(d.innerHalfWidth).toBeGreaterThan(950)
    expect(d.innerHalfWidth).toBeLessThan(1050)
    expect(d.outerHalfWidth).toBeGreaterThan(7900)
    expect(d.outerHalfWidth).toBeLessThan(8100)
    expect(d.length).toBeGreaterThan(49000)
    expect(d.length).toBeLessThan(51000)
    // Emphatically NOT the old baked map trapezoid
    expect(d.outerHalfWidth).not.toBeLessThan(3000) // was 2,550
    expect(d.length).toBeGreaterThan(30000)         // was 25,000
  })

  it('Army_B inner half-width is ≈500 ft (narrower Army primary start), outer still ≈8,000', () => {
    const { end2 } = generateApproachDeparturePolygons(RWY, ARMY_B)
    const d = trapezoidDims(end2)
    expect(d.innerHalfWidth).toBeGreaterThan(450)
    expect(d.innerHalfWidth).toBeLessThan(550)
    expect(d.outerHalfWidth).toBeGreaterThan(7900)
    expect(d.outerHalfWidth).toBeLessThan(8100)
  })

  it('Class A inner half-width is ≈500 ft at 40:1-class dims (widths only — slope not drawn)', () => {
    const { end2 } = generateApproachDeparturePolygons(RWY, CLASS_A)
    const d = trapezoidDims(end2)
    expect(d.innerHalfWidth).toBeGreaterThan(450)
    expect(d.innerHalfWidth).toBeLessThan(550)
    expect(d.outerHalfWidth).toBeGreaterThan(7900)
    expect(d.outerHalfWidth).toBeLessThan(8100)
    expect(d.length).toBeGreaterThan(49000)
    expect(d.length).toBeLessThan(51000)
  })
})
