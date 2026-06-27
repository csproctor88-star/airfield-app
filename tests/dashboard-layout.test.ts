import { describe, it, expect } from 'vitest'
import { validateLayout, type WidgetInstance } from '@/lib/dashboard/layout'

describe('validateLayout', () => {
  it('returns [] for non-array / garbage input', () => {
    expect(validateLayout(null)).toEqual([])
    expect(validateLayout('nope')).toEqual([])
    expect(validateLayout({})).toEqual([])
  })

  it('keeps valid widget instances and coerces numeric grid fields', () => {
    const out = validateLayout([
      { i: 'a', type: 'last-check', config: {}, x: 0, y: 0, w: 4, h: 2 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ i: 'a', type: 'last-check', x: 0, y: 0, w: 4, h: 2 })
  })

  it('drops items missing a stable id or type', () => {
    const out = validateLayout([
      { type: 'last-check', x: 0, y: 0, w: 4, h: 2 },
      { i: 'b', x: 0, y: 0, w: 4, h: 2 },
      { i: 'c', type: 'last-check', x: 0, y: 0, w: 4, h: 2 },
    ])
    expect(out.map(w => w.i)).toEqual(['c'])
  })

  it('clamps negative/zero sizes to minimums and defaults config to {}', () => {
    const out = validateLayout([{ i: 'a', type: 'last-check', x: -3, y: -1, w: 0, h: 0 }])
    expect(out[0]).toMatchObject({ x: 0, y: 0, w: 1, h: 1, config: {} })
  })

  it('drops duplicate ids, keeping the first', () => {
    const out = validateLayout([
      { i: 'a', type: 'last-check', x: 0, y: 0, w: 4, h: 2 },
      { i: 'a', type: 'notams', x: 0, y: 2, w: 4, h: 2 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('last-check')
  })
})
