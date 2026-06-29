import { describe, it, expect, vi } from 'vitest'
import { saveBoardLayout } from '@/lib/dashboard-board-write'
import type { WidgetInstance, BoardLayout } from '@/lib/dashboard/layout'

const widget: WidgetInstance = { i: 'a', type: 'last-check', config: {}, x: 0, y: 0, w: 3, h: 2 }
const layout: BoardLayout = { lg: [widget] }

describe('saveBoardLayout', () => {
  it('enqueues a dashboard_board_update with the board id + layout', async () => {
    const enqueueOrExecute = vi.fn().mockResolvedValue({ status: 'committed', data: null })
    const queue = { enqueueOrExecute } as any
    await saveBoardLayout({ boardId: 'board-1', layout, baseId: 'base-1', userId: 'user-1' }, queue)
    expect(enqueueOrExecute).toHaveBeenCalledWith(
      'dashboard_board_update',
      { id: 'board-1', layout },
      { baseId: 'base-1', userId: 'user-1', optimisticEntityId: 'board-1' },
    )
  })
})
