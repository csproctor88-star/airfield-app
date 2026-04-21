import { describe, it, expect } from 'vitest'
import {
  summarizeCheck,
  type ScnCheckWithResults,
  type ScnCheckResultRow,
  type ScnAgencyStatus,
} from '@/lib/supabase/scn'

function makeResult(overrides: Partial<ScnCheckResultRow> & { agency_name: string; status: ScnAgencyStatus }): ScnCheckResultRow {
  return {
    id: 'r1',
    check_id: 'c1',
    agency_id: null,
    notes: null,
    sort_order: 0,
    created_at: '2026-04-21T12:00:00Z',
    ...overrides,
  }
}

function makeCheck(
  type: 'primary' | 'backup',
  results: ScnCheckResultRow[],
): ScnCheckWithResults {
  return {
    id: 'c1',
    base_id: 'b1',
    check_date: '2026-04-21',
    check_type: type,
    started_at: '2026-04-21T12:00:00Z',
    completed_at: '2026-04-21T12:05:00Z',
    completed_by: null,
    completed_by_oi: null,
    notes: null,
    created_at: '2026-04-21T12:00:00Z',
    results,
  }
}

describe('summarizeCheck', () => {
  it('renders the Daily label for check_type=primary when all agencies are loud & clear', () => {
    const check = makeCheck('primary', [
      makeResult({ agency_name: 'Fire Dept', status: 'loud_clear' }),
      makeResult({ agency_name: 'ATC', status: 'loud_clear' }),
    ])
    expect(summarizeCheck(check)).toBe('Daily SCN check complete — all agencies loud & clear')
  })

  it('renders the Monthly label for check_type=backup', () => {
    const check = makeCheck('backup', [
      makeResult({ agency_name: 'Fire Dept', status: 'loud_clear' }),
    ])
    expect(summarizeCheck(check)).toBe('Monthly Back-up SCN check complete — all agencies loud & clear')
  })

  it('lists a single no_response exception without notes', () => {
    const check = makeCheck('primary', [
      makeResult({ agency_name: 'Fire Dept', status: 'loud_clear' }),
      makeResult({ agency_name: 'ATC', status: 'no_response' }),
    ])
    expect(summarizeCheck(check)).toBe(
      'Daily SCN check complete — all loud & clear except ATC (No Response)',
    )
  })

  it('includes the notes string when an exception has notes', () => {
    const check = makeCheck('primary', [
      makeResult({ agency_name: 'ATC', status: 'oos', notes: 'radio fault' }),
    ])
    expect(summarizeCheck(check)).toBe(
      'Daily SCN check complete — all loud & clear except ATC (Out of Service: radio fault)',
    )
  })

  it('joins multiple exceptions with commas and preserves per-exception status labels', () => {
    const check = makeCheck('primary', [
      makeResult({ agency_name: 'Fire Dept', status: 'no_response' }),
      makeResult({ agency_name: 'ATC', status: 'oos', notes: 'radio fault' }),
      makeResult({ agency_name: 'Medical', status: 'loud_clear' }),
    ])
    expect(summarizeCheck(check)).toBe(
      'Daily SCN check complete — all loud & clear except Fire Dept (No Response), ATC (Out of Service: radio fault)',
    )
  })

  it('handles an empty results array as an all-clear (nothing to flag)', () => {
    const check = makeCheck('primary', [])
    expect(summarizeCheck(check)).toBe('Daily SCN check complete — all agencies loud & clear')
  })
})
