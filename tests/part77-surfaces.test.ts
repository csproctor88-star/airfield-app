import { describe, it, expect } from 'vitest'
import {
  PART77_SURFACES,
  IMAGINARY_SURFACES,
  getSurfaces,
  getPart77Surfaces,
  FAA_APPROACH_TYPE_LABELS,
  type FaaApproachType,
} from '@/lib/calculations/obstructions'

// ─────────────────────────────────────────────────────────────
// Per-approach-type Part 77 surfaces (14 CFR §77.19)
// ─────────────────────────────────────────────────────────────

describe('PART77_SURFACES (default backward-compat alias)', () => {
  it('exports the 5 §77.19 surfaces with the correct keys', () => {
    expect(Object.keys(PART77_SURFACES).sort()).toEqual([
      'approach', 'conical', 'horizontal', 'primary', 'transitional',
    ])
  })

  it('aliases the non_utility_non_precision_low set (preserves Phase 1 default)', () => {
    expect(PART77_SURFACES).toBe(getPart77Surfaces('non_utility_non_precision_low'))
  })

  it('every surface cites 14 CFR §77.19', () => {
    for (const s of Object.values(PART77_SURFACES)) {
      expect(s.ufcRef).toMatch(/§77\.19/)
    }
  })
})

describe('FAA_APPROACH_TYPE_LABELS', () => {
  it('has display labels for all 6 approach types', () => {
    expect(Object.keys(FAA_APPROACH_TYPE_LABELS).sort()).toEqual([
      'non_utility_non_precision_3_4',
      'non_utility_non_precision_low',
      'non_utility_precision',
      'non_utility_visual',
      'utility_non_precision',
      'utility_visual',
    ])
  })

  it('labels are human-readable, not raw enum keys', () => {
    for (const label of Object.values(FAA_APPROACH_TYPE_LABELS)) {
      expect(label).not.toMatch(/_/) // no snake_case in display
      expect(label.length).toBeGreaterThan(5)
    }
  })
})

