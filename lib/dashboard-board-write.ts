import { getWriteQueue, type WriteQueue } from '@/lib/sync/write-queue'
import type { DashboardBoardUpdatePayload } from '@/lib/sync/handlers'
import type { BoardLayout } from '@/lib/dashboard/layout'

export interface SaveBoardLayoutInput {
  boardId: string
  layout: BoardLayout
  baseId: string
  userId: string
}

/** Persist a board layout through the offline write queue (online → inline). */
export async function saveBoardLayout(
  input: SaveBoardLayoutInput,
  queue: WriteQueue = getWriteQueue(),
): Promise<void> {
  await queue.enqueueOrExecute<DashboardBoardUpdatePayload, null>(
    'dashboard_board_update',
    { id: input.boardId, layout: input.layout },
    { baseId: input.baseId, userId: input.userId, optimisticEntityId: input.boardId },
  )
}
