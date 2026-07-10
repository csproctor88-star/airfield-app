import { describe, it, expect } from 'vitest'
import { normalizeRecipients, chunk } from '@/lib/email/broadcast-recipients'

describe('normalizeRecipients', () => {
  it('drops empty/invalid emails, dedupes case-insensitively, trims names', () => {
    const out = normalizeRecipients([
      { email: 'A@x.com', name: ' Amy ' },
      { email: 'a@x.com', name: 'Amy dup' }, // dup (case-insensitive)
      { email: '', name: 'No email' },
      { email: 'notanemail', name: 'Bad' },
      { email: 'b@x.com', name: null },
    ])
    expect(out).toEqual([
      { email: 'a@x.com', name: 'Amy' },
      { email: 'b@x.com', name: '' },
    ])
  })
})

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('returns [] for empty input and throws on non-positive size', () => {
    expect(chunk([], 100)).toEqual([])
    expect(() => chunk([1], 0)).toThrow()
  })
})
