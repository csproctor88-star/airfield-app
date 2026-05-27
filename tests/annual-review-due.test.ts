import { describe, it, expect } from 'vitest'
import {
  nextAnnualReviewDate,
  annualReviewDaysOut,
  classifyAnnualReview,
  REVIEW_WARNING_WINDOW_DAYS,
} from '@/lib/annual-review-due'

describe('nextAnnualReviewDate', () => {
  it('returns null for null anchor', () => {
    expect(nextAnnualReviewDate(null)).toBe(null)
  })

  it('returns null for an unparseable anchor', () => {
    expect(nextAnnualReviewDate('not-a-date')).toBe(null)
  })

  it('adds exactly 1 year (UTC) to a date anchor', () => {
    const out = nextAnnualReviewDate('2026-04-15')
    expect(out?.toISOString().slice(0, 10)).toBe('2027-04-15')
  })

  it('preserves day-of-month for a timestamp anchor', () => {
    const out = nextAnnualReviewDate('2026-05-10T14:23:45Z')
    expect(out?.toISOString().slice(0, 10)).toBe('2027-05-10')
  })

  it('handles Feb 29 → Mar 1 in non-leap year via JS UTC rollover', () => {
    const out = nextAnnualReviewDate('2024-02-29')
    // Date.UTC(2025, 1, 29) overflows to Mar 1 — this is the documented
    // behavior of the in-app helpers it mirrors.
    expect(out?.toISOString().slice(0, 10)).toBe('2025-03-01')
  })
})

describe('annualReviewDaysOut', () => {
  it('returns 0 on same UTC calendar day regardless of time', () => {
    const target = new Date('2026-05-26T00:00:00Z')
    const now    = new Date('2026-05-26T23:59:59Z')
    expect(annualReviewDaysOut(target, now)).toBe(0)
  })

  it('returns +1 for tomorrow even when the wall-clock delta is < 24h', () => {
    const target = new Date('2026-05-27T00:30:00Z')
    const now    = new Date('2026-05-26T23:30:00Z')
    expect(annualReviewDaysOut(target, now)).toBe(1)
  })

  it('returns negative for past dates', () => {
    const target = new Date('2026-05-20T12:00:00Z')
    const now    = new Date('2026-05-26T12:00:00Z')
    expect(annualReviewDaysOut(target, now)).toBe(-6)
  })
})

describe('classifyAnnualReview', () => {
  const now = new Date('2026-05-26T12:00:00Z')

  it('classifies null as never', () => {
    expect(classifyAnnualReview(null, now)).toEqual({ status: 'never', daysOut: null })
  })

  it('classifies a past due-date as overdue', () => {
    const due = new Date('2026-05-10T00:00:00Z')
    const out = classifyAnnualReview(due, now)
    expect(out.status).toBe('overdue')
    expect(out.daysOut).toBe(-16)
  })

  it('classifies a due-date inside the warning window as amber', () => {
    const due = new Date('2026-06-15T00:00:00Z')
    const out = classifyAnnualReview(due, now)
    expect(out.status).toBe('amber')
    expect(out.daysOut).toBe(20)
  })

  it('classifies exactly the boundary day (warning window) as amber', () => {
    const boundary = new Date('2026-05-26T00:00:00Z')
    boundary.setUTCDate(boundary.getUTCDate() + REVIEW_WARNING_WINDOW_DAYS)
    const out = classifyAnnualReview(boundary, now)
    expect(out.status).toBe('amber')
    expect(out.daysOut).toBe(REVIEW_WARNING_WINDOW_DAYS)
  })

  it('classifies the day after the warning window as current', () => {
    const beyond = new Date('2026-05-26T00:00:00Z')
    beyond.setUTCDate(beyond.getUTCDate() + REVIEW_WARNING_WINDOW_DAYS + 1)
    const out = classifyAnnualReview(beyond, now)
    expect(out.status).toBe('current')
    expect(out.daysOut).toBe(REVIEW_WARNING_WINDOW_DAYS + 1)
  })

  it('classifies today as amber (still inside the window)', () => {
    const due = new Date('2026-05-26T00:00:00Z')
    const out = classifyAnnualReview(due, now)
    expect(out.status).toBe('amber')
    expect(out.daysOut).toBe(0)
  })
})
