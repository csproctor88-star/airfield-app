import { describe, it, expect } from 'vitest'
import { moveItem } from '@/lib/dashboard/array-move'
describe('moveItem', () => {
  it('moves an element down', () => { expect(moveItem(['a','b','c'], 0, 2)).toEqual(['b','c','a']) })
  it('moves an element up', () => { expect(moveItem(['a','b','c'], 2, 0)).toEqual(['c','a','b']) })
  it('returns a no-op (copy) for from===to', () => { const a=['a','b']; const r=moveItem(a,1,1); expect(r).toEqual(['a','b']); expect(r).not.toBe(a) })
  it('no-ops on out-of-range indices', () => { expect(moveItem(['a','b'], 5, 0)).toEqual(['a','b']); expect(moveItem(['a','b'], 0, 9)).toEqual(['a','b']); expect(moveItem(['a','b'], -1, 0)).toEqual(['a','b']) })
  it('does not mutate the input', () => { const a=['a','b','c']; moveItem(a,0,2); expect(a).toEqual(['a','b','c']) })
})
