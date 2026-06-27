import { describe, it, expect } from 'vitest'
import { updateWidgetConfig } from '@/lib/dashboard/widget-config'
import type { WidgetInstance } from '@/lib/dashboard/layout'

const base: WidgetInstance[] = [
  { i: 'a', type: 'links', config: { title: 'Old' }, x: 0, y: 0, w: 3, h: 2 },
  { i: 'b', type: 'embed', config: {}, x: 0, y: 2, w: 3, h: 2 },
]

describe('updateWidgetConfig', () => {
  it('replaces the config of the matching widget only', () => {
    const out = updateWidgetConfig(base, 'a', { title: 'New', links: [] })
    expect(out.find(w => w.i === 'a')!.config).toEqual({ title: 'New', links: [] })
    expect(out.find(w => w.i === 'b')!.config).toEqual({})
  })
  it('returns a new array and does not mutate the input', () => {
    const out = updateWidgetConfig(base, 'a', { title: 'X' })
    expect(out).not.toBe(base)
    expect(base.find(w => w.i === 'a')!.config).toEqual({ title: 'Old' })
  })
  it('is a no-op (new array) when the id is not found', () => {
    const out = updateWidgetConfig(base, 'zzz', { title: 'X' })
    expect(out.map(w => w.config)).toEqual(base.map(w => w.config))
  })
})
