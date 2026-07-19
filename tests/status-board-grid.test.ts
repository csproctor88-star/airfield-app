import { describe, it, expect } from 'vitest'
import {
  validateStatusBoardGridLayout, defaultStatusBoardGridLayout,
  syncLayoutSections, layoutStackOrder,
  STATUS_GRID_COLS, STATUS_SECTION_MIN_W, STATUS_SECTION_MIN_H,
  type StatusBoardGridLayout,
} from '@/lib/status-board-grid'

const KEYS = ['runway', 'navaid', 'arff', 'board_a']

describe('validateStatusBoardGridLayout', () => {
  it('accepts a well-formed stored layout', () => {
    const raw = { sections: [{ key: 'runway', x: 0, y: 0, w: 12, h: 8 }] }
    expect(validateStatusBoardGridLayout(raw)).toEqual(raw)
  })

  it('rejects garbage shapes outright', () => {
    expect(validateStatusBoardGridLayout(null)).toBeNull()
    expect(validateStatusBoardGridLayout('x')).toBeNull()
    expect(validateStatusBoardGridLayout({})).toBeNull()
    expect(validateStatusBoardGridLayout({ sections: 'nope' })).toBeNull()
    expect(validateStatusBoardGridLayout({ sections: [] })).toBeNull()
    expect(validateStatusBoardGridLayout({ sections: [{ x: 1 }] })).toBeNull() // no key
  })

  it('clamps out-of-range values instead of overflowing the grid', () => {
    const parsed = validateStatusBoardGridLayout({
      sections: [{ key: 'runway', x: 99, y: -5, w: 999, h: 0 }],
    })!
    const s = parsed.sections[0]
    expect(s.w).toBe(STATUS_GRID_COLS)
    expect(s.x).toBe(0)            // clamped so x + w stays inside the grid
    expect(s.y).toBe(0)
    expect(s.h).toBe(STATUS_SECTION_MIN_H)
    expect(s.x + s.w).toBeLessThanOrEqual(STATUS_GRID_COLS)
  })

  it('drops duplicate keys and non-object rows, keeps the rest', () => {
    const parsed = validateStatusBoardGridLayout({
      sections: [
        { key: 'runway', x: 0, y: 0, w: 8, h: 6 },
        { key: 'runway', x: 8, y: 0, w: 8, h: 6 },
        'junk',
        { key: 'arff', x: 8, y: 0, w: 8, h: 6 },
      ],
    })!
    expect(parsed.sections.map(s => s.key)).toEqual(['runway', 'arff'])
  })
})

describe('defaultStatusBoardGridLayout', () => {
  it('lays sections three to a row on the 24-column grid', () => {
    const l = defaultStatusBoardGridLayout(KEYS)
    expect(l.sections).toHaveLength(4)
    expect(l.sections[0]).toEqual({ key: 'runway', x: 0, y: 0, w: 8, h: 6 })
    expect(l.sections[1]).toEqual({ key: 'navaid', x: 8, y: 0, w: 8, h: 6 })
    expect(l.sections[2]).toEqual({ key: 'arff', x: 16, y: 0, w: 8, h: 6 })
    expect(l.sections[3]).toEqual({ key: 'board_a', x: 0, y: 6, w: 8, h: 6 })
  })
})

describe('syncLayoutSections', () => {
  const saved: StatusBoardGridLayout = {
    sections: [
      { key: 'arff', x: 0, y: 0, w: 6, h: 4 },
      { key: 'runway', x: 6, y: 0, w: 18, h: 8 },
      { key: 'board_gone', x: 0, y: 8, w: 24, h: 4 },
    ],
  }

  it('drops rects for sections that no longer exist', () => {
    const synced = syncLayoutSections(saved, ['runway', 'arff'])
    expect(synced.sections.map(s => s.key).sort()).toEqual(['arff', 'runway'])
  })

  it('appends unknown-new sections as full rows below the lowest rect', () => {
    const synced = syncLayoutSections(saved, ['runway', 'arff', 'navaid', 'board_b'])
    const navaid = synced.sections.find(s => s.key === 'navaid')!
    const boardB = synced.sections.find(s => s.key === 'board_b')!
    // bottom of kept rects: runway ends at y=8 (board_gone dropped first)
    expect(navaid).toEqual({ key: 'navaid', x: 0, y: 8, w: 24, h: 6 })
    expect(boardB).toEqual({ key: 'board_b', x: 0, y: 14, w: 24, h: 6 })
  })

  it('is a no-op when the section sets already match', () => {
    const exact: StatusBoardGridLayout = {
      sections: [{ key: 'runway', x: 0, y: 0, w: 24, h: 6 }],
    }
    expect(syncLayoutSections(exact, ['runway'])).toEqual(exact)
  })
})

describe('layoutStackOrder', () => {
  it('orders top-to-bottom then left-to-right (phone stacking / section_order)', () => {
    const l: StatusBoardGridLayout = {
      sections: [
        { key: 'c', x: 0, y: 6, w: 8, h: 4 },
        { key: 'b', x: 12, y: 0, w: 8, h: 6 },
        { key: 'a', x: 0, y: 0, w: 8, h: 6 },
      ],
    }
    expect(layoutStackOrder(l)).toEqual(['a', 'b', 'c'])
  })
})
