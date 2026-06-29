import { describe, it, expect } from 'vitest'
import { appendWidgetToLayout, type WidgetInstance } from '@/lib/dashboard/layout'

function makeSrc(): WidgetInstance {
  return { i: 'src', type: 'amtr', config: { columns: ['a'], color: 'blue' }, x: 2, y: 1, w: 4, h: 3 }
}

describe('appendWidgetToLayout', () => {
  it('appends a copy with the given id, placed below all existing widgets', () => {
    const layout: WidgetInstance[] = [
      { i: 'w1', type: 'notes', config: {}, x: 0, y: 0, w: 2, h: 2 }, // bottom = 2
      { i: 'w2', type: 'clock', config: {}, x: 2, y: 1, w: 2, h: 3 }, // bottom = 4
    ]
    const next = appendWidgetToLayout(layout, makeSrc(), 'new-id')
    expect(next).toHaveLength(3)
    const placed = next[2]
    expect(placed.i).toBe('new-id')
    expect(placed.type).toBe('amtr')
    expect(placed.x).toBe(0)
    expect(placed.y).toBe(4)        // below the lowest widget
    expect(placed.w).toBe(4)
    expect(placed.h).toBe(3)
  })

  it('places at y:0 for an empty layout', () => {
    const next = appendWidgetToLayout([], makeSrc(), 'new-id')
    expect(next).toHaveLength(1)
    expect(next[0].y).toBe(0)
    expect(next[0].i).toBe('new-id')
  })

  it('deep-copies config (mutating the source does not affect the copy)', () => {
    const source = makeSrc()
    const next = appendWidgetToLayout([], source, 'n')
    ;(source.config.columns as string[]).push('c')
    expect((next[0].config.columns as string[])).toEqual(['a'])
  })

  it('deep-copies config (mutating the copy does not affect the source)', () => {
    const source = makeSrc()
    const next = appendWidgetToLayout([], source, 'n')
    ;(next[0].config.columns as string[]).push('c')
    expect((source.config.columns as string[])).toEqual(['a'])
  })

  it('does not mutate the input layout array', () => {
    const layout: WidgetInstance[] = [{ i: 'w1', type: 'notes', config: {}, x: 0, y: 0, w: 2, h: 2 }]
    appendWidgetToLayout(layout, makeSrc(), 'n')
    expect(layout).toHaveLength(1)
  })
})
