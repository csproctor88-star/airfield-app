import { describe, it, expect } from 'vitest'
import {
  getAnnex14Criteria,
  ANNEX14_DEFAULT_VARIANT,
  M_TO_FT,
  type IcaoApproachClassification,
  type IcaoCodeNumber,
} from '@/lib/calculations/annex14-criteria'

// ─────────────────────────────────────────────────────────────
// ICAO Task 1 — annex14-criteria dimension locks.
//
// Every value is checked against docs/references/icao-annex14-verified.md
// (Tables 4-1, 4-2, 1-1) — the binding source. Metres stored as published.
// ─────────────────────────────────────────────────────────────

const approach = (c: IcaoApproachClassification, n: IcaoCodeNumber) => getAnnex14Criteria(c, n).approach
const conical = (c: IcaoApproachClassification, n: IcaoCodeNumber) => getAnnex14Criteria(c, n).conical
const innerH = (c: IcaoApproachClassification, n: IcaoCodeNumber) => getAnnex14Criteria(c, n).innerHorizontal
const trans = (c: IcaoApproachClassification, n: IcaoCodeNumber) => getAnnex14Criteria(c, n).transitional

// ── Table 4-1: CONICAL slope (5% all) + height ───────────────────────────────

describe('Table 4-1 conical', () => {
  it('slope is 5% in every column', () => {
    for (const [c, n] of [
      ['non_instrument', 1], ['non_instrument', 2], ['non_instrument', 3], ['non_instrument', 4],
      ['non_precision', 1], ['non_precision', 2], ['non_precision', 3], ['non_precision', 4],
      ['precision_cat_i', 1], ['precision_cat_i', 2], ['precision_cat_i', 3], ['precision_cat_i', 4],
      ['precision_cat_ii_iii', 3], ['precision_cat_ii_iii', 4],
    ] as [IcaoApproachClassification, IcaoCodeNumber][]) {
      expect(conical(c, n).slopePct).toBe(5)
    }
  })

  it('height per column (m)', () => {
    // Non-instrument NI-1..4: 35 / 55 / 75 / 100
    expect(conical('non_instrument', 1).heightM).toBe(35)
    expect(conical('non_instrument', 2).heightM).toBe(55)
    expect(conical('non_instrument', 3).heightM).toBe(75)
    expect(conical('non_instrument', 4).heightM).toBe(100)
    // Non-precision NP-1,2 / NP-3 / NP-4: 60 / 75 / 100
    expect(conical('non_precision', 1).heightM).toBe(60)
    expect(conical('non_precision', 2).heightM).toBe(60)
    expect(conical('non_precision', 3).heightM).toBe(75)
    expect(conical('non_precision', 4).heightM).toBe(100)
    // CAT I-1,2 / CAT I-3,4: 60 / 100
    expect(conical('precision_cat_i', 1).heightM).toBe(60)
    expect(conical('precision_cat_i', 2).heightM).toBe(60)
    expect(conical('precision_cat_i', 3).heightM).toBe(100)
    expect(conical('precision_cat_i', 4).heightM).toBe(100)
    // CAT II/III-3,4: 100
    expect(conical('precision_cat_ii_iii', 3).heightM).toBe(100)
    expect(conical('precision_cat_ii_iii', 4).heightM).toBe(100)
  })
})

// ── Table 4-1: INNER HORIZONTAL height (45 m all) + radius ────────────────────

describe('Table 4-1 inner horizontal', () => {
  it('height is 45 m in every column', () => {
    for (const [c, n] of [
      ['non_instrument', 1], ['non_precision', 4], ['precision_cat_i', 2], ['precision_cat_ii_iii', 3],
    ] as [IcaoApproachClassification, IcaoCodeNumber][]) {
      expect(innerH(c, n).heightM).toBe(45)
    }
  })

  it('radius per column (m)', () => {
    // Non-instrument NI-1..4: 2 000 / 2 500 / 4 000 / 4 000
    expect(innerH('non_instrument', 1).radiusM).toBe(2000)
    expect(innerH('non_instrument', 2).radiusM).toBe(2500)
    expect(innerH('non_instrument', 3).radiusM).toBe(4000)
    expect(innerH('non_instrument', 4).radiusM).toBe(4000)
    // Non-precision NP-1,2 / NP-3 / NP-4: 3 500 / 4 000 / 4 000
    expect(innerH('non_precision', 1).radiusM).toBe(3500)
    expect(innerH('non_precision', 2).radiusM).toBe(3500)
    expect(innerH('non_precision', 3).radiusM).toBe(4000)
    expect(innerH('non_precision', 4).radiusM).toBe(4000)
    // CAT I-1,2 / CAT I-3,4: 3 500 / 4 000
    expect(innerH('precision_cat_i', 1).radiusM).toBe(3500)
    expect(innerH('precision_cat_i', 3).radiusM).toBe(4000)
    // CAT II/III-3,4: 4 000
    expect(innerH('precision_cat_ii_iii', 4).radiusM).toBe(4000)
  })
})

