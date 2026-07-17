import { describe, it, expect, vi } from 'vitest'
import {
  SURFACE_CRITERIA,
  getSurfaceCriteria,
} from '@/lib/calculations/surface-criteria'

// ─────────────────────────────────────────────────────────────
// UFC 3-260-01 (Change 3, 4 Feb 2026) surface-criteria dimension locks.
//
// Every number below is transcribed from Table 3-7 / Table 3-5 / Table 3-6
// or the class-invariant glossary, as verified in
// docs/references/ufc-3-260-01-table3-7-verified.md (owner rulings 2026-07-16).
// Mirrors the dimension-locking style of tests/part77-surfaces.test.ts:
// a future edit that drifts any value from the publication trips a named test.
// ─────────────────────────────────────────────────────────────

describe('SURFACE_CRITERIA registry', () => {
  it('registers exactly Class A, Class B, and Army Class B', () => {
    expect(Object.keys(SURFACE_CRITERIA).sort()).toEqual(['A', 'Army_B', 'B'])
  })
})

// ── Fix 1 (SSE final review): the graded area is a portion OF the clear zone,
// so it can never be reported wider than the clear zone that contains it. This
// locks the consistency bound for every registered class.
describe('graded-area ⊆ clear-zone invariant', () => {
  it('graded_area.halfWidth <= clear_zone.halfWidth for every class', () => {
    for (const [cls, c] of Object.entries(SURFACE_CRITERIA)) {
      expect(
        c.graded_area.halfWidth,
        `${cls}: graded area (${c.graded_area.halfWidth}) exceeds clear zone (${c.clear_zone.halfWidth})`,
      ).toBeLessThanOrEqual(c.clear_zone.halfWidth)
    }
  })
})

// ── Class B (Air Force) — Table 3-7 "Class B (VFR and IFR)" column ──
describe('Class B (Air Force) — Table 3-7', () => {
  const B = getSurfaceCriteria('B')

  it('clear zone is 3,000 ft × 3,000 ft (Table 3-5 AF)', () => {
    expect(B.clear_zone).toEqual({ halfWidth: 1500, length: 3000, maxHeight: 0 })
  })

  it('graded area carried unverified from Class B (do-not-touch)', () => {
    expect(B.graded_area).toEqual({ halfWidth: 1500, length: 1000, maxHeight: 0 })
  })

  it('primary surface is 2,000 ft wide, +200 ft each end (item 1: AF/Navy/USMC 2,000 ft)', () => {
    expect(B.primary).toEqual({ halfWidth: 1000, extension: 200, maxHeight: 0 })
  })

  it('ADCS: 50:1, start 2,000 ft, end 16,000 ft, 50,000 ft, level-off 500 ft above EAE (items 6–11)', () => {
    // slope 50:1 (item 7); innerHalfWidth 1,000 = 2,000-ft start width (item 8);
    // outerHalfWidth 8,000 = 16,000-ft end width (item 10); length 50,000 ft
    // (item 6, C3 marker); horizontalElevation 500 ft above EAE (item 11).
    expect(B.approach_departure).toEqual({
      slope: 50,
      innerHalfWidth: 1000,
      outerHalfWidth: 8000,
      length: 50000,
      horizontalElevation: 500,
    })
  })

  it('inner horizontal is 150 ft at 7,500-ft radius (item 12 — NOT the old 13,120 ICAO value)', () => {
    expect(B.inner_horizontal).toEqual({ height: 150, radius: 7500 })
  })

  it('conical is 20:1 over 7,000 ft from 150-ft base (glossary, class-invariant)', () => {
    expect(B.conical).toEqual({ slope: 20, horizontalExtent: 7000, baseHeight: 150 })
  })

  it('outer horizontal is 500 ft at 44,500-ft radius (glossary: 30,000 ft beyond conical periphery)', () => {
    // periphery = inner-horizontal 7,500 + conical 7,000 = 14,500; +30,000 = 44,500
    expect(B.outer_horizontal).toEqual({ height: 500, radius: 44500 })
  })

  it('transitional is 7:1 rising from the 1,000-ft primary edge (item 15)', () => {
    expect(B.transitional).toEqual({ slope: 7, primaryHalfWidth: 1000 })
  })

  it('APZ I / II carried from Class B (DoDI 4165.57)', () => {
    expect(B.apz_i).toEqual({ halfWidth: 1500, length: 5000, startOffset: 3000 })
    expect(B.apz_ii).toEqual({ halfWidth: 1500, length: 7000, startOffset: 8000 })
  })
})

