import { describe, it, expect } from 'vitest'
import { signerCompact, type SignerInfo } from '@/lib/supabase/daily-reviews'
import { buildReviewDateSpine, buildCertLogRows } from '@/lib/reports/daily-review-log-data'
import type { DailyReviewRow } from '@/lib/supabase/daily-reviews'

const mk = (over: Partial<SignerInfo>): SignerInfo => ({
  id: 'x', name: null, rank: null, operating_initials: null, ...over,
})

describe('signerCompact', () => {
  it('uses last name + operating initials when present', () => {
    expect(signerCompact(mk({ name: 'Jane Doe', operating_initials: 'JD' }))).toBe('Doe (JD)')
  })
  it('falls back to last name only when no initials', () => {
    expect(signerCompact(mk({ name: 'Jane Doe' }))).toBe('Doe')
  })
  it('returns Unknown when no name', () => {
    expect(signerCompact(mk({ operating_initials: 'ZZ' }))).toBe('Unknown (ZZ)')
  })
})

describe('buildReviewDateSpine', () => {
  it('is inclusive of both ends', () => {
    expect(buildReviewDateSpine('2026-04-01', '2026-04-03'))
      .toEqual(['2026-04-01', '2026-04-02', '2026-04-03'])
  })
  it('returns a single day when start === end', () => {
    expect(buildReviewDateSpine('2026-04-01', '2026-04-01')).toEqual(['2026-04-01'])
  })
  it('crosses month boundaries', () => {
    expect(buildReviewDateSpine('2026-03-30', '2026-04-01'))
      .toEqual(['2026-03-30', '2026-03-31', '2026-04-01'])
  })
  it('returns [] when start is after end', () => {
    expect(buildReviewDateSpine('2026-04-05', '2026-04-01')).toEqual([])
  })
})

describe('buildCertLogRows', () => {
  const required = ['day_amsl', 'swing_amsl', 'namo', 'afm'] as const
  const signers = new Map([['u1', { id: 'u1', name: 'Jane Doe', rank: null, operating_initials: 'JD' }]])
  const partial = {
    review_date: '2026-04-02', day_amsl_signed_by: 'u1', fully_certified_at: null,
  } as unknown as DailyReviewRow

  it('renders — for unsigned slots and PENDING (no entry) for missing days', () => {
    const spine = ['2026-04-01', '2026-04-02']
    const rowByDate = new Map<string, DailyReviewRow>([['2026-04-02', partial]])
    const rows = buildCertLogRows(spine, rowByDate, signers, [...required], null)
    expect(rows[0].certifiedText).toBe('PENDING (no entry)')
    expect(rows[0].slots).toEqual(['—', '—', '—', '—'])
    expect(rows[1].slots[0]).toBe('Doe (JD)')
    expect(rows[1].certifiedText).toBe('PENDING')
  })
})
