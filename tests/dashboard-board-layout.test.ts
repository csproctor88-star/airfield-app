import { describe, it, expect } from 'vitest'
import {
  validateBoardLayout, reconcileBoardLayout, appendWidgetToBoardLayout,
  type BoardLayout,
} from '@/lib/dashboard/layout'
import type { WidgetInstance } from '@/lib/dashboard/layout'

const w = (i: string, x = 0, y = 0): WidgetInstance => ({ i, type: 't', config: {}, x, y, w: 2, h: 2 })

describe('validateBoardLayout', () => {
  it('wraps a legacy flat array as the lg layout', () => {
    const bl = validateBoardLayout([w('a'), w('b')])
    expect(bl.lg.map(x => x.i)).toEqual(['a', 'b'])
    expect(bl.md).toBeUndefined()
    expect(bl.sm).toBeUndefined()
  })
  it('reads an object shape with lg/md/sm', () => {
    const bl = validateBoardLayout({ lg: [w('a')], md: [w('a', 1, 1)], sm: [w('a', 0, 5)] })
    expect(bl.lg[0].i).toBe('a')
    expect(bl.md?.[0].x).toBe(1)
    expect(bl.sm?.[0].y).toBe(5)
  })
  it('returns { lg: [] } for junk', () => {
    expect(validateBoardLayout(null)).toEqual({ lg: [] })
    expect(validateBoardLayout(42)).toEqual({ lg: [] })
    expect(validateBoardLayout({ nope: 1 })).toEqual({ lg: [] })
  })
})

describe('reconcileBoardLayout', () => {
  it('drops md/sm entries whose id is not in lg, and appends missing lg widgets', () => {
    const bl = reconcileBoardLayout({ lg: [w('a'), w('b')], md: [w('a', 3, 3), w('ghost')] })
    expect(bl.md?.map(x => x.i)).toEqual(['a', 'b'])      // ghost dropped, b added
    expect(bl.md?.find(x => x.i === 'a')?.x).toBe(3)       // a keeps its md position
  })
  it('leaves md/sm undefined when absent', () => {
    const bl = reconcileBoardLayout({ lg: [w('a')] })
    expect(bl.md).toBeUndefined()
    expect(bl.sm).toBeUndefined()
  })
  it('is idempotent', () => {
    const once = reconcileBoardLayout({ lg: [w('a'), w('b')], md: [w('b', 1, 1)] })
    const twice = reconcileBoardLayout(once)
    expect(twice).toEqual(once)
  })
})

describe('appendWidgetToBoardLayout', () => {
  it('appends a copy (new id, deep config) to every present device array', () => {
    const src: WidgetInstance = { i: 'src', type: 't', config: { a: [1] }, x: 0, y: 0, w: 2, h: 2 }
    const bl: BoardLayout = { lg: [w('a')], md: [w('a')] }   // sm absent
    const out = appendWidgetToBoardLayout(bl, src, 'new')
    expect(out.lg.map(x => x.i)).toEqual(['a', 'new'])
    expect(out.md?.map(x => x.i)).toEqual(['a', 'new'])
    expect(out.sm).toBeUndefined()
    ;(src.config.a as number[]).push(2)
    expect((out.lg[1].config.a as number[])).toEqual([1])    // deep copy
  })
})
