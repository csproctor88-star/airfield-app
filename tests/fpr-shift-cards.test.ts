import { describe, it, expect } from 'vitest'
import { deriveFprTodayCards, type FprCheckWithResults } from '@/lib/supabase/fpr'
import { getActiveShifts, type ShiftKey } from '@/lib/shifts'

// deriveFprTodayCards is the today-view ordering source of truth: it maps
// getActiveShifts output (canonical day → swing → mid) against today's
// checks. It must NOT follow the fetch order (fetchTodayFprChecks orders
// by `shift` alphabetically — day, mid, swing).

function makeCheck(shift: ShiftKey): FprCheckWithResults {
  return {
    id: `chk-${shift}`,
    base_id: 'b1',
    check_date: '2026-07-17',
    shift,
    started_at: '2026-07-17T12:00:00Z',
    completed_at: '2026-07-17T12:05:00Z',
    completed_by: null,
    completed_by_oi: 'AB',
    notes: null,
    created_at: '2026-07-17T12:00:00Z',
    results: [],
  }
}

describe('deriveFprTodayCards', () => {
  it('produces one card for a 1-shift base', () => {
    const base = { shift_count: 1 }
    const cards = deriveFprTodayCards(getActiveShifts(base), [])
    expect(cards).toHaveLength(1)
    expect(cards.map(c => c.shift)).toEqual(['day'])
    expect(cards[0].label).toBe('Day Shift')
    expect(cards[0].check).toBeUndefined()
  })

  it('produces two cards for a 2-shift base (the DB default)', () => {
    const base = { shift_count: 2 }
    const cards = deriveFprTodayCards(getActiveShifts(base), [])
    expect(cards.map(c => c.shift)).toEqual(['day', 'swing'])
  })

  it('produces three cards in canonical order for a 3-shift base', () => {
    const base = { shift_count: 3, shift_name_mid: 'Panther Ops' }
    const cards = deriveFprTodayCards(getActiveShifts(base), [])
    // Canonical order — NOT the alphabetical fetch order (day, mid, swing).
    expect(cards.map(c => c.shift)).toEqual(['day', 'swing', 'mid'])
    // Custom shift label resolves through getActiveShifts.
    expect(cards[2].label).toBe('Panther Ops')
  })

  it('attaches today checks to their matching shift card', () => {
    const base = { shift_count: 3 }
    const checks = [makeCheck('mid'), makeCheck('day')]
    const cards = deriveFprTodayCards(getActiveShifts(base), checks)
    expect(cards[0].check?.id).toBe('chk-day')   // day
    expect(cards[1].check).toBeUndefined()       // swing — no check
    expect(cards[2].check?.id).toBe('chk-mid')   // mid
  })

  it('gives a now-inactive shift no today card (mid check on a base reduced to 1 shift)', () => {
    const base = { shift_count: 1 }
    // A historical mid check exists among today's rows (e.g. the base
    // dropped from 3 shifts to 1 after this check was logged).
    const checks = [makeCheck('mid')]
    const cards = deriveFprTodayCards(getActiveShifts(base), checks)
    // Only the active day shift gets a card; the mid check is not surfaced
    // in the today view (it renders only in history).
    expect(cards).toHaveLength(1)
    expect(cards[0].shift).toBe('day')
    expect(cards.some(c => c.shift === 'mid')).toBe(false)
    expect(cards[0].check).toBeUndefined()
  })
})
