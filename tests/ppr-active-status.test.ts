import { describe, it, expect } from 'vitest'
import { isActivePpr, PPR_INACTIVE_STATUSES, type PprStatus } from '@/lib/supabase/ppr'

// ─── PPR "active for the day" guard ───
// The airfield status board panel and the header "PPRs today" chip both count
// only active PPRs. A denied or canceled request isn't on the field and must
// not inflate the day's count. Everything else — approved plus any in-progress
// stage — counts. This locks that rule so a future status-enum change can't
// silently start counting (or hiding) the wrong things.

const ALL_STATUSES: PprStatus[] = [
  'pending_amops_triage',
  'pending_coordination',
  'pending_amops_approval',
  'approved',
  'denied',
  'canceled',
]

describe('isActivePpr', () => {
  it('counts approved and every in-progress stage', () => {
    expect(isActivePpr('approved')).toBe(true)
    expect(isActivePpr('pending_amops_triage')).toBe(true)
    expect(isActivePpr('pending_coordination')).toBe(true)
    expect(isActivePpr('pending_amops_approval')).toBe(true)
  })

  it('excludes denied and canceled', () => {
    expect(isActivePpr('denied')).toBe(false)
    expect(isActivePpr('canceled')).toBe(false)
  })

  it('inactive set is exactly { denied, canceled }', () => {
    expect([...PPR_INACTIVE_STATUSES].sort()).toEqual(['canceled', 'denied'])
  })

  it('a day of only canceled/denied PPRs counts as zero', () => {
    const day: PprStatus[] = ['canceled', 'denied', 'canceled']
    expect(day.filter(isActivePpr).length).toBe(0)
  })

  it('active + inactive partition the full status set', () => {
    const active = ALL_STATUSES.filter(isActivePpr)
    const inactive = ALL_STATUSES.filter((s) => !isActivePpr(s))
    expect(active.length + inactive.length).toBe(ALL_STATUSES.length)
    expect(inactive.sort()).toEqual(['canceled', 'denied'])
  })
})
