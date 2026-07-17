import { describe, it, expect } from 'vitest'
import {
  filterDrivingChecks,
  distinctCheckers,
  checkerKey,
  type DrivingCheckWithResults,
} from '@/lib/supabase/driving-checks'

let seq = 0
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
    overall_result: 'pass',
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

describe('checkerKey', () => {
  it('keys on operating initials when present', () => {
    expect(checkerKey({ completed_by_oi: 'ABC', completed_by_name: 'SSgt Smith' })).toBe('ABC')
  })
  it('falls back to a name-prefixed key when no initials', () => {
    expect(checkerKey({ completed_by_oi: null, completed_by_name: 'Contractor Doe' })).toBe('name:Contractor Doe')
    expect(checkerKey({ completed_by_oi: null, completed_by_name: null })).toBe('name:Unknown')
  })
})

describe('filterDrivingChecks', () => {
  const checks = [
    makeCheck({ overall_result: 'pass', completed_by_oi: 'ABC' }),
    makeCheck({ overall_result: 'discrepancy', completed_by_oi: 'ABC' }),
    makeCheck({ overall_result: 'violation', completed_by_oi: 'XYZ' }),
  ]

  it('returns everything when both filters are "all"', () => {
    expect(filterDrivingChecks(checks, { result: 'all', checker: 'all' })).toHaveLength(3)
  })

  it('filters by result', () => {
    const out = filterDrivingChecks(checks, { result: 'violation', checker: 'all' })
    expect(out).toHaveLength(1)
    expect(out[0].overall_result).toBe('violation')
  })

  it('filters by checker key', () => {
    const out = filterDrivingChecks(checks, { result: 'all', checker: 'ABC' })
    expect(out).toHaveLength(2)
    expect(out.every(c => c.completed_by_oi === 'ABC')).toBe(true)
  })

  it('combines result and checker filters', () => {
    const out = filterDrivingChecks(checks, { result: 'discrepancy', checker: 'ABC' })
    expect(out).toHaveLength(1)
    expect(out[0].overall_result).toBe('discrepancy')
  })
})

describe('distinctCheckers', () => {
  it('collapses a name-snapshot change under one initials key and sorts by label', () => {
    const checks = [
      makeCheck({ completed_by_oi: 'XYZ', completed_by_name: 'A1C Jones' }),
      makeCheck({ completed_by_oi: 'ABC', completed_by_name: 'SSgt Smith' }),
      makeCheck({ completed_by_oi: 'ABC', completed_by_name: 'TSgt Smith' }),
    ]
    const opts = distinctCheckers(checks)
    expect(opts).toHaveLength(2)
    // First-seen label kept; sorted alphabetically by label.
    expect(opts.map(o => o.key)).toEqual(['XYZ', 'ABC'])
    expect(opts[0].label).toBe('A1C Jones (XYZ)')
    expect(opts[1].label).toBe('SSgt Smith (ABC)')
  })

  it('labels an initials-less checker by name', () => {
    const opts = distinctCheckers([makeCheck({ completed_by_oi: null, completed_by_name: 'Contractor Doe' })])
    expect(opts).toEqual([{ key: 'name:Contractor Doe', label: 'Contractor Doe' }])
  })
})
