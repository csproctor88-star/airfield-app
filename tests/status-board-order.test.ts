import { describe, it, expect } from 'vitest'
import { applyBoardOrder } from '@/lib/status-board-order'

const DEFAULTS = ['runway', 'navaid', 'arff', 'board_a', 'board_b']

describe('applyBoardOrder', () => {
  it('returns the default order when nothing is saved', () => {
    expect(applyBoardOrder(DEFAULTS, null)).toEqual(DEFAULTS)
    expect(applyBoardOrder(DEFAULTS, undefined)).toEqual(DEFAULTS)
    expect(applyBoardOrder(DEFAULTS, [])).toEqual(DEFAULTS)
  })

  it('applies a full saved order verbatim', () => {
    const saved = ['arff', 'board_b', 'runway', 'navaid', 'board_a']
    expect(applyBoardOrder(DEFAULTS, saved)).toEqual(saved)
  })

  it('drops saved keys that no longer exist (deleted custom board)', () => {
    const saved = ['board_gone', 'arff', 'runway', 'navaid', 'board_a', 'board_b']
    expect(applyBoardOrder(DEFAULTS, saved)).toEqual(['arff', 'runway', 'navaid', 'board_a', 'board_b'])
  })

  it('appends sections the saved order does not know, in default relative order', () => {
    // Saved before board_a/board_b existed.
    expect(applyBoardOrder(DEFAULTS, ['arff', 'navaid', 'runway'])).toEqual(
      ['arff', 'navaid', 'runway', 'board_a', 'board_b'],
    )
  })

  it('handles both drift directions at once', () => {
    expect(applyBoardOrder(DEFAULTS, ['board_gone', 'navaid'])).toEqual(
      ['navaid', 'runway', 'arff', 'board_a', 'board_b'],
    )
  })

  it('never mutates its inputs', () => {
    const saved = ['arff', 'runway']
    const defaults = [...DEFAULTS]
    applyBoardOrder(defaults, saved)
    expect(saved).toEqual(['arff', 'runway'])
    expect(defaults).toEqual(DEFAULTS)
  })
})
