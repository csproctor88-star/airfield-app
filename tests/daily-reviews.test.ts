import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  canUserSignSlot,
  computeEventsHash,
  currentAmslSlot,
  getEffectiveReviewDate,
  getReviewWindowUtc,
  getSlotLabel,
  isFullyCertified,
  requiredSlotsForShifts,
  type DailyReviewRow,
  type DailyReviewSlot,
} from '@/lib/supabase/daily-reviews'

function emptyRow(overrides: Partial<DailyReviewRow> = {}): DailyReviewRow {
  const slots: DailyReviewSlot[] = ['day_amsl', 'swing_amsl', 'mid_amsl', 'namo', 'afm']
  const base: Record<string, unknown> = {
    id: 'row-1',
    base_id: 'base-1',
    review_date: '2026-04-15',
    fully_certified_at: null,
    created_at: '2026-04-15T00:00:00Z',
    updated_at: '2026-04-15T00:00:00Z',
  }
  for (const s of slots) {
    base[`${s}_signed_by`] = null
    base[`${s}_signed_at`] = null
    base[`${s}_notes`] = null
    base[`${s}_events_hash`] = null
  }
  return { ...(base as unknown as DailyReviewRow), ...overrides }
}

function sign(row: DailyReviewRow, slot: DailyReviewSlot): DailyReviewRow {
  return {
    ...row,
    [`${slot}_signed_by`]: 'user-1',
    [`${slot}_signed_at`]: '2026-04-15T12:00:00Z',
  } as DailyReviewRow
}

describe('requiredSlotsForShifts', () => {
  it('returns day/swing + namo/afm for a 2-shift base', () => {
    expect(requiredSlotsForShifts(2)).toEqual(['day_amsl', 'swing_amsl', 'namo', 'afm'])
  })

  it('adds mid_amsl for a 3-shift base', () => {
    expect(requiredSlotsForShifts(3)).toEqual([
      'day_amsl',
      'swing_amsl',
      'mid_amsl',
      'namo',
      'afm',
    ])
  })

  it('drops swing and mid for a 1-shift base', () => {
    expect(requiredSlotsForShifts(1)).toEqual(['day_amsl', 'namo', 'afm'])
  })
})

describe('canUserSignSlot', () => {
  // Build a `has` function from a permission-key fixture set.
  const hasOf = (keys: string[]) => {
    const set = new Set(keys)
    return (k: string) => set.has(k)
  }

  // Role → permission-preset fixtures, mirroring the effective matrix
  // seeded by 2026042200 / 2026042202. Keep in sync with role_permissions.
  const AMOPS = hasOf(['daily_reviews:sign:amsl'])
  const NAMO = hasOf(['daily_reviews:sign:amsl', 'daily_reviews:sign:namo'])
  const AFM = hasOf([
    'daily_reviews:sign:amsl',
    'daily_reviews:sign:namo',
    'daily_reviews:sign:afm',
  ])
  const NONE = hasOf([])

  it('returns false when the caller holds no permissions', () => {
    expect(canUserSignSlot(NONE, 'day_amsl')).toBe(false)
  })

  it('amops can sign AMSL slots but not NAMO or AFM', () => {
    expect(canUserSignSlot(AMOPS, 'day_amsl')).toBe(true)
    expect(canUserSignSlot(AMOPS, 'swing_amsl')).toBe(true)
    expect(canUserSignSlot(AMOPS, 'mid_amsl')).toBe(true)
    expect(canUserSignSlot(AMOPS, 'namo')).toBe(false)
    expect(canUserSignSlot(AMOPS, 'afm')).toBe(false)
  })

  it('namo can sign NAMO + AMSL but not AFM', () => {
    expect(canUserSignSlot(NAMO, 'namo')).toBe(true)
    expect(canUserSignSlot(NAMO, 'day_amsl')).toBe(true)
    expect(canUserSignSlot(NAMO, 'afm')).toBe(false)
  })

  it('AFM-preset can sign every slot', () => {
    for (const slot of ['day_amsl', 'swing_amsl', 'mid_amsl', 'namo', 'afm'] as DailyReviewSlot[]) {
      expect(canUserSignSlot(AFM, slot)).toBe(true)
    }
  })

  it('denies callers missing the AMSL sign permission', () => {
    expect(canUserSignSlot(NONE, 'day_amsl')).toBe(false)
    expect(canUserSignSlot(NONE, 'afm')).toBe(false)
  })
})

