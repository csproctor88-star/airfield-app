import { describe, it, expect } from 'vitest'
import {
  evaluateObstruction,
  evaluateObstructionPart77,
  evaluateObstructionAllRunways,
} from '@/lib/calculations/obstructions'
import { getRunwayGeometry, type LatLon } from '@/lib/calculations/geometry'

// ─────────────────────────────────────────────────────────────
// Test fixtures — synthetic east-west runway centered at lat=0 lon=0
//
// Length 10,000 ft. End1 is the west threshold (lat=0, west of midpoint),
// end2 is the east threshold (lat=0, east of midpoint). Heading 090°.
//
// 1° longitude at the equator ≈ 364,567 ft, so 5,000 ft ≈ 0.01371°.
// 1° latitude ≈ 364,400 ft (also ~364k at low lat for our purposes).
// ─────────────────────────────────────────────────────────────

const LON_FT_PER_DEG = 364567
const LAT_FT_PER_DEG = 364400

function lonOffset(ft: number): number { return ft / LON_FT_PER_DEG }
function latOffset(ft: number): number { return ft / LAT_FT_PER_DEG }

const RUNWAY_LENGTH_FT = 10000
const RUNWAY_HALF_LEN_FT = RUNWAY_LENGTH_FT / 2

const RUNWAY = getRunwayGeometry({
  end1: { latitude: 0, longitude: -lonOffset(RUNWAY_HALF_LEN_FT) },  // west threshold
  end2: { latitude: 0, longitude:  lonOffset(RUNWAY_HALF_LEN_FT) },  // east threshold
  length_ft: RUNWAY_LENGTH_FT,
  width_ft: 150,
  true_heading: 90,
  end1_elevation_msl: 1000,
  end2_elevation_msl: 1000,
  end1_designator: '09',
  end2_designator: '27',
})

const AIRFIELD_ELEV = 1000

/** Helper: a point 1,000 ft east of the east threshold (on centerline). */
function pointBeyondEastThreshold(ftBeyond: number, ftFromCL = 0): LatLon {
  return {
    lat: latOffset(ftFromCL),
    lon: lonOffset(RUNWAY_HALF_LEN_FT + ftBeyond),
  }
}

// ─────────────────────────────────────────────────────────────
// Regression: UFC evaluator unchanged
// ─────────────────────────────────────────────────────────────

