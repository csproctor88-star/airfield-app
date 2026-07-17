import { describe, it, expect } from 'vitest'
import { generateFprMonthlyPdf } from '@/lib/fpr-pdf'
import type { FprCheckWithResults, FprCheckResultRow, FprItemStatus } from '@/lib/supabase/fpr'
import type { ShiftKey } from '@/lib/shifts'

// Smoke coverage for the FPR monthly PDF generator: the { doc, filename }
// contract, filename format, and no-throw on an empty month and on checks
// that carry issue footnotes.

const SHIFT_LABELS: Record<ShiftKey, string> = {
  day: 'Day Shift',
  swing: 'Swing Shift',
  mid: 'Mid Shift',
}

function makeResult(overrides: Partial<FprCheckResultRow> & { item_label: string; status: FprItemStatus }): FprCheckResultRow {
  return {
    id: `r-${Math.random().toString(36).slice(2)}`,
    check_id: 'c1',
    item_id: null,
    notes: null,
    sort_order: 0,
    created_at: '2026-07-14T12:00:00Z',
    ...overrides,
  }
}

function makeCheck(overrides: Partial<FprCheckWithResults> & { check_date: string; shift: ShiftKey; results: FprCheckResultRow[] }): FprCheckWithResults {
  return {
    id: `chk-${overrides.check_date}-${overrides.shift}`,
    base_id: 'b1',
    started_at: `${overrides.check_date}T12:00:00Z`,
    completed_at: `${overrides.check_date}T12:05:00Z`,
    completed_by: null,
    completed_by_oi: 'AB',
    notes: null,
    created_at: `${overrides.check_date}T12:00:00Z`,
    ...overrides,
  }
}

describe('generateFprMonthlyPdf', () => {
  it('returns the { doc, filename } contract with the expected filename', () => {
    const check = makeCheck({
      check_date: '2026-07-14',
      shift: 'day',
      results: [makeResult({ item_label: 'FLIP products current', status: 'satisfactory' })],
    })
    const { doc, filename } = generateFprMonthlyPdf({
      monthYyyyMm: '2026-07',
      checks: [check],
      shiftLabels: SHIFT_LABELS,
      baseName: 'Test AFB',
    })
    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toBe('fpr-check-log-2026-07.pdf')
  })

  it('does not throw on an empty month', () => {
    const { doc, filename } = generateFprMonthlyPdf({
      monthYyyyMm: '2026-02',
      checks: [],
      shiftLabels: SHIFT_LABELS,
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toBe('fpr-check-log-2026-02.pdf')
  })

  it('renders issue footnotes without throwing', () => {
    const checks = [
      makeCheck({
        check_date: '2026-07-14',
        shift: 'day',
        results: [
          makeResult({ item_label: 'FLIP products current', status: 'satisfactory' }),
          makeResult({ item_label: 'Enroute charts', status: 'issue', notes: 'superseded edition on rack' }),
        ],
      }),
      makeCheck({
        check_date: '2026-07-15',
        shift: 'mid',
        results: [
          makeResult({ item_label: 'Weather briefing access', status: 'issue' }),
          makeResult({ item_label: 'Printer/forms stock', status: 'na' }),
        ],
      }),
    ]
    const { doc, filename } = generateFprMonthlyPdf({
      monthYyyyMm: '2026-07',
      checks,
      shiftLabels: SHIFT_LABELS,
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    expect(filename).toBe('fpr-check-log-2026-07.pdf')
  })

  it('ignores checks outside the requested month', () => {
    const checks = [
      makeCheck({ check_date: '2026-06-30', shift: 'day', results: [makeResult({ item_label: 'X', status: 'satisfactory' })] }),
      makeCheck({ check_date: '2026-07-01', shift: 'day', results: [makeResult({ item_label: 'Y', status: 'satisfactory' })] }),
    ]
    const { doc } = generateFprMonthlyPdf({ monthYyyyMm: '2026-07', checks, shiftLabels: SHIFT_LABELS })
    expect(doc).toBeDefined()
  })
})
