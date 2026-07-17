import { describe, it, expect } from 'vitest'
import {
  computeAobStats,
  type DrivingCheckWithResults,
  type DrivingCheckResultRow,
  type DrivingCheckResult,
} from '@/lib/supabase/driving-checks'

let seq = 0
function makeResult(
  overrides: Partial<DrivingCheckResultRow> & { item_label: string; status: DrivingCheckResultRow['status'] },
): DrivingCheckResultRow {
  seq += 1
  return {
    id: `r${seq}`,
    check_id: 'c1',
    item_id: null,
    notes: null,
    sort_order: 0,
    created_at: '2026-07-17T12:00:00Z',
    ...overrides,
  }
}

function makeCheck(overrides: Partial<DrivingCheckWithResults> = {}): DrivingCheckWithResults {
  seq += 1
  return {
    id: `c${seq}`,
    base_id: 'b1',
    checked_at: '2026-07-17T12:00:00Z',
    driver_name: 'Snuffy',
    driver_rank: 'SSgt',
    driver_unit: '100 ARW/SE',
    driver_office_symbol: null,
    driver_phone: null,
    contractor_id: null,
    form_483_status: 'valid',
    form_483_expires: null,
    vehicle_type: null,
    vehicle_id: null,
    pov_pass_number: null,
    location: 'Taxiway A',
    overall_result: 'pass' as DrivingCheckResult,
    violation_description: null,
    notes: null,
    completed_by: null,
    completed_by_oi: null,
    completed_by_name: null,
    created_at: '2026-07-17T12:00:00Z',
    updated_at: '2026-07-17T12:00:00Z',
    results: [],
    ...overrides,
  }
}

describe('computeAobStats', () => {
  it('returns zeroed totals and a null passRate for an empty period', () => {
    const stats = computeAobStats([])
    expect(stats).toEqual({
      total: 0,
      passRate: null,
      discrepancyCount: 0,
      violationCount: 0,
      commonDiscrepancies: [],
      byChecker: [],
    })
  })

  it('computes pass-rate math and per-result counts across a mixed period', () => {
    const checks = [
      makeCheck({ overall_result: 'pass' }),
      makeCheck({ overall_result: 'pass' }),
      makeCheck({ overall_result: 'discrepancy' }),
      makeCheck({ overall_result: 'violation' }),
    ]
    const stats = computeAobStats(checks)
    expect(stats.total).toBe(4)
    expect(stats.passRate).toBe(0.5)
    expect(stats.discrepancyCount).toBe(1)
    expect(stats.violationCount).toBe(1)
  })

  it('ranks common discrepancies desc by count, tiebreaking alphabetically by label', () => {
    const checks = [
      makeCheck({ results: [makeResult({ item_label: 'A', status: 'discrepancy' })] }),
      makeCheck({ results: [makeResult({ item_label: 'A', status: 'discrepancy' })] }),
      makeCheck({ results: [makeResult({ item_label: 'A', status: 'discrepancy' })] }),
      makeCheck({ results: [makeResult({ item_label: 'B', status: 'discrepancy' })] }),
      makeCheck({ results: [makeResult({ item_label: 'B', status: 'discrepancy' })] }),
      makeCheck({ results: [makeResult({ item_label: 'D', status: 'discrepancy' })] }),
      makeCheck({ results: [makeResult({ item_label: 'C', status: 'discrepancy' })] }),
      // A 'pass' status row must not count toward the discrepancy tally.
      makeCheck({ results: [makeResult({ item_label: 'Z', status: 'pass' })] }),
    ]
    const stats = computeAobStats(checks)
    expect(stats.commonDiscrepancies).toEqual([
      { label: 'A', count: 3 },
      { label: 'B', count: 2 },
      { label: 'C', count: 1 }, // tie with D at count 1 — alphabetical tiebreak
      { label: 'D', count: 1 },
    ])
  })

  it('groups by-checker by operating initials across a name-snapshot change (e.g. a promotion)', () => {
    const checks = [
      makeCheck({ completed_by_oi: 'ABC', completed_by_name: 'SSgt Smith', overall_result: 'pass' }),
      makeCheck({ completed_by_oi: 'ABC', completed_by_name: 'TSgt Smith', overall_result: 'violation' }),
      makeCheck({ completed_by_oi: 'XYZ', completed_by_name: 'A1C Jones', overall_result: 'pass' }),
    ]
    const stats = computeAobStats(checks)
    expect(stats.byChecker).toHaveLength(2)
    const abc = stats.byChecker.find((c) => c.oi === 'ABC')
    expect(abc).toEqual({ name: 'TSgt Smith', oi: 'ABC', total: 2, passRate: 0.5, violations: 1 })
    const xyz = stats.byChecker.find((c) => c.oi === 'XYZ')
    expect(xyz).toEqual({ name: 'A1C Jones', oi: 'XYZ', total: 1, passRate: 1, violations: 0 })
  })

  it('falls back to the name snapshot when no operating initials were recorded', () => {
    const checks = [
      makeCheck({ completed_by_oi: null, completed_by_name: 'Contractor Doe', overall_result: 'pass' }),
      makeCheck({ completed_by_oi: null, completed_by_name: 'Contractor Doe', overall_result: 'pass' }),
    ]
    const stats = computeAobStats(checks)
    expect(stats.byChecker).toEqual([
      { name: 'Contractor Doe', oi: null, total: 2, passRate: 1, violations: 0 },
    ])
  })

  it('gives a checker a 0 (not null) passRate when none of their checks passed', () => {
    const checks = [makeCheck({ completed_by_oi: 'ABC', overall_result: 'discrepancy' })]
    const stats = computeAobStats(checks)
    expect(stats.byChecker[0].total).toBe(1)
    expect(stats.byChecker[0].passRate).toBe(0)
  })
})