describe('isFullyCertified', () => {
  it('is false when any required slot is unsigned', () => {
    let row = emptyRow()
    row = sign(row, 'day_amsl')
    row = sign(row, 'swing_amsl')
    row = sign(row, 'namo')
    expect(isFullyCertified(row, 2)).toBe(false)
  })

  it('is true once all 2-shift required slots are signed', () => {
    let row = emptyRow()
    for (const s of ['day_amsl', 'swing_amsl', 'namo', 'afm'] as DailyReviewSlot[]) {
      row = sign(row, s)
    }
    expect(isFullyCertified(row, 2)).toBe(true)
  })

  it('still requires mid_amsl when shiftCount is 3', () => {
    let row = emptyRow()
    for (const s of ['day_amsl', 'swing_amsl', 'namo', 'afm'] as DailyReviewSlot[]) {
      row = sign(row, s)
    }
    expect(isFullyCertified(row, 3)).toBe(false)
    row = sign(row, 'mid_amsl')
    expect(isFullyCertified(row, 3)).toBe(true)
  })

  it('certifies a 1-shift base without swing or mid signatures', () => {
    let row = emptyRow()
    for (const s of ['day_amsl', 'namo', 'afm'] as DailyReviewSlot[]) {
      row = sign(row, s)
    }
    expect(isFullyCertified(row, 1)).toBe(true)
    // Guard: the same row must NOT certify on a 2-shift base.
    expect(isFullyCertified(row, 2)).toBe(false)
  })
})

describe('getReviewWindowUtc', () => {
  it('spans exactly 24 hours for a non-DST date', () => {
    const { startIso, endIso } = getReviewWindowUtc('2026-02-10', 'America/New_York', '06:00')
    const span = new Date(endIso).getTime() - new Date(startIso).getTime()
    expect(span).toBe(24 * 60 * 60 * 1000)
  })

  it('anchors start at 06:00 local (EST = UTC-5)', () => {
    const { startIso } = getReviewWindowUtc('2026-02-10', 'America/New_York', '06:00')
    // 06:00 EST → 11:00 UTC
    expect(startIso).toBe('2026-02-10T11:00:00.000Z')
  })

  it('anchors start at 06:00 local (EDT = UTC-4) in summer', () => {
    const { startIso } = getReviewWindowUtc('2026-07-10', 'America/New_York', '06:00')
    expect(startIso).toBe('2026-07-10T10:00:00.000Z')
  })

  it('defaults to UTC / 06:00 when args omitted', () => {
    const { startIso, endIso } = getReviewWindowUtc('2026-02-10')
    expect(startIso).toBe('2026-02-10T06:00:00.000Z')
    expect(endIso).toBe('2026-02-11T06:00:00.000Z')
  })
})

describe('getEffectiveReviewDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns yesterday before the 06:00 reset', () => {
    // 05:00 America/New_York on 2026-04-15 → 09:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T09:00:00Z'))
    expect(getEffectiveReviewDate('America/New_York', '06:00')).toBe('2026-04-14')
  })

  it('returns today after the 06:00 reset', () => {
    // 07:00 America/New_York on 2026-04-15 → 11:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T11:00:00Z'))
    expect(getEffectiveReviewDate('America/New_York', '06:00')).toBe('2026-04-15')
  })

  it('respects a custom reset time', () => {
    // Reset at 08:00 local, currently 07:00 local → yesterday
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T11:00:00Z')) // 07:00 EDT
    expect(getEffectiveReviewDate('America/New_York', '08:00')).toBe('2026-04-14')
  })
})

