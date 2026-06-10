import { describe, it, expect } from 'vitest'
import { signerCompact, type SignerInfo } from '@/lib/supabase/daily-reviews'

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
