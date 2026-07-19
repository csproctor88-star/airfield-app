import { describe, it, expect } from 'vitest'
import { applyBoardOrder, moveSectionBefore } from '@/lib/status-board-order'

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

describe('moveSectionBefore (use-drag-reorder drop semantics)', () => {
  it('moving forward lands BEFORE the target', () => {
    expect(moveSectionBefore(DEFAULTS, 'runway', 'arff')).toEqual(
      ['navaid', 'runway', 'arff', 'board_a', 'board_b'],
    )
  })

  it('moving backward lands BEFORE the target', () => {
    expect(moveSectionBefore(DEFAULTS, 'board_b', 'navaid')).toEqual(
      ['runway', 'board_b', 'navaid', 'arff', 'board_a'],
    )
  })

  it('moving to the front works', () => {
    expect(moveSectionBefore(DEFAULTS, 'arff', 'runway')).toEqual(
      ['arff', 'runway', 'navaid', 'board_a', 'board_b'],
    )
  })

  it('self-drops and unknown keys are no-ops', () => {
    expect(moveSectionBefore(DEFAULTS, 'runway', 'runway')).toEqual(DEFAULTS)
    expect(moveSectionBefore(DEFAULTS, 'ghost', 'arff')).toEqual(DEFAULTS)
    expect(moveSectionBefore(DEFAULTS, 'runway', 'ghost')).toEqual(DEFAULTS)
  })

  it('round-trips with applyBoardOrder for persistence', () => {
    const reordered = moveSectionBefore(DEFAULTS, 'arff', 'runway')
    expect(applyBoardOrder(DEFAULTS, reordered)).toEqual(reordered)
  })
})