describe('getPart77Surfaces(approachType)', () => {
  it('defaults to non_utility_non_precision_low (Phase 1 default)', () => {
    const def = getPart77Surfaces()
    expect(def.primary.criteria.halfWidth).toBe(500)         // 1,000 ft total per §77.19(c)(3)(iii)
    expect(def.approach.criteria.slope).toBe(34)             // non-precision
    expect(def.approach.criteria.outerHalfWidth).toBe(2000)  // 4,000 ft total (low vis)
  })

  // ── Primary surface widths per §77.19(c) — total widths = halfWidth × 2 ──

  it('utility_visual primary is 250 ft total (125 half-width)', () => {
    expect(getPart77Surfaces('utility_visual').primary.criteria.halfWidth).toBe(125)
  })

  it('utility_non_precision primary is 500 ft total (250 half-width)', () => {
    expect(getPart77Surfaces('utility_non_precision').primary.criteria.halfWidth).toBe(250)
  })

  it('non_utility_visual primary is 500 ft total (250 half-width)', () => {
    expect(getPart77Surfaces('non_utility_visual').primary.criteria.halfWidth).toBe(250)
  })

  it('non_utility_non_precision_3_4 primary is 500 ft total (250 half-width)', () => {
    expect(getPart77Surfaces('non_utility_non_precision_3_4').primary.criteria.halfWidth).toBe(250)
  })

  // Verified 1,000-ft total width (500-ft half-width) per 14 CFR §77.19(c)(3)(iii)
  // ("1,000 feet for a non-precision instrument runway having a non-precision
  // instrument approach with visibility minimums as low as three-fourths of a
  // statute mile"), law.cornell.edu/cfr/text/14/77.19 fetch 2026-07-16. The
  // table previously encoded 250/500 ft.
  it('non_utility_non_precision_low primary is 1,000 ft total (500 half-width)', () => {
    expect(getPart77Surfaces('non_utility_non_precision_low').primary.criteria.halfWidth).toBe(500)
  })

  it('non_utility_precision primary is 1,000 ft total (500 half-width)', () => {
    expect(getPart77Surfaces('non_utility_precision').primary.criteria.halfWidth).toBe(500)
  })

  // ── Approach surface slopes per §77.19(d) ──

  it('visual approaches use 20:1 slope', () => {
    expect(getPart77Surfaces('utility_visual').approach.criteria.slope).toBe(20)
    expect(getPart77Surfaces('utility_non_precision').approach.criteria.slope).toBe(20)
    expect(getPart77Surfaces('non_utility_visual').approach.criteria.slope).toBe(20)
  })

  it('non-precision approaches use 34:1 slope', () => {
    expect(getPart77Surfaces('non_utility_non_precision_3_4').approach.criteria.slope).toBe(34)
    expect(getPart77Surfaces('non_utility_non_precision_low').approach.criteria.slope).toBe(34)
  })

  it('precision approach encodes both segments (50:1 first 10kft + 40:1 next 40kft)', () => {
    const c = getPart77Surfaces('non_utility_precision').approach.criteria
    expect(c.slope).toBe(50)
    expect(c.secondSegmentSlope).toBe(40)
    expect(c.segmentLength).toBe(10000)
    expect(c.length).toBe(50000)
  })

  // ── Approach surface lengths per §77.19(d) ──

  it('visual approaches are 5,000 ft long', () => {
    expect(getPart77Surfaces('utility_visual').approach.criteria.length).toBe(5000)
    expect(getPart77Surfaces('non_utility_visual').approach.criteria.length).toBe(5000)
  })

  it('non-precision approaches are 10,000 ft long', () => {
    expect(getPart77Surfaces('non_utility_non_precision_3_4').approach.criteria.length).toBe(10000)
    expect(getPart77Surfaces('non_utility_non_precision_low').approach.criteria.length).toBe(10000)
  })

  it('precision approach is 50,000 ft long total', () => {
    expect(getPart77Surfaces('non_utility_precision').approach.criteria.length).toBe(50000)
  })

  // ── Approach outer half-widths per §77.19(d) ──

  it('non_utility_non_precision_low outer half-width is 2,000 ft (4,000 ft total)', () => {
    expect(getPart77Surfaces('non_utility_non_precision_low').approach.criteria.outerHalfWidth).toBe(2000)
  })

  // Verified 3,500-ft end width (1,750-ft half-width) per 14 CFR §77.19(d),
  // law.cornell.edu/cfr/text/14/77.19 fetch 2026-07-16. The table previously
  // encoded 1,000/2,000 ft, which understated the surface footprint.
  it('non_utility_non_precision_3_4 outer half-width is 1,750 ft (3,500 ft total)', () => {
    expect(getPart77Surfaces('non_utility_non_precision_3_4').approach.criteria.outerHalfWidth).toBe(1750)
  })

  it('non_utility_precision outer half-width is 8,000 ft (16,000 ft total)', () => {
    expect(getPart77Surfaces('non_utility_precision').approach.criteria.outerHalfWidth).toBe(8000)
  })

  // ── Horizontal surface radius per §77.19(a) ──
  // Verified per 14 CFR §77.19(a): "The radius of each arc is: (1) 5,000 feet
  // for all runways designated as utility or visual; (2) 10,000 feet for all
  // other runways." — law.cornell.edu/cfr/text/14/77.19 fetch 2026-07-16.
  // non_utility_visual is a visual runway, so it takes the 5,000-ft arc
  // (the table previously grouped it with the 10,000-ft non-utility set).

  it('utility or visual runways use 5,000 ft horizontal radius', () => {
    expect(getPart77Surfaces('utility_visual').horizontal.criteria.radius).toBe(5000)
    expect(getPart77Surfaces('utility_non_precision').horizontal.criteria.radius).toBe(5000)
    expect(getPart77Surfaces('non_utility_visual').horizontal.criteria.radius).toBe(5000)
  })

  it('all other runways use 10,000 ft horizontal radius', () => {
    expect(getPart77Surfaces('non_utility_non_precision_3_4').horizontal.criteria.radius).toBe(10000)
    expect(getPart77Surfaces('non_utility_non_precision_low').horizontal.criteria.radius).toBe(10000)
    expect(getPart77Surfaces('non_utility_precision').horizontal.criteria.radius).toBe(10000)
  })

  it('all horizontal surfaces are 150 ft above airport elevation', () => {
    const types: FaaApproachType[] = [
      'utility_visual', 'utility_non_precision', 'non_utility_visual',
      'non_utility_non_precision_3_4', 'non_utility_non_precision_low', 'non_utility_precision',
    ]
    for (const t of types) {
      expect(getPart77Surfaces(t).horizontal.criteria.height).toBe(150)
    }
  })

  // ── Conical + transitional are constant across types ──

  it('conical surface is 20:1 slope / 4,000 ft horizontal extent for every approach type', () => {
    const types: FaaApproachType[] = [
      'utility_visual', 'utility_non_precision', 'non_utility_visual',
      'non_utility_non_precision_3_4', 'non_utility_non_precision_low', 'non_utility_precision',
    ]
    for (const t of types) {
      const c = getPart77Surfaces(t).conical.criteria
      expect(c.slope).toBe(20)
      expect(c.horizontalExtent).toBe(4000)
      expect(c.baseHeight).toBe(150)
    }
  })

  it('transitional surface is 7:1 slope for every approach type', () => {
    const types: FaaApproachType[] = [
      'utility_visual', 'utility_non_precision', 'non_utility_visual',
      'non_utility_non_precision_3_4', 'non_utility_non_precision_low', 'non_utility_precision',
    ]
    for (const t of types) {
      expect(getPart77Surfaces(t).transitional.criteria.slope).toBe(7)
    }
  })

  it('transitional primaryHalfWidth tracks the primary surface halfWidth', () => {
    // The transitional surface starts at the edge of the primary, so its
    // primaryHalfWidth must match. Utility-visual = 125, utility/non-utility
    // ≥¾ mi non-precision = 250, low-vis non-precision + precision = 500
    // (per §77.19(c)(3)(iii), fetch 2026-07-16).
    expect(getPart77Surfaces('utility_visual').transitional.criteria.primaryHalfWidth).toBe(125)
    expect(getPart77Surfaces('non_utility_non_precision_low').transitional.criteria.primaryHalfWidth).toBe(500)
    expect(getPart77Surfaces('non_utility_precision').transitional.criteria.primaryHalfWidth).toBe(500)
  })

  it('approach innerHalfWidth mirrors the primary halfWidth for every approach type', () => {
    // §77.19(d): "The inner edge of the approach surface is the same width as
    // the primary surface" — locks the mirror so a future primary-width edit
    // can't drift from the approach inner edge (or vice versa).
    const types: FaaApproachType[] = [
      'utility_visual', 'utility_non_precision', 'non_utility_visual',
      'non_utility_non_precision_3_4', 'non_utility_non_precision_low', 'non_utility_precision',
    ]
    for (const t of types) {
      const set = getPart77Surfaces(t)
      expect(set.approach.criteria.innerHalfWidth).toBe(set.primary.criteria.halfWidth)
      expect(set.transitional.criteria.primaryHalfWidth).toBe(set.primary.criteria.halfWidth)
    }
  })

  it('every surface cites 14 CFR §77.19 in every approach type', () => {
    const types: FaaApproachType[] = [
      'utility_visual', 'utility_non_precision', 'non_utility_visual',
      'non_utility_non_precision_3_4', 'non_utility_non_precision_low', 'non_utility_precision',
    ]
    for (const t of types) {
      for (const s of Object.values(getPart77Surfaces(t))) {
        expect(s.ufcRef).toMatch(/§77\.19/)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────
// getSurfaces dispatcher
// ─────────────────────────────────────────────────────────────

describe('getSurfaces(set, approachType)', () => {
  it('defaults to UFC', () => {
    expect(getSurfaces()).toBe(IMAGINARY_SURFACES)
  })

  it('returns UFC for ufc_3_260_01 regardless of approachType arg', () => {
    expect(getSurfaces('ufc_3_260_01', 'non_utility_precision')).toBe(IMAGINARY_SURFACES)
  })

  it('returns the per-type Part 77 set for faa_part77', () => {
    expect(getSurfaces('faa_part77', 'non_utility_precision'))
      .toBe(getPart77Surfaces('non_utility_precision'))
    expect(getSurfaces('faa_part77', 'utility_visual'))
      .toBe(getPart77Surfaces('utility_visual'))
  })

  it('defaults the approachType to non_utility_non_precision_low when not passed', () => {
    expect(getSurfaces('faa_part77'))
      .toBe(getPart77Surfaces('non_utility_non_precision_low'))
  })

  it('Part 77 differs from UFC numerically on shared surfaces', () => {
    // Approach slope: UFC 50:1, Part 77 (default LTU non-precision) 34:1
    expect(IMAGINARY_SURFACES.approach_departure.criteria.slope).toBe(50)
    expect(getPart77Surfaces('non_utility_non_precision_low').approach.criteria.slope).toBe(34)
    // Conical extent: UFC 7,000 ft, Part 77 4,000 ft
    expect(IMAGINARY_SURFACES.conical.criteria.horizontalExtent).toBe(7000)
    expect(getPart77Surfaces('non_utility_non_precision_low').conical.criteria.horizontalExtent).toBe(4000)
    // Primary half-width: UFC 1,000 ft, Part 77 default 500 ft (1,000 ft total
    // per §77.19(c)(3)(iii))
    expect(IMAGINARY_SURFACES.primary.criteria.halfWidth).toBe(1000)
    expect(getPart77Surfaces('non_utility_non_precision_low').primary.criteria.halfWidth).toBe(500)
  })
})
