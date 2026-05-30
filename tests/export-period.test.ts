import { describe, it, expect } from 'vitest'
import {
  resolveQuickPeriod,
  isInRange,
  type ExportPeriod,
} from '@/lib/export/export-period'

describe('resolveQuickPeriod', () => {
  it('this_month → first..last day of the current month', () => {
    expect(resolveQuickPeriod('this_month', new Date('2026-02-15T12:00:00Z')))
      .toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('this_month handles a 31-day month', () => {
    expect(resolveQuickPeriod('this_month', new Date('2026-01-09T00:00:00Z')))
      .toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })

  it('last_month → previous month, wrapping the year', () => {
    expect(resolveQuickPeriod('last_month', new Date('2026-01-10T00:00:00Z')))
      .toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('this_quarter → calendar quarter containing now', () => {
    expect(resolveQuickPeriod('this_quarter', new Date('2026-05-20T00:00:00Z')))
      .toEqual({ from: '2026-04-01', to: '2026-06-30' })
  })

  it('this_fy → federal FY (Oct 1) start through now, mid-FY', () => {
    expect(resolveQuickPeriod('this_fy', new Date('2026-02-15T00:00:00Z')))
      .toEqual({ from: '2025-10-01', to: '2026-02-15' })
  })

  it('this_fy → when now is in Oct, FY starts that same Oct 1', () => {
    expect(resolveQuickPeriod('this_fy', new Date('2025-11-05T00:00:00Z')))
      .toEqual({ from: '2025-10-01', to: '2025-11-05' })
  })
})

describe('isInRange', () => {
  const range: ExportPeriod = { kind: 'range', from: '2026-02-01', to: '2026-02-28' }

  it('all_time is always in range', () => {
    expect(isInRange('1999-01-01T00:00:00Z', { kind: 'all_time' })).toBe(true)
  })

  it('includes boundary dates (inclusive both ends)', () => {
    expect(isInRange('2026-02-01T23:59:59Z', range)).toBe(true)
    expect(isInRange('2026-02-28T00:00:00Z', range)).toBe(true)
  })

  it('excludes dates outside the window', () => {
    expect(isInRange('2026-01-31T12:00:00Z', range)).toBe(false)
    expect(isInRange('2026-03-01T00:00:00Z', range)).toBe(false)
  })

  it('treats a null/empty date as not in a range window', () => {
    expect(isInRange(null, range)).toBe(false)
    expect(isInRange(undefined, range)).toBe(false)
  })

  it('includes a null date in an all_time export', () => {
    expect(isInRange(null, { kind: 'all_time' })).toBe(true)
  })
})
