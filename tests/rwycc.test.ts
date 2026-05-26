import { describe, it, expect } from 'vitest'
import {
  deriveRwycc,
  buildFiconNotamText,
  CONTAMINANT_LABELS,
  CONTAMINANT_ORDER,
  TREATMENT_LABELS,
  rwyccColor,
  rwyccDescriptor,
  type Contaminant,
} from '@/lib/calculations/rwycc'

// ─────────────────────────────────────────────────────────────
// deriveRwycc — AC 150/5200-30D Table 4-1
// ─────────────────────────────────────────────────────────────

describe('deriveRwycc', () => {
  it('dry runway → 6 (best)', () => {
    expect(deriveRwycc({ contaminant: 'dry' })).toBe(6)
  })

  it('frost → 5', () => {
    expect(deriveRwycc({ contaminant: 'frost' })).toBe(5)
  })

  // Wet — depth threshold at 1/8 in
  it('wet ≤ 1/8 in → 5 (essentially dry)', () => {
    expect(deriveRwycc({ contaminant: 'wet', depthInches: 0.0 })).toBe(5)
    expect(deriveRwycc({ contaminant: 'wet', depthInches: 0.125 })).toBe(5)
  })

  it('wet > 1/8 in → 3 (standing water)', () => {
    expect(deriveRwycc({ contaminant: 'wet', depthInches: 0.25 })).toBe(3)
  })

  it('wet > 1/2 in → 2 (deep standing water)', () => {
    expect(deriveRwycc({ contaminant: 'wet', depthInches: 0.75 })).toBe(2)
  })

  // Slush
  it('slush ≤ 1/2 in → 3', () => {
    expect(deriveRwycc({ contaminant: 'slush', depthInches: 0.25 })).toBe(3)
  })

  it('slush > 1/2 in → 2', () => {
    expect(deriveRwycc({ contaminant: 'slush', depthInches: 0.75 })).toBe(2)
  })

  it('slippery_when_wet → 3', () => {
    expect(deriveRwycc({ contaminant: 'slippery_when_wet' })).toBe(3)
  })

  // Dry snow — 1 inch threshold
  it('dry_snow ≤ 1 in → 4', () => {
    expect(deriveRwycc({ contaminant: 'dry_snow', depthInches: 0.5 })).toBe(4)
    expect(deriveRwycc({ contaminant: 'dry_snow', depthInches: 1.0 })).toBe(4)
  })

  it('dry_snow > 1 in → 3', () => {
    expect(deriveRwycc({ contaminant: 'dry_snow', depthInches: 2.5 })).toBe(3)
  })

  // Wet snow — 1 inch threshold
  it('wet_snow ≤ 1 in → 3', () => {
    expect(deriveRwycc({ contaminant: 'wet_snow', depthInches: 1 })).toBe(3)
  })

  it('wet_snow > 1 in → 2', () => {
    expect(deriveRwycc({ contaminant: 'wet_snow', depthInches: 1.5 })).toBe(2)
  })

  // Compacted snow — temperature-dependent
  it('compacted_snow at < -15°C → 4', () => {
    expect(deriveRwycc({ contaminant: 'compacted_snow', temperatureC: -20 })).toBe(4)
  })

  it('compacted_snow at -15 to -3°C → 3', () => {
    expect(deriveRwycc({ contaminant: 'compacted_snow', temperatureC: -10 })).toBe(3)
    expect(deriveRwycc({ contaminant: 'compacted_snow', temperatureC: -3.5 })).toBe(3)
  })

  it('compacted_snow at > -3°C → 2 (slick)', () => {
    expect(deriveRwycc({ contaminant: 'compacted_snow', temperatureC: 0 })).toBe(2)
    expect(deriveRwycc({ contaminant: 'compacted_snow', temperatureC: -2.9 })).toBe(2)
  })

  it('compacted_snow with no temperature → conservative 3', () => {
    expect(deriveRwycc({ contaminant: 'compacted_snow' })).toBe(3)
  })

  // Ice tiers
  it('ice_patches → 3', () => {
    expect(deriveRwycc({ contaminant: 'ice_patches' })).toBe(3)
  })

  it('ice → 1 (poor)', () => {
    expect(deriveRwycc({ contaminant: 'ice' })).toBe(1)
  })

  it('wet_ice → 0 (nil)', () => {
    expect(deriveRwycc({ contaminant: 'wet_ice' })).toBe(0)
  })

  it('water_on_compacted_snow → 0', () => {
    expect(deriveRwycc({ contaminant: 'water_on_compacted_snow' })).toBe(0)
  })

  it('slush_on_ice → 0', () => {
    expect(deriveRwycc({ contaminant: 'slush_on_ice' })).toBe(0)
  })

  it('covers all 13 Table 4-1 contaminants', () => {
    // Sanity that nothing throws / returns undefined for the documented set
    for (const c of CONTAMINANT_ORDER) {
      const v = deriveRwycc({ contaminant: c, depthInches: 0.5, temperatureC: -10 })
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(6)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// buildFiconNotamText — AC 30D §6 format
// ─────────────────────────────────────────────────────────────

describe('buildFiconNotamText', () => {
  it('all-wet single-contaminant — no depth, no treatments', () => {
    const text = buildFiconNotamText({
      runwayDesignator: '13/31',
      thirds: [
        { third: 'touchdown', contaminant: 'wet', coveragePercent: 100, rwycc: 5 },
        { third: 'midpoint',  contaminant: 'wet', coveragePercent: 100, rwycc: 5 },
        { third: 'rollout',   contaminant: 'wet', coveragePercent: 100, rwycc: 5 },
      ],
      treatments: [],
    })
    expect(text).toBe('RWY 13/31 5/5/5 100/100/100 PCT WET')
  })

  it('uniform compacted snow + plowed + sanded — single token, depth, treatments', () => {
    const text = buildFiconNotamText({
      runwayDesignator: '06L/24R',
      thirds: [
        { third: 'touchdown', contaminant: 'compacted_snow', coveragePercent: 80,  depthInches: 2, rwycc: 3 },
        { third: 'midpoint',  contaminant: 'compacted_snow', coveragePercent: 100, depthInches: 2, rwycc: 3 },
        { third: 'rollout',   contaminant: 'compacted_snow', coveragePercent: 100, depthInches: 2, rwycc: 2 },
      ],
      treatments: ['plowed', 'sanded'],
    })
    expect(text).toBe('RWY 06L/24R 3/3/2 80/100/100 PCT COMPACTED SN 2IN TRTD W/PLOW W/SAND')
  })

  it('mixed-contaminant thirds — lists each distinct contaminant in TD order', () => {
    const text = buildFiconNotamText({
      runwayDesignator: '09/27',
      thirds: [
        { third: 'touchdown', contaminant: 'wet',            coveragePercent: 100, rwycc: 5 },
        { third: 'midpoint',  contaminant: 'dry_snow',       coveragePercent: 100, depthInches: 1.5, rwycc: 3 },
        { third: 'rollout',   contaminant: 'compacted_snow', coveragePercent: 100, depthInches: 1.5, rwycc: 2 },
      ],
      treatments: ['plowed', 'chemically_treated'],
    })
    expect(text).toBe('RWY 09/27 5/3/2 100/100/100 PCT WET DRY SN COMPACTED SN 1.5IN TRTD W/PLOW W/CHEM')
  })

  it('treatments: none → no TRTD suffix', () => {
    const text = buildFiconNotamText({
      runwayDesignator: '13/31',
      thirds: [
        { third: 'touchdown', contaminant: 'frost', coveragePercent: 100, rwycc: 5 },
        { third: 'midpoint',  contaminant: 'frost', coveragePercent: 100, rwycc: 5 },
        { third: 'rollout',   contaminant: 'frost', coveragePercent: 100, rwycc: 5 },
      ],
      treatments: ['none'],
    })
    expect(text).toBe('RWY 13/31 5/5/5 100/100/100 PCT FROST')
  })

  it('depth formatting drops trailing zeros (1.5IN not 1.50IN)', () => {
    const text = buildFiconNotamText({
      runwayDesignator: '13/31',
      thirds: [
        { third: 'touchdown', contaminant: 'wet_snow', coveragePercent: 100, depthInches: 1.5, rwycc: 2 },
        { third: 'midpoint',  contaminant: 'wet_snow', coveragePercent: 100, depthInches: 1.5, rwycc: 2 },
        { third: 'rollout',   contaminant: 'wet_snow', coveragePercent: 100, depthInches: 1.5, rwycc: 2 },
      ],
      treatments: [],
    })
    expect(text).toContain('1.5IN')
    expect(text).not.toContain('1.50IN')
  })

  it('integer depths render without decimal (2IN not 2.0IN)', () => {
    const text = buildFiconNotamText({
      runwayDesignator: '13/31',
      thirds: [
        { third: 'touchdown', contaminant: 'dry_snow', coveragePercent: 100, depthInches: 2, rwycc: 3 },
        { third: 'midpoint',  contaminant: 'dry_snow', coveragePercent: 100, depthInches: 2, rwycc: 3 },
        { third: 'rollout',   contaminant: 'dry_snow', coveragePercent: 100, depthInches: 2, rwycc: 3 },
      ],
      treatments: [],
    })
    expect(text).toContain(' 2IN')
    expect(text).not.toContain('2.0IN')
  })

  it('uses the deepest third for the depth token (worst case)', () => {
    const text = buildFiconNotamText({
      runwayDesignator: '13/31',
      thirds: [
        { third: 'touchdown', contaminant: 'wet_snow', coveragePercent: 100, depthInches: 0.5, rwycc: 3 },
        { third: 'midpoint',  contaminant: 'wet_snow', coveragePercent: 100, depthInches: 1.0, rwycc: 3 },
        { third: 'rollout',   contaminant: 'wet_snow', coveragePercent: 100, depthInches: 2.5, rwycc: 2 },
      ],
      treatments: [],
    })
    expect(text).toContain(' 2.5IN')
  })

  it('sorts out-of-order thirds defensively', () => {
    const text = buildFiconNotamText({
      runwayDesignator: '13/31',
      thirds: [
        { third: 'rollout',   contaminant: 'wet', coveragePercent: 80,  rwycc: 3 },
        { third: 'touchdown', contaminant: 'wet', coveragePercent: 100, rwycc: 5 },
        { third: 'midpoint',  contaminant: 'wet', coveragePercent: 90,  rwycc: 4 },
      ],
      treatments: [],
    })
    expect(text).toBe('RWY 13/31 5/4/3 100/90/80 PCT WET')
  })
})

// ─────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────

describe('display helpers', () => {
  it('CONTAMINANT_LABELS has human-readable labels for all 13 keys', () => {
    expect(Object.keys(CONTAMINANT_LABELS).length).toBe(13)
    for (const label of Object.values(CONTAMINANT_LABELS)) {
      expect(label).not.toMatch(/_/) // no snake_case in display
    }
  })

  it('TREATMENT_LABELS has labels for all 7 keys', () => {
    expect(Object.keys(TREATMENT_LABELS).length).toBe(7)
    for (const label of Object.values(TREATMENT_LABELS)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('rwyccColor returns danger for 0/1, warning for 2/3, success for 4/5/6', () => {
    expect(rwyccColor(0)).toContain('danger')
    expect(rwyccColor(1)).toContain('danger')
    expect(rwyccColor(2)).toContain('warning')
    expect(rwyccColor(3)).toContain('warning')
    expect(rwyccColor(4)).toContain('success')
    expect(rwyccColor(5)).toContain('success')
    expect(rwyccColor(6)).toContain('success')
  })

  it('rwyccDescriptor returns AC 30D §4 labels', () => {
    expect(rwyccDescriptor(6)).toBe('Dry')
    expect(rwyccDescriptor(3)).toBe('Medium')
    expect(rwyccDescriptor(0)).toContain('Nil')
  })
})