// ── Army Class B — Table 3-7 Army rows (narrower primary/clear-zone/APZ) ──
describe('Army Class B — Table 3-7 Army rows', () => {
  const A = getSurfaceCriteria('Army_B')

  it('primary surface is 1,000 ft wide (item 1: Army 1,000 ft → 500-ft half-width)', () => {
    expect(A.primary).toEqual({ halfWidth: 500, extension: 200, maxHeight: 0 })
  })

  it('ADCS starts at the 1,000-ft Army width (item 8) but shares AF slope/end/length/level-off', () => {
    expect(A.approach_departure).toEqual({
      slope: 50,
      innerHalfWidth: 500,
      outerHalfWidth: 8000,
      length: 50000,
      horizontalElevation: 500,
    })
  })

  it('transitional rises from the 500-ft Army primary edge (item 15)', () => {
    expect(A.transitional).toEqual({ slope: 7, primaryHalfWidth: 500 })
  })

  it('clear zone is 1,000 ft wide (Table 3-5 Army → 500-ft half-width)', () => {
    expect(A.clear_zone).toEqual({ halfWidth: 500, length: 3000, maxHeight: 0 })
  })

  it('APZ I / II are 1,000 ft wide (Table 3-6 Army → 500-ft half-width)', () => {
    expect(A.apz_i).toEqual({ halfWidth: 500, length: 5000, startOffset: 3000 })
    expect(A.apz_ii).toEqual({ halfWidth: 500, length: 7000, startOffset: 8000 })
  })

  it('graded area clamped to the Army clear-zone half-width (consistency bound, not an invented value)', () => {
    // Fix 1 (SSE final review): 1,500 contradicted the 500-ft Army clear zone.
    // The graded area is a portion OF the clear zone, so it can never be wider;
    // clamped to 500 pending owner verification of the true Army graded-area width.
    expect(A.graded_area).toEqual({ halfWidth: 500, length: 1000, maxHeight: 0 })
  })
})

// ── Class A (Air Force / Army, IFR column) — Table 3-7 "Class A IFR" ──
describe('Class A (IFR) — Table 3-7', () => {
  const A = getSurfaceCriteria('A')

  it('clear zone is 3,000 ft × 3,000 ft (Table 3-5 AF width row)', () => {
    expect(A.clear_zone).toEqual({ halfWidth: 1500, length: 3000, maxHeight: 0 })
  })

  it('primary surface is 1,000 ft wide, +200 ft each end (items 1–2)', () => {
    expect(A.primary).toEqual({ halfWidth: 500, extension: 200, maxHeight: 0 })
  })

  it('ADCS: 40:1, start 1,000 ft, end 16,000 ft, 50,000 ft, level-off 500 ft above EAE (items 6–11 IFR)', () => {
    // slope 40:1 (item 7 IFR); innerHalfWidth 500 = 1,000-ft start (item 8);
    // outerHalfWidth 8,000 = 16,000-ft end (item 10); length 50,000 ft
    // (owner-confirmed constant-splay total); horizontalElevation 500 (item 11).
    expect(A.approach_departure).toEqual({
      slope: 40,
      innerHalfWidth: 500,
      outerHalfWidth: 8000,
      length: 50000,
      horizontalElevation: 500,
    })
  })

  it('inner horizontal is 150 ft at 7,500-ft radius (items 12–14)', () => {
    expect(A.inner_horizontal).toEqual({ height: 150, radius: 7500 })
  })

  it('transitional is 7:1 from the 500-ft primary edge (item 15)', () => {
    expect(A.transitional).toEqual({ slope: 7, primaryHalfWidth: 500 })
  })

  it('APZ I / II are Class A geometry (2,500-ft lengths, APZ II offset = 3,000 + 2,500)', () => {
    expect(A.apz_i).toEqual({ halfWidth: 1500, length: 2500, startOffset: 3000 })
    expect(A.apz_ii).toEqual({ halfWidth: 1500, length: 2500, startOffset: 5500 })
  })
})

// ── Class-invariant surfaces and the Army/AF width splits ──
describe('class-invariance and Army/AF splits', () => {
  const A = getSurfaceCriteria('A')
  const B = getSurfaceCriteria('B')
  const Army = getSurfaceCriteria('Army_B')

  it('conical is identical across A / B / Army_B (glossary, class-invariant)', () => {
    expect(A.conical).toEqual(B.conical)
    expect(Army.conical).toEqual(B.conical)
  })

  it('outer horizontal is identical across A / B / Army_B (glossary, class-invariant)', () => {
    expect(A.outer_horizontal).toEqual(B.outer_horizontal)
    expect(Army.outer_horizontal).toEqual(B.outer_horizontal)
  })

  it('inner horizontal (7,500-ft radius) is identical across A / B / Army_B', () => {
    expect(A.inner_horizontal).toEqual(B.inner_horizontal)
    expect(Army.inner_horizontal).toEqual(B.inner_horizontal)
  })

  it('primary half-width: A 500, Army_B 500, B 1,000', () => {
    expect(A.primary.halfWidth).toBe(500)
    expect(Army.primary.halfWidth).toBe(500)
    expect(B.primary.halfWidth).toBe(1000)
  })

  it('clear-zone half-width: Army_B 500 vs A/B 1,500', () => {
    expect(Army.clear_zone.halfWidth).toBe(500)
    expect(A.clear_zone.halfWidth).toBe(1500)
    expect(B.clear_zone.halfWidth).toBe(1500)
  })

  it('APZ half-width: Army_B 500 vs A/B 1,500', () => {
    expect(Army.apz_i.halfWidth).toBe(500)
    expect(Army.apz_ii.halfWidth).toBe(500)
    expect(A.apz_i.halfWidth).toBe(1500)
    expect(B.apz_i.halfWidth).toBe(1500)
  })
})

// ── getSurfaceCriteria fallback behavior ──
describe('getSurfaceCriteria', () => {
  it("returns Class A for 'A' without a fallback warning", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = getSurfaceCriteria('A')
    expect(a).toBe(SURFACE_CRITERIA.A)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('falls back to Class B (with a warning) for an unknown class', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const c = getSurfaceCriteria('Z')
    expect(c).toBe(SURFACE_CRITERIA.B)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
