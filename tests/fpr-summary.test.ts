import { describe, it, expect } from 'vitest'
import {
  summarizeFprCheck,
  type FprCheckWithResults,
  type FprCheckResultRow,
  type FprItemStatus,
} from '@/lib/supabase/fpr'

function makeResult(overrides: Partial<FprCheckResultRow> & { item_label: string; status: FprItemStatus }): FprCheckResultRow {
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

function makeCheck(results: FprCheckResultRow[]): FprCheckWithResults {
  return {
    id: 'c1',
    base_id: 'b1',
    check_date: '2026-07-17',
    shift: 'day',
    started_at: '2026-07-17T12:00:00Z',
    completed_at: '2026-07-17T12:05:00Z',
    completed_by: null,
    completed_by_oi: null,
    notes: null,
    created_at: '2026-07-17T12:00:00Z',
    results,
  }
}

describe('summarizeFprCheck', () => {
  it('renders the all-satisfactory line when every item is satisfactory', () => {
    const check = makeCheck([
      makeResult({ item_label: 'FLIP products current', status: 'satisfactory' }),
      makeResult({ item_label: 'NOTAM display current', status: 'satisfactory' }),
    ])
    expect(summarizeFprCheck(check, 'Day Shift')).toBe(
      'Day Shift Flight Planning Room check complete — all items satisfactory',
    )
  })

  it('lists a single issue with its notes context', () => {
    const check = makeCheck([
      makeResult({ item_label: 'FLIP products current', status: 'satisfactory' }),
      makeResult({ item_label: 'Enroute charts', status: 'issue', notes: 'superseded edition on rack' }),
    ])
    expect(summarizeFprCheck(check, 'Day Shift')).toBe(
      'Day Shift Flight Planning Room check complete — issues: Enroute charts (superseded edition on rack)',
    )
  })

  it('lists a single issue without notes as the bare item label', () => {
    const check = makeCheck([
      makeResult({ item_label: 'Enroute charts', status: 'issue' }),
    ])
    expect(summarizeFprCheck(check, 'Day Shift')).toBe(
      'Day Shift Flight Planning Room check complete — issues: Enroute charts',
    )
  })

  it('joins multiple issues with commas, preserving per-issue notes', () => {
    const check = makeCheck([
      makeResult({ item_label: 'Enroute charts', status: 'issue', notes: 'superseded edition on rack' }),
      makeResult({ item_label: 'Weather briefing access', status: 'issue' }),
      makeResult({ item_label: 'NOTAM display current', status: 'satisfactory' }),
    ])
    expect(summarizeFprCheck(check, 'Day Shift')).toBe(
      'Day Shift Flight Planning Room check complete — issues: Enroute charts (superseded edition on rack), Weather briefing access',
    )
  })

  it('appends N/A items after issues, matching the spec example shape', () => {
    const check = makeCheck([
      makeResult({ item_label: 'Enroute charts', status: 'issue', notes: 'superseded edition on rack' }),
      makeResult({ item_label: 'Printer/forms stock', status: 'na' }),
    ])
    expect(summarizeFprCheck(check, 'Day Shift')).toBe(
      'Day Shift Flight Planning Room check complete — issues: Enroute charts (superseded edition on rack), N/A: Printer/forms stock',
    )
  })

  it('N/A-only exclusions do not count as issues but are still listed', () => {
    const check = makeCheck([
      makeResult({ item_label: 'FLIP products current', status: 'satisfactory' }),
      makeResult({ item_label: 'Printer/forms stock', status: 'na' }),
      makeResult({ item_label: 'Weather briefing access', status: 'na' }),
    ])
    expect(summarizeFprCheck(check, 'Day Shift')).toBe(
      'Day Shift Flight Planning Room check complete — all items satisfactory, N/A: Printer/forms stock, Weather briefing access',
    )
  })

  it('interpolates the resolved shift label (custom base shift names)', () => {
    const check = makeCheck([
      makeResult({ item_label: 'FLIP products current', status: 'satisfactory' }),
    ])
    expect(summarizeFprCheck(check, 'Mid Shift')).toBe(
      'Mid Shift Flight Planning Room check complete — all items satisfactory',
    )
    expect(summarizeFprCheck(check, 'Panther Ops')).toBe(
      'Panther Ops Flight Planning Room check complete — all items satisfactory',
    )
  })

  it('handles an empty results array as an all-clear (nothing to flag)', () => {
    const check = makeCheck([])
    expect(summarizeFprCheck(check, 'Day Shift')).toBe(
      'Day Shift Flight Planning Room check complete — all items satisfactory',
    )
  })
})
