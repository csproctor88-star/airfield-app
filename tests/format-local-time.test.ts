import { describe, it, expect } from 'vitest'
import { formatLocalTime } from '@/lib/utils'

// `formatLocalTime` powers the new PPR per-column time-display=local
// rendering. Anchored to Intl.DateTimeFormat — these tests pin the
// expected behavior across a few timezones with whole-hour offsets so
// we'd notice if a Node upgrade quietly changed Intl semantics.
describe('formatLocalTime', () => {
  it('passes Zulu through unchanged when tz is UTC', () => {
    expect(formatLocalTime('15:00', 'UTC')).toBe('1500')
  })

  it('converts to Pacific/Honolulu (UTC-10) correctly', () => {
    // 15:00Z = 05:00 HST on the same UTC date
    expect(formatLocalTime('15:00', 'Pacific/Honolulu')).toBe('0500')
  })

  it('converts to Asia/Tokyo (UTC+9) correctly', () => {
    // 15:00Z = 00:00 JST the next day; we still report 00:00
    expect(formatLocalTime('15:00', 'Asia/Tokyo')).toBe('0000')
  })

  it('accepts a colon-less HHMM input shape', () => {
    expect(formatLocalTime('1500', 'UTC')).toBe('1500')
  })

  it('returns the digits when the timezone is invalid', () => {
    // Intl.DateTimeFormat throws on a bogus tz — function must not
    // crash, just fall back to the raw HHMM digits.
    expect(formatLocalTime('15:00', 'Not/AReal_Zone')).toBe('1500')
  })

  it('returns the raw input when fewer than 4 digits', () => {
    expect(formatLocalTime('9', 'UTC')).toBe('9')
    expect(formatLocalTime('', 'UTC')).toBe('')
  })
})