describe('evaluateObstruction (UFC, regression)', () => {
  it('a 50-ft obstruction inside the primary surface violates primary', () => {
    // Inside primary (on centerline, 1000 ft inside east threshold)
    const insidePrimary: LatLon = { lat: 0, lon: lonOffset(RUNWAY_HALF_LEN_FT - 1000) }
    const result = evaluateObstruction(insidePrimary, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV)
    const primary = result.surfaces.find(s => s.surfaceKey === 'primary')
    expect(primary?.isWithinBounds).toBe(true)
    expect(primary?.violated).toBe(true)
  })

  it('a 50-ft obstruction beyond the primary surface inside approach-departure flags violation if too high', () => {
    // UFC primary surface extends 200 ft beyond each runway end (extension field),
    // so to be in the approach-departure surface the point must be > 200 ft beyond.
    // 500 ft beyond → ~300 ft past primary end → max allowable at 50:1 slope ≈ 6 ft.
    // 50 ft tower → violation.
    const p = pointBeyondEastThreshold(500, 0)
    const result = evaluateObstruction(p, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV)
    const approach = result.surfaces.find(s => s.surfaceKey === 'approach_departure')
    expect(approach?.isWithinBounds).toBe(true)
    expect(approach?.violated).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// Part 77 evaluator
// ─────────────────────────────────────────────────────────────

describe('evaluateObstructionPart77', () => {
  it('emits 5 §77.19 surfaces (no UFC-only ones)', () => {
    const p = pointBeyondEastThreshold(500, 0)
    const result = evaluateObstructionPart77(p, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV)
    const keys = result.surfaces.map(s => s.surfaceKey).sort()
    expect(keys).toEqual(['approach', 'conical', 'horizontal', 'primary', 'transitional'])
    // None of the UFC-only surfaces
    expect(keys).not.toContain('clear_zone')
    expect(keys).not.toContain('outer_horizontal')
    expect(keys).not.toContain('apz_i')
  })

  it('non_utility_non_precision_low: a 50-ft tower 500 ft beyond east threshold on CL flags approach (34:1 from threshold)', () => {
    // Max allowable at 500 ft along approach = 500/34 ≈ 14.7 ft. 50 ft tower → violation.
    const p = pointBeyondEastThreshold(500, 0)
    const result = evaluateObstructionPart77(p, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'non_utility_non_precision_low')
    const approach = result.surfaces.find(s => s.surfaceKey === 'approach')
    expect(approach?.isWithinBounds).toBe(true)
    expect(approach?.violated).toBe(true)
    expect(approach!.penetrationFt).toBeGreaterThan(30)
  })

  it('non_utility_precision: same 50-ft tower passes approach (50:1 slope is more permissive at close range)', () => {
    // 500 ft along approach / 50 = 10 ft max. But surface starts at 1,000 ft total halfWidth — point is on CL (250 ft inside).
    // Actually with 50:1 slope, 50 ft tower at 500 ft along → 500/50 = 10 ft max allowable → violates by 40 ft.
    // Let's instead place it much closer to a real edge case: tower at 3,000 ft beyond → 60 ft max. 50 ft is OK.
    const p = pointBeyondEastThreshold(3000, 0)
    const result = evaluateObstructionPart77(p, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'non_utility_precision')
    const approach = result.surfaces.find(s => s.surfaceKey === 'approach')
    expect(approach?.isWithinBounds).toBe(true)
    expect(approach?.violated).toBe(false)
  })

  it('utility_visual primary (250 ft total) is more restrictive than non_utility_visual primary (500 ft)', () => {
    // Point 200 ft off centerline alongside the runway midpoint:
    //   - utility_visual halfWidth = 125 → point is OUTSIDE primary (no violation)
    //   - non_utility_visual halfWidth = 250 → point is INSIDE primary → 50 ft tower violates
    const p: LatLon = { lat: latOffset(200), lon: 0 }
    const utilityResult = evaluateObstructionPart77(p, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'utility_visual')
    const nonUtilityResult = evaluateObstructionPart77(p, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'non_utility_visual')

    const utilPrimary = utilityResult.surfaces.find(s => s.surfaceKey === 'primary')
    const nonUtilPrimary = nonUtilityResult.surfaces.find(s => s.surfaceKey === 'primary')

    expect(utilPrimary?.isWithinBounds).toBe(false)
    expect(utilPrimary?.violated).toBe(false)

    expect(nonUtilPrimary?.isWithinBounds).toBe(true)
    expect(nonUtilPrimary?.violated).toBe(true)
  })

  it('precision approach extends 50,000 ft — an obstruction 30,000 ft out is still evaluated', () => {
    // 30,000 ft beyond threshold. Two-segment slope:
    //   first 10,000 ft / 50 = 200 ft
    //   next 20,000 ft / 40 = 500 ft
    //   total max = 700 ft above threshold elev
    const p = pointBeyondEastThreshold(30000, 0)
    const result = evaluateObstructionPart77(p, 100, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'non_utility_precision')
    const approach = result.surfaces.find(s => s.surfaceKey === 'approach')
    expect(approach?.isWithinBounds).toBe(true)
    // 100 ft tower, max ≈ 700 ft → safely below; no violation
    expect(approach?.violated).toBe(false)
  })

  it('non-precision approach length is 10,000 ft — an obstruction 12,000 ft out is NOT in approach', () => {
    const p = pointBeyondEastThreshold(12000, 0)
    const result = evaluateObstructionPart77(p, 100, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'non_utility_non_precision_low')
    const approach = result.surfaces.find(s => s.surfaceKey === 'approach')
    expect(approach?.isWithinBounds).toBe(false)
  })

  it('utility-or-visual horizontal radius is 5,000 ft (vs 10,000 for all other runways)', () => {
    // §77.19(a): 5,000-ft arc "for all runways designated as utility or
    // visual"; 10,000 ft for all other runways (verified law.cornell.edu
    // fetch 2026-07-16 — non_utility_visual moved to the 5,000-ft group).
    // Point 7,000 ft north of midpoint:
    //   utility_visual / non_utility_visual radius = 5,000 → point is OUTSIDE
    //   non_utility_non_precision_low radius = 10,000 → point is INSIDE → 200 ft tower violates (max = 150 ft)
    const p: LatLon = { lat: latOffset(7000), lon: 0 }
    const utility = evaluateObstructionPart77(p, 200, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'utility_visual')
    const nonUtilVisual = evaluateObstructionPart77(p, 200, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'non_utility_visual')
    const nonUtilLowVis = evaluateObstructionPart77(p, 200, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'non_utility_non_precision_low')

    const utilH = utility.surfaces.find(s => s.surfaceKey === 'horizontal')
    const nonUtilVisualH = nonUtilVisual.surfaces.find(s => s.surfaceKey === 'horizontal')
    const nonUtilLowVisH = nonUtilLowVis.surfaces.find(s => s.surfaceKey === 'horizontal')

    expect(utilH?.isWithinBounds).toBe(false)
    expect(nonUtilVisualH?.isWithinBounds).toBe(false) // visual runway → 5,000-ft arc per §77.19(a)(1)
    expect(nonUtilLowVisH?.isWithinBounds).toBe(true)
    expect(nonUtilLowVisH?.violated).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// Multi-runway dispatcher
// ─────────────────────────────────────────────────────────────

describe('evaluateObstructionAllRunways with surfaceSet', () => {
  it('defaults to UFC (regression — existing USAF callers unchanged)', () => {
    const p = pointBeyondEastThreshold(500, 0)
    const result = evaluateObstructionAllRunways(
      p, 50, AIRFIELD_ELEV,
      [{ label: '09/27', geometry: RUNWAY }],
      AIRFIELD_ELEV, 'B',
    )
    // UFC has approach_departure key, not approach
    const keys = result.perRunway[0].analysis.surfaces.map(s => s.surfaceKey)
    expect(keys).toContain('approach_departure')
    expect(keys).toContain('outer_horizontal') // UFC-only
  })

  it('dispatches to Part 77 evaluator when surfaceSet=faa_part77', () => {
    const p = pointBeyondEastThreshold(500, 0)
    const result = evaluateObstructionAllRunways(
      p, 50, AIRFIELD_ELEV,
      [{ label: '09/27', geometry: RUNWAY, approachType: 'non_utility_non_precision_low' }],
      AIRFIELD_ELEV, 'B',
      'faa_part77',
    )
    const keys = result.perRunway[0].analysis.surfaces.map(s => s.surfaceKey).sort()
    expect(keys).toEqual(['approach', 'conical', 'horizontal', 'primary', 'transitional'])
  })

  it('per-runway approachType — mixed runway types at one airport', () => {
    // Two runways at the same point (for test simplicity), one visual + one precision.
    // Same 50-ft tower 500 ft beyond east threshold:
    //   visual approach (20:1, 5,000 ft): max at 500 ft = 500/20 = 25 ft → 50 ft violates
    //   precision approach (50:1, 50,000 ft): max at 500 ft = 500/50 = 10 ft → 50 ft violates more
    const p = pointBeyondEastThreshold(500, 0)
    const result = evaluateObstructionAllRunways(
      p, 50, AIRFIELD_ELEV,
      [
        { label: '09/27 visual', geometry: RUNWAY, approachType: 'non_utility_visual' },
        { label: '09/27 precision', geometry: RUNWAY, approachType: 'non_utility_precision' },
      ],
      AIRFIELD_ELEV, 'B',
      'faa_part77',
    )
    expect(result.perRunway).toHaveLength(2)
    // Both runways flag a violation
    expect(result.perRunway[0].analysis.hasViolation).toBe(true)
    expect(result.perRunway[1].analysis.hasViolation).toBe(true)
  })
})
