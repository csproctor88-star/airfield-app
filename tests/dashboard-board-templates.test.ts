import { describe, it, expect } from 'vitest'
import { seedLayoutFromTemplate } from '@/lib/dashboard/board-templates'
import type { WidgetInstance } from '@/lib/dashboard/layout'

const L: WidgetInstance[] = [{ i: 'a', type: 'last-check', config: {}, x: 0, y: 0, w: 3, h: 1 }]

describe('seedLayoutFromTemplate', () => {
  it('returns the template layout for a matching role', () => {
    const boards = [{ owner_id: null, role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'namo')).toBe(L)
  })
  it('returns [] when no template matches the role', () => {
    const boards = [{ owner_id: null, role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'amops')).toEqual([])
  })
  it('ignores personal boards (owner_id not null) even if role_template set', () => {
    const boards = [{ owner_id: 'u1', role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'namo')).toEqual([])
  })
  it('returns [] for a null role', () => {
    expect(seedLayoutFromTemplate([{ owner_id: null, role_template: 'namo', layout: L }], null)).toEqual([])
  })
})
