import { describe, it, expect } from 'vitest'
import { sortScnHistory, type ScnCheckWithResults, type ScnCheckType } from '@/lib/supabase/scn'

function makeCheck(id: string, date: string, type: ScnCheckType): ScnCheckWithResults {
  return {
    id,
    base_id: 'b1',
    check_date: date,
    check_type: type,
    started_at: `${date}T10:00:00Z`,
    completed_at: `${date}T10:05:00Z`,
    completed_by: null,
    completed_by_oi: 'AB',
    notes: null,
    created_at: `${date}T10:00:00Z`,
    results: [],
  }
}

describe('sortScnHistory', () => {
  it('sorts newest date first (fetch order is check_date ASC)', () => {
    const checks = [
      makeCheck('c1', '2026-07-10', 'primary'),
      makeCheck('c2', '2026-07-12', 'primary'),
      makeCheck('c3', '2026-07-11', 'primary'),
    ]
    expect(sortScnHistory(checks).map(c => c.check_date)).toEqual([
      '2026-07-12', '2026-07-11', '2026-07-10',
    ])
  })

  it('orders daily (primary) before monthly back-up within a date', () => {
    // Fetch order sorts check_type alphabetically ('backup' < 'primary'),
    // which put the monthly back-up row above that day's daily check.
    const checks = [
      makeCheck('c1', '2026-07-10', 'backup'),
      makeCheck('c2', '2026-07-10', 'primary'),
    ]
    expect(sortScnHistory(checks).map(c => c.check_type)).toEqual(['primary', 'backup'])
  })

  it('does not mutate its input', () => {
    const checks = [
      makeCheck('c1', '2026-07-10', 'primary'),
      makeCheck('c2', '2026-07-12', 'primary'),
    ]
    const before = checks.map(c => c.id)
    sortScnHistory(checks)
    expect(checks.map(c => c.id)).toEqual(before)
  })
})
