import { describe, it, expect } from 'vitest'
import {
  zuluToLocalParts,
  formatDayDelta,
  formatZuluDateTimeWithLocal,
  localTimeToZulu,
} from '@/lib/utils'

// These back the PPR "1500Z (1000L)" pairing shown everywhere a Zulu
// time appears. Pinned across a few whole-hour zones so a Node/ICU
// upgrade that quietly changed Intl semantics would trip a test.
describe('zuluToLocalParts', () => {
  it('converts a same-day time (EDT, UTC-4 in June)', () => {
    expect(zuluToLocalParts('2026-06-12', '1500', 'America/New_York')).toEqual({ time: '1100', dayDelta: 0 })
  })

  it('is DST-accurate — the same wall time shifts by season', () => {
    // 1500Z is 1000 EST in January (UTC-5), 1100 EDT in June (UTC-4).
    expect(zuluToLocalParts('2026-01-12', '1500', 'America/New_York')).toEqual({ time: '1000', dayDelta: 0 })
    expect(zuluToLocalParts('2026-06-12', '1500', 'America/New_York')).toEqual({ time: '1100', dayDelta: 0 })
  })

  it('flags a previous-day rollover (00:xx Zulu → prior local evening)', () => {
    expect(zuluToLocalParts('2026-06-12', '0200', 'America/New_York')).toEqual({ time: '2200', dayDelta: -1 })
  })

  it('flags a next-day rollover (Tokyo, UTC+9)', () => {
    expect(zuluToLocalParts('2026-06-12', '1500', 'Asia/Tokyo')).toEqual({ time: '0000', dayDelta: 1 })
  })

  it('accepts a colon-bearing legacy value', () => {
    expect(zuluToLocalParts('2026-06-12', '15:00', 'Pacific/Honolulu')).toEqual({ time: '0500', dayDelta: 0 })
  })

  it('returns null on malformed date or time', () => {
    expect(zuluToLocalParts('not-a-date', '1500', 'UTC')).toBeNull()
    expect(zuluToLocalParts('2026-06-12', '15', 'UTC')).toBeNull()
  })

  it('returns null on an invalid timezone', () => {
    expect(zuluToLocalParts('2026-06-12', '1500', 'Not/AReal_Zone')).toBeNull()
  })
})

describe('formatDayDelta', () => {
  it('renders nothing for a same-day offset', () => {
    expect(formatDayDelta(0)).toBe('')
  })
  it('renders +Nd / -Nd with an ASCII hyphen (jsPDF-safe)', () => {
    expect(formatDayDelta(1)).toBe(' +1d')
    expect(formatDayDelta(-1)).toBe(' -1d')
    expect(formatDayDelta(-2)).toBe(' -2d')
  })
})

describe('formatZuluDateTimeWithLocal', () => {
  it('appends the base-local time on the same date', () => {
    expect(formatZuluDateTimeWithLocal('2026-06-12T15:00:00Z', 'America/New_York'))
      .toBe('Jun 12, 2026 1500Z (1100L)')
  })

  it('includes the local date when it differs (rollover)', () => {
    expect(formatZuluDateTimeWithLocal('2026-06-12T02:00:00Z', 'America/New_York'))
      .toBe('Jun 12, 2026 0200Z (Jun 11 2200L)')
  })

  it('returns the bare Zulu label for a UTC base', () => {
    expect(formatZuluDateTimeWithLocal('2026-06-12T15:00:00Z', 'UTC'))
      .toBe('Jun 12, 2026 1500Z')
  })

  it('returns the bare Zulu label when tz is missing', () => {
    expect(formatZuluDateTimeWithLocal('2026-06-12T15:00:00Z', null))
      .toBe('Jun 12, 2026 1500Z')
  })
})

describe('localTimeToZulu', () => {
  it('inverts a base-local wall time back to Zulu (EDT)', () => {
    expect(localTimeToZulu('1100', 'America/New_York', '2026-06-12')).toBe('1500')
  })

  it('is DST-accurate against the anchor date (EST)', () => {
    expect(localTimeToZulu('1000', 'America/New_York', '2026-01-12')).toBe('1500')
  })

  it('inverts a no-DST zone (Honolulu)', () => {
    expect(localTimeToZulu('0500', 'Pacific/Honolulu', '2026-06-12')).toBe('1500')
  })

  it('falls back to the raw digits on malformed input or bad zone', () => {
    expect(localTimeToZulu('11', 'America/New_York', '2026-06-12')).toBe('11')
    expect(localTimeToZulu('1100', 'Not/AReal_Zone', '2026-06-12')).toBe('1100')
  })
})