// ── Table 4-1: APPROACH inner edge / distance / divergence ───────────────────

describe('Table 4-1 approach inner edge / distance / divergence', () => {
  it('length of inner edge (m)', () => {
    expect(approach('non_instrument', 1).innerEdgeM).toBe(60)
    expect(approach('non_instrument', 2).innerEdgeM).toBe(80)
    expect(approach('non_instrument', 3).innerEdgeM).toBe(150)
    expect(approach('non_instrument', 4).innerEdgeM).toBe(150)
    expect(approach('non_precision', 1).innerEdgeM).toBe(150)
    expect(approach('non_precision', 3).innerEdgeM).toBe(300)
    expect(approach('non_precision', 4).innerEdgeM).toBe(300)
    expect(approach('precision_cat_i', 1).innerEdgeM).toBe(150)
    expect(approach('precision_cat_i', 3).innerEdgeM).toBe(300)
    expect(approach('precision_cat_ii_iii', 3).innerEdgeM).toBe(300)
  })

  it('distance from threshold (m): 30 for NI-1, else 60', () => {
    expect(approach('non_instrument', 1).distFromThresholdM).toBe(30)
    expect(approach('non_instrument', 2).distFromThresholdM).toBe(60)
    expect(approach('non_precision', 1).distFromThresholdM).toBe(60)
    expect(approach('precision_cat_i', 4).distFromThresholdM).toBe(60)
    expect(approach('precision_cat_ii_iii', 4).distFromThresholdM).toBe(60)
  })

  it('divergence: 10% non-instrument, 15% non-precision & precision', () => {
    for (const n of [1, 2, 3, 4] as IcaoCodeNumber[]) {
      expect(approach('non_instrument', n).divergencePct).toBe(10)
    }
    expect(approach('non_precision', 1).divergencePct).toBe(15)
    expect(approach('non_precision', 4).divergencePct).toBe(15)
    expect(approach('precision_cat_i', 2).divergencePct).toBe(15)
    expect(approach('precision_cat_ii_iii', 3).divergencePct).toBe(15)
  })
})

// ── Table 4-1: APPROACH sections + total (piecewise slopes) ──────────────────

describe('Table 4-1 approach sections & totals', () => {
  it('non-instrument: single section, no printed total', () => {
    expect(approach('non_instrument', 1).sections).toEqual([{ lengthM: 1600, slopePct: 5 }])
    expect(approach('non_instrument', 1).totalLengthM).toBeNull()
    expect(approach('non_instrument', 2).sections).toEqual([{ lengthM: 2500, slopePct: 4 }])
    expect(approach('non_instrument', 3).sections).toEqual([{ lengthM: 3000, slopePct: 3.33 }])
    expect(approach('non_instrument', 4).sections).toEqual([{ lengthM: 3000, slopePct: 2.5 }])
    expect(approach('non_instrument', 4).totalLengthM).toBeNull()
  })

  it('non-precision code 1,2: single section 2 500 m @ 3.33%, no total', () => {
    expect(approach('non_precision', 1).sections).toEqual([{ lengthM: 2500, slopePct: 3.33 }])
    expect(approach('non_precision', 2).sections).toEqual([{ lengthM: 2500, slopePct: 3.33 }])
    expect(approach('non_precision', 1).totalLengthM).toBeNull()
  })

  it('non-precision code 3 & 4: three sections summing to 15 000 m', () => {
    const expected = [
      { lengthM: 3000, slopePct: 2 },
      { lengthM: 3600, slopePct: 2.5 },
      { lengthM: 8400, slopePct: 0 },
    ]
    expect(approach('non_precision', 3).sections).toEqual(expected)
    expect(approach('non_precision', 4).sections).toEqual(expected)
    expect(approach('non_precision', 4).totalLengthM).toBe(15000)
    const sum = expected.reduce((s, x) => s + x.lengthM, 0)
    expect(sum).toBe(15000)
  })

  it('CAT I code 1,2: NO horizontal section — 3 000 @ 2.5% then 12 000 @ 3%, total 15 000', () => {
    expect(approach('precision_cat_i', 1).sections).toEqual([
      { lengthM: 3000, slopePct: 2.5 },
      { lengthM: 12000, slopePct: 3 },
    ])
    expect(approach('precision_cat_i', 2).sections).toEqual([
      { lengthM: 3000, slopePct: 2.5 },
      { lengthM: 12000, slopePct: 3 },
    ])
    expect(approach('precision_cat_i', 1).totalLengthM).toBe(15000)
    // No slopePct-0 (horizontal) section in this column.
    expect(approach('precision_cat_i', 1).sections.some((s) => s.slopePct === 0)).toBe(false)
  })

  it('CAT I code 3,4 & CAT II/III code 3,4: three sections, total 15 000', () => {
    const expected = [
      { lengthM: 3000, slopePct: 2 },
      { lengthM: 3600, slopePct: 2.5 },
      { lengthM: 8400, slopePct: 0 },
    ]
    expect(approach('precision_cat_i', 3).sections).toEqual(expected)
    expect(approach('precision_cat_i', 4).sections).toEqual(expected)
    expect(approach('precision_cat_ii_iii', 3).sections).toEqual(expected)
    expect(approach('precision_cat_ii_iii', 4).sections).toEqual(expected)
    expect(approach('precision_cat_i', 3).totalLengthM).toBe(15000)
  })
})

