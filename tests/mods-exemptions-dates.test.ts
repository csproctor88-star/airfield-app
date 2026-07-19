import { describe, it, expect } from 'vitest'
import {
  nextAnnualReviewDate, deviationNotifyDeadline, reconsiderationDeadline,
  isExpired, isDecidedRelief, reviewDueState, deviationNotificationOverdue,
} from '@/lib/mods-exemptions/constants'

// All helpers operate on local YYYY-MM-DD strings. Fixtures deliberately sit
// on both sides of a UTC day boundary via plain string comparisons — the
// session-6 DATE-boundary lesson: never let a bare date string round-trip
// through a UTC Date and shift a calendar day.

describe('nextAnnualReviewDate', () => {
  it('adds exactly one calendar year', () => {
    expect(nextAnnualReviewDate('2026-07-18')).toBe('2027-07-18')
    expect(nextAnnualReviewDate('2026-01-01')).toBe('2027-01-01')
    expect(nextAnnualReviewDate('2026-12-31')).toBe('2027-12-31')
  })

  it('clamps Feb 29 to Feb 28 of the next (non-leap) year', () => {
    expect(nextAnnualReviewDate('2028-02-29')).toBe('2029-02-28')
  })

  it('keeps zero-padding', () => {
    expect(nextAnnualReviewDate('2026-03-05')).toBe('2027-03-05')
  })
})

describe('deviationNotifyDeadline / reconsiderationDeadline', () => {
  it('deviation deadline is +14 days (§139.113), crossing month ends correctly', () => {
    expect(deviationNotifyDeadline('2026-07-01')).toBe('2026-07-15')
    expect(deviationNotifyDeadline('2026-07-25')).toBe('2026-08-08')
    expect(deviationNotifyDeadline('2026-12-25')).toBe('2027-01-08')
  })

  it('reconsideration deadline is +60 days (§11.101)', () => {
    expect(reconsiderationDeadline('2026-01-01')).toBe('2026-03-02')
    expect(reconsiderationDeadline('2026-07-18')).toBe('2026-09-16')
  })

  it('handles leap-day arithmetic', () => {
    expect(deviationNotifyDeadline('2028-02-20')).toBe('2028-03-05') // 2028 is a leap year
  })
})

describe('isExpired (computed display state, never stored)', () => {
  it('is false while the expiration date has not passed — including ON the date', () => {
    const rec = { status: 'approved' as const, expiration_date: '2026-07-18' }
    expect(isExpired(rec, '2026-07-17')).toBe(false)
    expect(isExpired(rec, '2026-07-18')).toBe(false) // valid through the printed day
    expect(isExpired(rec, '2026-07-19')).toBe(true)
  })

  it('only decided relief can expire', () => {
    expect(isExpired({ status: 'submitted', expiration_date: '2020-01-01' }, '2026-07-18')).toBe(false)
    expect(isExpired({ status: 'denied', expiration_date: '2020-01-01' }, '2026-07-18')).toBe(false)
    expect(isExpired({ status: 'partially_granted', expiration_date: '2020-01-01' }, '2026-07-18')).toBe(true)
  })

  it('no expiration date → never expired', () => {
    expect(isExpired({ status: 'approved', expiration_date: null }, '2026-07-18')).toBe(false)
  })

  it('isDecidedRelief covers approved and partially_granted only', () => {
    expect(isDecidedRelief('approved')).toBe(true)
    expect(isDecidedRelief('partially_granted')).toBe(true)
    expect(isDecidedRelief('under_review')).toBe(false)
    expect(isDecidedRelief('denied')).toBe(false)
  })
})

describe('reviewDueState (5280.5D §2.12.2 annual cadence)', () => {
  const rec = (next: string | null, status: 'approved' | 'submitted' = 'approved') =>
    ({ status, next_review_due: next })

  it('overdue strictly after the due date', () => {
    expect(reviewDueState(rec('2026-07-17'), '2026-07-18')).toBe('overdue')
  })

  it('due_soon inside the 30-day window, including on the due date', () => {
    expect(reviewDueState(rec('2026-07-18'), '2026-07-18')).toBe('due_soon')
    expect(reviewDueState(rec('2026-08-17'), '2026-07-18')).toBe('due_soon') // exactly +30
  })

  it('quiet outside the window', () => {
    expect(reviewDueState(rec('2026-08-18'), '2026-07-18')).toBe(null) // +31
    expect(reviewDueState(rec(null), '2026-07-18')).toBe(null)
  })

  it('no review duty before a decision', () => {
    expect(reviewDueState(rec('2026-01-01', 'submitted'), '2026-07-18')).toBe(null)
  })
})

describe('deviationNotificationOverdue', () => {
  const dev = (deviation: string | null, notified: string | null) => ({
    record_type: 'deviation' as const,
    deviation_date: deviation,
    notified_date: notified,
  })

  it('overdue once the 14-day window lapses without a notification', () => {
    expect(deviationNotificationOverdue(dev('2026-07-01', null), '2026-07-15')).toBe(false) // day 14
    expect(deviationNotificationOverdue(dev('2026-07-01', null), '2026-07-16')).toBe(true)
  })

  it('never overdue once notified, and never for other record types', () => {
    expect(deviationNotificationOverdue(dev('2026-07-01', '2026-07-10'), '2026-08-01')).toBe(false)
    expect(deviationNotificationOverdue(
      { record_type: 'mos', deviation_date: '2026-07-01', notified_date: null }, '2026-08-01',
    )).toBe(false)
  })
})
