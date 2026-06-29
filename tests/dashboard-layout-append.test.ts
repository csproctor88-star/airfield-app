import { describe, it, expect } from 'vitest'
import { appendWidgetToLayout, type WidgetInstance } from '@/lib/dashboard/layout'

const src: WidgetInstance = { i: 'src', type: 'amtr', config: { columns: ['a'], color: 'blue' }, x: 2, y: 1, w: 4, h: 3 }

describe('appendWidgetToLayout', () => {
  it('appends a copy with the given id, placed below all existing widgets', () => {
    const layout: WidgetInstance[] = [
      { i: 'w1', type: 'notes', config: {}, x: 0, y: 0, w: 2, h: 2 }, // bottom = 2
      { i: 'w2', type: 'clock', config: {}, x: 2, y: 1, w: 2, h: 3 }, // bottom = 4
    ]
    const next = appendWidgetToLayout(layout, src, 'new-id')
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
    const next = appendWidgetToLayout([], src, 'new-id')
    expect(next).toHaveLength(1)
    expect(next[0].y).toBe(0)
    expect(next[0].i).toBe('new-id')
  })

  it('deep-copies config (mutating the source does not affect the copy)', () => {
    const source: WidgetInstance = { i: 'src', type: 'amtr', config: { cols: ['a', 'b'] }, x: 0, y: 0, w: 2, h: 2 }
    const next = appendWidgetToLayout([], source, 'n')
    ;(source.config.cols as string[]).push('c')
    expect((next[0].config.cols as string[])).toEqual(['a', 'b'])
  })

  it('does not mutate the input layout array', () => {
    const layout: WidgetInstance[] = [{ i: 'w1', type: 'notes', config: {}, x: 0, y: 0, w: 2, h: 2 }]
    appendWidgetToLayout(layout, src, 'n')
    expect(layout).toHaveLength(1)
  })
})