// ── Table 4-1: TRANSITIONAL slope ────────────────────────────────────────────

describe('Table 4-1 transitional slope', () => {
  it('20% for NI-1,2 and NP-1,2; 14.3% otherwise', () => {
    expect(trans('non_instrument', 1).slopePct).toBe(20)
    expect(trans('non_instrument', 2).slopePct).toBe(20)
    expect(trans('non_instrument', 3).slopePct).toBe(14.3)
    expect(trans('non_instrument', 4).slopePct).toBe(14.3)
    expect(trans('non_precision', 1).slopePct).toBe(20)
    expect(trans('non_precision', 2).slopePct).toBe(20)
    expect(trans('non_precision', 3).slopePct).toBe(14.3)
    expect(trans('non_precision', 4).slopePct).toBe(14.3)
    expect(trans('precision_cat_i', 1).slopePct).toBe(14.3)
    expect(trans('precision_cat_i', 4).slopePct).toBe(14.3)
    expect(trans('precision_cat_ii_iii', 3).slopePct).toBe(14.3)
  })
})

// ── Table 4-2: TAKE-OFF CLIMB (by code number) ───────────────────────────────

describe('Table 4-2 take-off climb', () => {
  it('code 1', () => {
    const t = getAnnex14Criteria('non_instrument', 1).takeoffClimb
    expect(t).toEqual({ innerEdgeM: 60, distFromEndM: 30, divergencePct: 10, finalWidthM: 380, lengthM: 1600, slopePct: 5 })
  })
  it('code 2', () => {
    const t = getAnnex14Criteria('non_instrument', 2).takeoffClimb
    expect(t).toEqual({ innerEdgeM: 80, distFromEndM: 60, divergencePct: 10, finalWidthM: 580, lengthM: 2500, slopePct: 4 })
  })
  it('code 3 and 4 share the 1 200 m / 15 000 m / 2% column', () => {
    const expected = { innerEdgeM: 180, distFromEndM: 60, divergencePct: 12.5, finalWidthM: 1200, lengthM: 15000, slopePct: 2 }
    expect(getAnnex14Criteria('non_precision', 3).takeoffClimb).toEqual(expected)
    expect(getAnnex14Criteria('precision_cat_ii_iii', 4).takeoffClimb).toEqual(expected)
  })
  it('take-off climb depends only on code number, not classification', () => {
    expect(getAnnex14Criteria('non_instrument', 4).takeoffClimb)
      .toEqual(getAnnex14Criteria('precision_cat_i', 4).takeoffClimb)
  })
})

// ── Invalid combinations throw ───────────────────────────────────────────────

describe('getAnnex14Criteria invalid combos', () => {
  it('CAT II/III with code 1 or 2 throws (not a Table 4-1 column)', () => {
    expect(() => getAnnex14Criteria('precision_cat_ii_iii', 1)).toThrow(/CAT II\/III/)
    expect(() => getAnnex14Criteria('precision_cat_ii_iii', 2)).toThrow()
  })
  it('CAT II/III with code 3 or 4 resolves', () => {
    expect(() => getAnnex14Criteria('precision_cat_ii_iii', 3)).not.toThrow()
    expect(() => getAnnex14Criteria('precision_cat_ii_iii', 4)).not.toThrow()
  })
})

// ── Metre storage + single conversion factor ─────────────────────────────────

describe('metre storage & M_TO_FT', () => {
  it('M_TO_FT is the published 3.28084 factor', () => {
    expect(M_TO_FT).toBe(3.28084)
  })
  it('criteria are stored in metres as published (not pre-converted feet)', () => {
    // 4 000 m inner-horizontal radius, NOT ~13 123 ft.
    expect(innerH('non_precision', 4).radiusM).toBe(4000)
    // 15 000 m total, NOT ~49 213 ft.
    expect(approach('non_precision', 4).totalLengthM).toBe(15000)
  })
  it('ANNEX14_DEFAULT_VARIANT is non-precision code 4', () => {
    expect(ANNEX14_DEFAULT_VARIANT).toEqual({ classification: 'non_precision', codeNumber: 4 })
  })
})
