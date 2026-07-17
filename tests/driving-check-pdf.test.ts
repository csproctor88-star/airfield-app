import { describe, it, expect } from 'vitest'
import { generateDrivingCheckReportPdf } from '@/lib/driving-check-pdf'
import {
  computeAobStats,
  type DrivingCheckWithResults,
  type DrivingCheckResultRow,
} from '@/lib/supabase/driving-checks'

// Smoke coverage for the AOB report generator: the { doc, filename }
// contract, filename format, and no-throw on an empty range, on a range
// with a violation + discrepancy footnotes, and on non-ASCII notes (which
// sanitizePdfText must fold to ASCII before the standard font renders them).

let seq = 0
function makeResult(overrides: Partial<DrivingCheckResultRow> & { item_label: string; status: DrivingCheckResultRow['status'] }): DrivingCheckResultRow {
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
    checked_at: '2026-07-15T14:32:00Z',
    driver_name: 'Snuffy',
    driver_rank: 'SSgt',
    driver_unit: '100 ARW/SE',
    driver_office_symbol: null,
    driver_phone: null,
    contractor_id: null,
    form_483_status: 'valid',
    form_483_expires: null,
    vehicle_type: 'government',
    vehicle_id: 'L-42',
    pov_pass_number: null,
    location: 'Taxiway A',
    overall_result: 'pass',
    violation_description: null,
    notes: null,
    completed_by: null,
    completed_by_oi: 'AB',
    completed_by_name: 'SSgt Checker',
    created_at: '2026-07-15T14:32:00Z',
    updated_at: '2026-07-15T14:32:00Z',
    results: [],
    ...overrides,
  }
}

function pdfFor(checks: DrivingCheckWithResults[], start = '2026-07-01', end = '2026-07-31') {
  return generateDrivingCheckReportPdf({
    startDate: start,
    endDate: end,
    checks,
    stats: computeAobStats(checks),
    baseName: 'Test AFB',
    baseIcao: 'KTST',
  })
}

describe('generateDrivingCheckReportPdf', () => {
  it('returns the { doc, filename } contract with the expected filename', () => {
    const { doc, filename } = pdfFor([makeCheck()])
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toBe('driving-spot-check-report-2026-07-01_2026-07-31.pdf')
  })

  it('does not throw on an empty period', () => {
    const { doc, filename } = pdfFor([], '2026-02-01', '2026-02-28')
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toBe('driving-spot-check-report-2026-02-01_2026-02-28.pdf')
  })

  it('renders violation + discrepancy footnotes without throwing', () => {
    const checks = [
      makeCheck({
        form_483_status: 'expired',
        overall_result: 'violation',
        violation_description: 'Operating without a valid AF Form 483',
        completed_by_oi: 'CD',
        completed_by_name: 'TSgt Lee',
      }),
      makeCheck({
        overall_result: 'discrepancy',
        results: [
          makeResult({ item_label: 'Seat belts in use', status: 'discrepancy', notes: 'driver not belted' }),
          makeResult({ item_label: 'FOD tire check performed', status: 'pass' }),
        ],
      }),
    ]
    const { doc } = pdfFor(checks)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('does not throw on non-ASCII notes / descriptions', () => {
    const checks = [
      makeCheck({
        overall_result: 'violation',
        violation_description: 'Speeding — “clocked” at 45 in a 15 zone • advised',
        results: [makeResult({ item_label: 'Speed limit compliance', status: 'discrepancy', notes: 'exceeded — see ticket №12' })],
      }),
    ]
    const { doc, filename } = pdfFor(checks)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toContain('driving-spot-check-report-')
  })
})
