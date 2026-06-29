import { describe, it, expect } from 'vitest'
import { seedLayoutFromTemplate } from '@/lib/dashboard/board-templates'
import type { WidgetInstance, BoardLayout } from '@/lib/dashboard/layout'

const W: WidgetInstance[] = [{ i: 'a', type: 'last-check', config: {}, x: 0, y: 0, w: 3, h: 1 }]
const L: BoardLayout = { lg: W }

describe('seedLayoutFromTemplate', () => {
  it('returns the template layout for a matching role', () => {
    const boards = [{ owner_id: null, role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'namo')).toBe(L)
  })
  it('returns { lg: [] } when no template matches the role', () => {
    const boards = [{ owner_id: null, role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'amops')).toEqual({ lg: [] })
  })
  it('ignores personal boards (owner_id not null) even if role_template set', () => {
    const boards = [{ owner_id: 'u1', role_template: 'namo', layout: L }]
    expect(seedLayoutFromTemplate(boards, 'namo')).toEqual({ lg: [] })
  })
  it('returns { lg: [] } for a null role', () => {
    expect(seedLayoutFromTemplate([{ owner_id: null, role_template: 'namo', layout: L }], null)).toEqual({ lg: [] })
  })
})
