import { describe, it, expect } from 'vitest'
import { resolveAdvisoryWindow } from '@/lib/advisory-window'

describe('resolveAdvisoryWindow', () => {
  it('passes UFN (null end) straight through', () => {
    const now = new Date('2026-06-23T19:00:00Z')
    expect(resolveAdvisoryWindow('2026-06-23T20:00', null, now)).toEqual({
      effEnd: null,
      error: null,
    })
  })

  it('leaves a normal same-day future window unchanged', () => {
    const now = new Date('2026-06-23T09:00:00Z')
    expect(resolveAdvisoryWindow('2026-06-23T10:00', '2026-06-23T18:00', now)).toEqual({
      effEnd: '2026-06-23T18:00',
      error: null,
    })
  })

  it('rolls the end date forward a day for an overnight window', () => {
    const now = new Date('2026-06-23T19:00:00Z')
    expect(resolveAdvisoryWindow('2026-06-23T20:00', '2026-06-23T02:00', now)).toEqual({
      effEnd: '2026-06-24T02:00',
      error: null,
    })
  })

  it('rolls forward when there is no start and end-of-day is before now', () => {
    const now = new Date('2026-06-23T20:00:00Z')
    expect(resolveAdvisoryWindow(null, '2026-06-23T02:00', now)).toEqual({
      effEnd: '2026-06-24T02:00',
      error: null,
    })
  })

  it('blocks when even after rolling the end is still in the past', () => {
    const now = new Date('2026-06-25T00:00:00Z')
    const result = resolveAdvisoryWindow(null, '2026-06-23T02:00', now)
    expect(result.effEnd).toBeNull()
    expect(result.error).toMatch(/past/i)
  })
})
