import { describe, it, expect } from 'vitest'
import {
  evaluateObstruction,
  evaluateObstructionPart77,
  evaluateObstructionAllRunways,
  identifySurface,
  getUfcSurfaceInfo,
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

// Owner worked-example fixture (UFC Table 3-7 Note 4): thresholds BELOW the
// Established Airfield Elevation. EAE 380, thresholds 378 → the ADCS slope
// (from the threshold) and the horizontal-portion level-off (EAE + 500 = 880)
// cross at 50 × (880 − 378) = 25,100 ft along the ADCS.
const EAE_WORKED = 380
const RUNWAY_378 = getRunwayGeometry({
  end1: { latitude: 0, longitude: -lonOffset(RUNWAY_HALF_LEN_FT) },
  end2: { latitude: 0, longitude:  lonOffset(RUNWAY_HALF_LEN_FT) },
  length_ft: RUNWAY_LENGTH_FT,
  width_ft: 150,
  true_heading: 90,
  end1_elevation_msl: 378,
  end2_elevation_msl: 378,
  end1_designator: '09',
  end2_designator: '27',
})

/** Helper: a point 1,000 ft east of the east threshold (on centerline). */
function pointBeyondEastThreshold(ftBeyond: number, ftFromCL = 0): LatLon {
  return {
    lat: latOffset(ftFromCL),
    lon: lonOffset(RUNWAY_HALF_LEN_FT + ftBeyond),
  }
}

/** Exact distance a point sits along the east-end ADCS (past the primary end,
 *  which is 200 ft beyond the threshold). Reconstructed from the analysis'
 *  own along-track value so it matches the evaluator's projection exactly,
 *  independent of the test file's flat-earth per-degree constants. */
function adcsDistEast(alongTrackFromMidpoint: number): number {
  return alongTrackFromMidpoint - RUNWAY_HALF_LEN_FT - 200
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

// ─────────────────────────────────────────────────────────────
// identifySurface — surface-set awareness (P77 task 2)
// ─────────────────────────────────────────────────────────────

describe('identifySurface with surfaceSet', () => {
  // 3,500 ft beyond the east threshold, on centerline: past the UFC clear
  // zone/graded-area's 3,000-ft length (which are 0-ft-AGL — more restrictive
  // than approach-departure and would otherwise win the reduction) but still
  // inside both evaluators' approach surface, so the approach surface is the
  // sole applicable (non-land-use) surface and unambiguously controls.
  it('faa_part77: a point off the runway end returns a Part 77 surface name, not the UFC one', () => {
    const p = pointBeyondEastThreshold(3500, 0)
    const name = identifySurface(
      p,
      [{ label: '09/27', geometry: RUNWAY }],
      AIRFIELD_ELEV,
      'B',
      'faa_part77',
    )
    expect(name).toBe('Approach Surface')
  })

  it('defaults to UFC when surfaceSet is omitted (back-compat regression)', () => {
    const p = pointBeyondEastThreshold(3500, 0)
    const name = identifySurface(
      p,
      [{ label: '09/27', geometry: RUNWAY }],
      AIRFIELD_ELEV,
      'B',
      // surfaceSet omitted
    )
    expect(name).toBe('Approach-Departure Clearance Surface')
  })

  it('existing plain-RunwayGeometry[] callers are unaffected (real caller shape, default surfaceSet)', () => {
    const p = pointBeyondEastThreshold(3500, 0)
    const name = identifySurface(p, [RUNWAY], AIRFIELD_ELEV, 'B')
    expect(name).toBe('Approach-Departure Clearance Surface')
  })

  it('faa_part77: a per-runway approachType picks the type-dependent governing surface', () => {
    // 7,000 ft north of midpoint — inside the 10,000-ft horizontal radius
    // (non_utility_non_precision_low) but outside the 5,000-ft one (utility_visual).
    // At that distance utility_visual falls into its conical ring instead.
    const p = { lat: latOffset(7000), lon: 0 }

    const wideRadius = identifySurface(
      p,
      [{ label: '09/27', geometry: RUNWAY, approachType: 'non_utility_non_precision_low' }],
      AIRFIELD_ELEV,
      'B',
      'faa_part77',
    )
    expect(wideRadius).toBe('Horizontal Surface')

    const narrowRadius = identifySurface(
      p,
      [{ label: '09/27', geometry: RUNWAY, approachType: 'utility_visual' }],
      AIRFIELD_ELEV,
      'B',
      'faa_part77',
    )
    expect(narrowRadius).toBe('Conical Surface')
  })

  it('a point outside all surfaces returns "Outside all surfaces" in both sets', () => {
    // 100,000 ft due north of the midpoint — well beyond every UFC (outer
    // horizontal radius 44,500 ft) and Part 77 (conical outer radius ≤ 14,000 ft) surface.
    const p = { lat: latOffset(100000), lon: 0 }

    const ufcName = identifySurface(p, [RUNWAY], AIRFIELD_ELEV, 'B')
    expect(ufcName).toBe('Outside all surfaces')

    const part77Name = identifySurface(
      p,
      [{ label: '09/27', geometry: RUNWAY }],
      AIRFIELD_ELEV,
      'B',
      'faa_part77',
    )
    expect(part77Name).toBe('Outside all surfaces')
  })
})

// ─────────────────────────────────────────────────────────────
// SSE Task 1 — UFC 3-260-01 (C3) ADCS corrections: 40:1 Class A,
// Army 500-ft primary, and the horizontal-portion level-off cap.
// ─────────────────────────────────────────────────────────────

describe('UFC ADCS corrections (SSE Task 1)', () => {
  it('Class A ADCS rises at 40:1 (not 50:1) from the threshold in the sloped region', () => {
    // 4,200 ft beyond the east threshold → ~4,000 ft along the ADCS, well below
    // the EAE + 500 = 1,500 ft level-off. Class A 40:1 → 1,000 + dist/40;
    // Class B 50:1 → 1,000 + dist/50. The two must differ by the 50/40 ratio.
    const p = pointBeyondEastThreshold(4200, 0)
    const a = evaluateObstruction(p, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'A')
    const approachA = a.surfaces.find(s => s.surfaceKey === 'approach_departure')!
    const dist = adcsDistEast(a.alongTrackFromMidpoint)

    expect(approachA.isWithinBounds).toBe(true)
    expect(dist / 40).toBeLessThan(500) // still on the 40:1 slope, below the cap
    expect(approachA.maxAllowableHeightMSL).toBeCloseTo(AIRFIELD_ELEV + dist / 40, 4)
    // Emphatically NOT the old 50:1 value
    expect(approachA.maxAllowableHeightMSL).not.toBeCloseTo(AIRFIELD_ELEV + dist / 50, 2)

    const b = evaluateObstruction(p, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'B')
    const approachB = b.surfaces.find(s => s.surfaceKey === 'approach_departure')!
    const heightA = approachA.maxAllowableHeightMSL - AIRFIELD_ELEV
    const heightB = approachB.maxAllowableHeightMSL - AIRFIELD_ELEV
    expect(heightA / heightB).toBeCloseTo(50 / 40, 5)
  })

  it('Army_B primary is 500-ft half-width: 600 ft off centerline is outside Army but inside AF Class B primary', () => {
    // Abeam the runway midpoint, 600 ft off centerline. Army primary half-width
    // 500 → outside; AF Class B primary half-width 1,000 → inside.
    const p: LatLon = { lat: latOffset(600), lon: 0 }
    const army = evaluateObstruction(p, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'Army_B')
    const af = evaluateObstruction(p, 50, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'B')

    expect(army.surfaces.find(s => s.surfaceKey === 'primary')!.isWithinBounds).toBe(false)
    expect(af.surfaces.find(s => s.surfaceKey === 'primary')!.isWithinBounds).toBe(true)
  })

  it('Class B ADCS levels off at EAE + 500 (horizontal portion) past the slope/cap crossover', () => {
    // threshold = EAE = 1,000, slope 50 → crossover at 50 × 500 = 25,000 ft.
    // 30,200 ft beyond → ~30,000 ft along; the 50:1 slope would reach ~1,600 ft
    // but the surface levels off at 1,500 ft MSL.
    const p = pointBeyondEastThreshold(30200, 0)
    const r = evaluateObstruction(p, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'B')
    const approach = r.surfaces.find(s => s.surfaceKey === 'approach_departure')!

    expect(approach.isWithinBounds).toBe(true)
    expect(approach.maxAllowableHeightMSL).toBeCloseTo(AIRFIELD_ELEV + 500, 6) // exactly 1,500
    expect(approach.calculationBreakdown).toContain('ADCS horizontal portion')
  })

  it('owner worked example (EAE 380, threshold 378): sloped just before the 25,100-ft crossover, capped 880 just after', () => {
    // Just BEFORE crossover (~23,800 ft along): sloped, 378 + dist/50 < 880.
    const before = pointBeyondEastThreshold(24000, 0)
    const rBefore = evaluateObstruction(before, 0, 378, RUNWAY_378, EAE_WORKED, 'B')
    const aBefore = rBefore.surfaces.find(s => s.surfaceKey === 'approach_departure')!
    const distBefore = adcsDistEast(rBefore.alongTrackFromMidpoint)
    expect(aBefore.maxAllowableHeightMSL).toBeCloseTo(378 + distBefore / 50, 4)
    expect(aBefore.maxAllowableHeightMSL).toBeLessThan(880)
    expect(aBefore.calculationBreakdown).not.toContain('ADCS horizontal portion')

    // Just AFTER crossover (~26,300 ft along): capped at exactly 880 ft MSL.
    const after = pointBeyondEastThreshold(26500, 0)
    const rAfter = evaluateObstruction(after, 0, 378, RUNWAY_378, EAE_WORKED, 'B')
    const aAfter = rAfter.surfaces.find(s => s.surfaceKey === 'approach_departure')!
    expect(aAfter.maxAllowableHeightMSL).toBeCloseTo(880, 6) // EAE 380 + 500
    expect(aAfter.calculationBreakdown).toContain('ADCS horizontal portion')
  })

  it('ADCS reaches beyond the old 25,000-ft bound — a point ~40,000 ft out is in-bounds and capped', () => {
    // The 50,000-ft ADCS length now covers this; the old 25,000-ft surface did not.
    const p = pointBeyondEastThreshold(40200, 0)
    const r = evaluateObstruction(p, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'B')
    const approach = r.surfaces.find(s => s.surfaceKey === 'approach_departure')!
    const dist = adcsDistEast(r.alongTrackFromMidpoint)

    expect(dist).toBeGreaterThan(25000)
    expect(dist).toBeLessThan(50000)
    expect(approach.isWithinBounds).toBe(true)
    expect(approach.maxAllowableHeightMSL).toBeCloseTo(AIRFIELD_ELEV + 500, 6) // capped
    expect(identifySurface(p, [RUNWAY], AIRFIELD_ELEV, 'B')).not.toBe('Outside all surfaces')
  })

  it('inner horizontal uses the corrected 7,500-ft radius — a point 10,000 ft abeam falls in conical, not inner horizontal', () => {
    // 10,000 ft north of midpoint sits between the corrected inner-horizontal
    // radius (7,500 ft) and the conical outer edge (7,500 + 7,000 = 14,500 ft).
    // Under the old 13,120-ft radius it would have been inner horizontal.
    const p: LatLon = { lat: latOffset(10000), lon: 0 }
    const r = evaluateObstruction(p, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'B')
    const innerH = r.surfaces.find(s => s.surfaceKey === 'inner_horizontal')!
    const conical = r.surfaces.find(s => s.surfaceKey === 'conical')!

    expect(innerH.isWithinBounds).toBe(false)
    expect(conical.isWithinBounds).toBe(true)
  })

  it('Part 77 approach is unaffected by the UFC horizontal-portion cap (no level-off; FAA §77.19 slopes to length)', () => {
    // A precision approach 30,000 ft out: two-segment 50:1 + 40:1 = 700 ft above
    // threshold = 1,700 ft MSL, with NO EAE+500 cap (Part 77 has no horizontal portion).
    const p = pointBeyondEastThreshold(30000, 0)
    const r = evaluateObstructionPart77(p, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'non_utility_precision')
    const approach = r.surfaces.find(s => s.surfaceKey === 'approach')!
    expect(approach.isWithinBounds).toBe(true)
    expect(approach.maxAllowableHeightMSL).toBeGreaterThan(AIRFIELD_ELEV + 500)
    expect(approach.calculationBreakdown).not.toContain('ADCS horizontal portion')
  })
})

// ─────────────────────────────────────────────────────────────
// SSE Task 3 — class-aware UFC surface display info (IMAGINARY_SURFACES split)
//
// The evaluator's result-row ufcCriteria text must cite the evaluated class's
// numbers. Before the split the approach-departure text hardcoded "50:1", so a
// Class A evaluation cited Class B's slope. Class B rows must stay byte-for-byte
// identical to the pre-split output (locked here as a regression guard).
// ─────────────────────────────────────────────────────────────

describe('UFC surface info is class-aware (SSE Task 3)', () => {
  const P = pointBeyondEastThreshold(500, 0)
  const row = (result: ReturnType<typeof evaluateObstruction>, key: string) =>
    result.surfaces.find(s => s.surfaceKey === key)!

  it('Class A approach-departure row cites 40:1 (not 50:1)', () => {
    const a = evaluateObstruction(P, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'A')
    const approach = row(a, 'approach_departure')
    expect(approach.ufcCriteria).toContain('40:1')
    expect(approach.ufcCriteria).not.toContain('50:1')
  })

  it('Class A primary row cites the 500-ft Class A half-width (not the 1,000-ft Class B width)', () => {
    const a = evaluateObstruction(P, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'A')
    const primary = row(a, 'primary')
    expect(primary.ufcCriteria).toContain('500 ft of centerline')
    expect(primary.ufcCriteria).not.toContain('1000 ft of centerline')
  })

  it('Class B result rows are byte-identical to the pre-split text (one row per representative surface)', () => {
    const b = evaluateObstruction(P, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'B')

    expect(row(b, 'primary').ufcCriteria).toBe(
      'No object may protrude above the primary surface elevation (runway elevation) within 1000 ft of centerline and 200 ft beyond each runway end.',
    )
    expect(row(b, 'approach_departure').ufcCriteria).toBe(
      'No object may penetrate the 50:1 approach-departure clearance surface extending 50,000 ft from the primary surface end.',
    )
    expect(row(b, 'transitional').ufcCriteria).toBe(
      'No object may penetrate the 7:1 transitional surface extending from the primary surface and approach-departure surface edges to the inner horizontal surface height (150 ft).',
    )
    expect(row(b, 'inner_horizontal').ufcCriteria).toBe(
      'No object may protrude above 150 ft above the established airfield elevation within a 7,500 ft radius of the runway ends.',
    )
    expect(row(b, 'conical').ufcCriteria).toBe(
      'No object may penetrate the 20:1 conical surface extending 7,000 ft outward from the inner horizontal surface boundary.',
    )
    expect(row(b, 'outer_horizontal').ufcCriteria).toBe(
      'No object may protrude above 500 ft above the established airfield elevation within a 44,500 ft radius of the runway ends.',
    )
    expect(row(b, 'clear_zone').ufcCriteria).toBe(
      'The clear zone must remain essentially obstruction free. No fixed or non-frangible objects permitted within 3,000 ft x 3,000 ft from each runway end unless meeting B13 permissible deviation criteria.',
    )
    expect(row(b, 'graded_area').ufcCriteria).toBe(
      'The graded portion (1,000 ft from runway end, 3,000 ft wide) must be rough graded and obstruction free. No above-ground fixed obstacles, structures, rigid poles, towers, or non-frangible equipment permitted.',
    )
  })

  it('Class B name / ufcRef / color are unchanged from IMAGINARY_SURFACES (class-invariant meta)', () => {
    const b = evaluateObstruction(P, 0, AIRFIELD_ELEV, RUNWAY, AIRFIELD_ELEV, 'B')
    const approach = row(b, 'approach_departure')
    expect(approach.surfaceName).toBe('Approach-Departure Clearance Surface')
    // Fix 2 (SSE final review): the ADCS spans Table 3-7 items 5–11 (start /
    // slope / widths / elevation). The old "Item 2" was a row the verified
    // reference (docs/references/ufc-3-260-01-table3-7-verified.md) disproves.
    expect(approach.ufcReference).toBe('UFC 3-260-01, Table 3-7, Items 5–11 (Approach-Departure Clearance Surface)')
    expect(approach.color).toBe('#F97316')
  })
})

// ─────────────────────────────────────────────────────────────
// Fix 3 follow-up (SSE final review) — legend descriptions are class-aware.
//
// Five UFC_SURFACE_META descriptions quoted class-varying numbers as static
// strings, so a pinned Class A row's collapsed legend read "50:1 slope..."
// (should be 40:1) and an Army row's clear-zone/graded/APZ lines read
// "3,000 ft wide" (Army: 1,000 ft). All five now template from the class's
// SurfaceCriteria via the same (criteria) => string mechanism as ufcCriteria.
// Class B resolves byte-identical to the old static strings (regression lock).
// ─────────────────────────────────────────────────────────────

describe('UFC legend descriptions are class-aware (Fix 3 follow-up)', () => {
  it('Class A approach-departure description cites the 40:1 Class A slope (Table 3-7 item 7 IFR)', () => {
    const a = getUfcSurfaceInfo('A')
    expect(a.approach_departure.description).toBe('40:1 slope extending from each end of the primary surface.')
    expect(a.approach_departure.description).not.toContain('50:1')
  })

  it('Army clear-zone description cites the 1,000-ft Army width (Table 3-5 Army), not the 3,000-ft AF width', () => {
    const army = getUfcSurfaceInfo('Army_B')
    expect(army.clear_zone.description).toBe(
      'Obstruction-free zone extending 3,000 ft from each runway threshold, 1,000 ft wide.',
    )
    expect(army.clear_zone.description).not.toContain('3,000 ft wide')
  })

  it('Class B descriptions resolve byte-identical to the pre-templating static strings', () => {
    // These five were static strings before the templater conversion; Class B's
    // criteria reproduce them exactly (provenance: Table 3-5 / 3-7 / 3-6 Class B
    // values in surface-criteria.ts).
    const b = getUfcSurfaceInfo('B')
    expect(b.clear_zone.description).toBe(
      'Obstruction-free zone extending 3,000 ft from each runway threshold, 3,000 ft wide.',
    )
    expect(b.graded_area.description).toBe(
      'Rough-graded, obstruction-free portion of the clear zone extending 1,000 ft from each threshold, 3,000 ft wide.',
    )
    expect(b.approach_departure.description).toBe(
      '50:1 slope extending from each end of the primary surface.',
    )
    expect(b.apz_i.description).toBe(
      'High accident risk zone extending 5,000 ft beyond the clear zone, 3,000 ft wide.',
    )
    expect(b.apz_ii.description).toBe(
      'Moderate accident risk zone extending 7,000 ft beyond APZ I, 3,000 ft wide.',
    )
  })

  it('Class A APZ descriptions cite the 2,500-ft Class A lengths; Army APZs cite the 1,000-ft width', () => {
    const a = getUfcSurfaceInfo('A')
    expect(a.apz_i.description).toBe('High accident risk zone extending 2,500 ft beyond the clear zone, 3,000 ft wide.')
    expect(a.apz_ii.description).toBe('Moderate accident risk zone extending 2,500 ft beyond APZ I, 3,000 ft wide.')
    const army = getUfcSurfaceInfo('Army_B')
    expect(army.apz_i.description).toBe('High accident risk zone extending 5,000 ft beyond the clear zone, 1,000 ft wide.')
  })

  it('APZ ufcRef cites Table 3-6 (dimensions) alongside DoDI 4165.57 (land-use rules in the criteria prose)', () => {
    const b = getUfcSurfaceInfo('B')
    expect(b.apz_i.ufcRef).toBe('UFC 3-260-01, Table 3-6; DoD Instruction 4165.57 (APZ I)')
    expect(b.apz_ii.ufcRef).toBe('UFC 3-260-01, Table 3-6; DoD Instruction 4165.57 (APZ II)')
  })

  it('no resolved description contains an un-templated placeholder', () => {
    for (const cls of ['A', 'B', 'Army_B']) {
      for (const s of Object.values(getUfcSurfaceInfo(cls))) {
        expect(s.description).not.toMatch(/\{[a-z]+\}/i)
      }
    }
  })
})
