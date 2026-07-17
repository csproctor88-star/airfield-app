import { describe, it, expect } from 'vitest'
import {
  summarizeDrivingCheck,
  type DrivingCheckWithResults,
  type DrivingCheckResultRow,
} from '@/lib/supabase/driving-checks'

function makeResult(
  overrides: Partial<DrivingCheckResultRow> & { item_label: string; status: DrivingCheckResultRow['status'] },
): DrivingCheckResultRow {
  return {
    id: 'r1',
    check_id: 'c1',
    item_id: null,
    notes: null,
    sort_order: 0,
    created_at: '2026-07-17T12:00:00Z',
    ...overrides,
  }
}

function makeCheck(overrides: Partial<DrivingCheckWithResults> = {}): DrivingCheckWithResults {
  return {
    id: 'c1',
    base_id: 'b1',
    checked_at: '2026-07-17T12:00:00Z',
    driver_name: 'Snuffy',
    driver_rank: 'SSgt',
    driver_unit: '100 ARW/SE',
    driver_office_symbol: null,
    driver_phone: null,
    driver_483_number: null,
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

describe('summarizeDrivingCheck', () => {
  it('renders the pass shape — matches the design spec example tail exactly when uppercased', () => {
    const check = makeCheck()
    const summary = summarizeDrivingCheck(check)
    expect(summary).toBe('SSgt Snuffy, 100 ARW/SE — AF Form 483 Valid — Pass (Taxiway A)')
    // The page prepends "Airfield Driving Spot Check — " and uppercases for the
    // Events Log entry; confirm that composition matches the spec's example:
    // "AIRFIELD DRIVING SPOT CHECK — SSGT SNUFFY, 100 ARW/SE — AF FORM 483 VALID — PASS (TAXIWAY A)"
    expect(`AIRFIELD DRIVING SPOT CHECK — ${summary.toUpperCase()}`).toBe(
      'AIRFIELD DRIVING SPOT CHECK — SSGT SNUFFY, 100 ARW/SE — AF FORM 483 VALID — PASS (TAXIWAY A)',
    )
  })

  it('lists discrepancy item labels with their notes', () => {
    const check = makeCheck({
      driver_rank: 'TSgt',
      driver_name: 'Lee',
      driver_unit: '100 LRS/LGRT',
      location: 'Ramp 3',
      overall_result: 'discrepancy',
      results: [
        makeResult({ item_label: 'Seat belts in use', status: 'discrepancy', notes: 'not worn' }),
        makeResult({ item_label: 'FOD tire check performed', status: 'pass' }),
      ],
    })
    expect(summarizeDrivingCheck(check)).toBe(
      'TSgt Lee, 100 LRS/LGRT — AF Form 483 Valid — Discrepancy: Seat belts in use (not worn) (Ramp 3)',
    )
  })

  it('lists a discrepancy item without notes as the bare item label', () => {
    const check = makeCheck({
      overall_result: 'discrepancy',
      results: [makeResult({ item_label: 'Speed limit compliance', status: 'discrepancy' })],
    })
    expect(summarizeDrivingCheck(check)).toBe(
      'SSgt Snuffy, 100 ARW/SE — AF Form 483 Valid — Discrepancy: Speed limit compliance (Taxiway A)',
    )
  })

  it('renders a violation with its description', () => {
    const check = makeCheck({
      driver_rank: null,
      driver_name: 'Doe',
      driver_unit: null,
      location: 'Gate 5',
      form_483_status: 'expired',
      overall_result: 'violation',
      violation_description: 'Operating without a valid card',
    })
    expect(summarizeDrivingCheck(check)).toBe(
      'Doe — AF Form 483 Expired — Violation: Operating without a valid card (Gate 5)',
    )
  })

  it('renders a bare violation when no description was captured (non-valid 483, no flag notes)', () => {
    const check = makeCheck({
      form_483_status: 'none',
      overall_result: 'violation',
      violation_description: null,
    })
    expect(summarizeDrivingCheck(check)).toBe(
      'SSgt Snuffy, 100 ARW/SE — AF Form 483 None Issued — Violation (Taxiway A)',
    )
  })

  it('gracefully omits a missing rank and unit', () => {
    const check = makeCheck({ driver_rank: null, driver_unit: null, driver_name: 'Contractor Smith' })
    expect(summarizeDrivingCheck(check)).toBe(
      'Contractor Smith — AF Form 483 Valid — Pass (Taxiway A)',
    )
  })
})