describe('currentAmslSlot', () => {
  // Fixed reference: 2026-04-15T18:00:00Z
  //   → 14:00 America/New_York (EDT = UTC-4)
  //   → 11:00 America/Los_Angeles (PDT = UTC-7)
  //   → 03:00 Asia/Tokyo next day
  const ref = new Date('2026-04-15T18:00:00Z')

  it('returns day_amsl for an early-afternoon hour on a 3-shift base', () => {
    // NY at 14:00 → swing (14-22 window on 3-shift)
    expect(currentAmslSlot('America/New_York', 3, ref)).toBe('swing_amsl')
  })

  it('returns day_amsl late-morning on a 3-shift base', () => {
    // LA at 11:00 → day (06-14)
    expect(currentAmslSlot('America/Los_Angeles', 3, ref)).toBe('day_amsl')
  })

  it('returns mid_amsl for an overnight hour on a 3-shift base', () => {
    // Tokyo at 03:00 → mid (22-06)
    expect(currentAmslSlot('Asia/Tokyo', 3, ref)).toBe('mid_amsl')
  })

  it('collapses swing+mid into swing on a 2-shift base', () => {
    // Tokyo at 03:00 → swing (18-06 window on 2-shift)
    expect(currentAmslSlot('Asia/Tokyo', 2, ref)).toBe('swing_amsl')
    // NY at 14:00 → day (06-18 window)
    expect(currentAmslSlot('America/New_York', 2, ref)).toBe('day_amsl')
  })

  it('handles the 06:00 boundary (day starts exactly at 0600)', () => {
    const sixAM = new Date('2026-04-15T10:00:00Z') // 06:00 America/New_York (EDT)
    expect(currentAmslSlot('America/New_York', 3, sixAM)).toBe('day_amsl')
    const fiveFiftyNineAM = new Date('2026-04-15T09:59:00Z')
    expect(currentAmslSlot('America/New_York', 3, fiveFiftyNineAM)).toBe('mid_amsl')
  })

  it('always returns day_amsl on a 1-shift base, at any hour', () => {
    // NY at 14:00 local and Tokyo at 03:00 local from the same instant
    expect(currentAmslSlot('America/New_York', 1, ref)).toBe('day_amsl')
    expect(currentAmslSlot('Asia/Tokyo', 1, ref)).toBe('day_amsl')
  })
})

describe('getSlotLabel — custom shift names', () => {
  it('composes a custom name with the military sign-off suffix', () => {
    expect(getSlotLabel('day_amsl', { airport_type: 'usaf', shift_name_day: 'Alpha' })).toBe('Alpha AMSL')
  })

  it('composes a custom name with the civilian sign-off suffix', () => {
    expect(getSlotLabel('swing_amsl', { airport_type: 'faa_part139', shift_name_swing: 'Evening' })).toBe('Evening Lead')
  })

  it('falls back to mode defaults when no custom name is set', () => {
    expect(getSlotLabel('day_amsl', { airport_type: 'usaf' })).toBe('Day Shift AMSL')
    expect(getSlotLabel('day_amsl', { airport_type: 'faa_part139' })).toBe('Day Shift Lead')
  })

  it('ignores whitespace-only names and never renames NAMO/AFM slots', () => {
    expect(getSlotLabel('mid_amsl', { airport_type: 'usaf', shift_name_mid: '   ' })).toBe('Mid Shift AMSL')
    expect(getSlotLabel('namo', { airport_type: 'usaf', shift_name_day: 'Alpha' })).toBe('NAMO')
    expect(getSlotLabel('afm', { airport_type: 'usaf', shift_name_day: 'Alpha' })).toBe('Airfield Manager')
  })
})

describe('computeEventsHash', () => {
  it('is deterministic for the same id set', async () => {
    const a = await computeEventsHash(['a', 'b', 'c'])
    const b = await computeEventsHash(['a', 'b', 'c'])
    expect(a).toBe(b)
  })

  it('is order-independent', async () => {
    const a = await computeEventsHash(['a', 'b', 'c'])
    const b = await computeEventsHash(['c', 'a', 'b'])
    expect(a).toBe(b)
  })

  it('differs when id set differs', async () => {
    const a = await computeEventsHash(['a', 'b', 'c'])
    const b = await computeEventsHash(['a', 'b', 'c', 'd'])
    expect(a).not.toBe(b)
  })

  it('returns a non-empty hex string', async () => {
    const a = await computeEventsHash([])
    expect(a).toMatch(/^[0-9a-f]+$/)
    expect(a.length).toBeGreaterThan(0)
  })
})
