import { getWriteQueue, type WriteQueue } from '@/lib/sync/write-queue'
import type { PprDepartPayload, ContractorStatusUpdatePayload } from '@/lib/sync/handlers'
import type { RowActionCtx } from '@/lib/dashboard/table/types'

/** Mark / clear a PPR departure through the offline write queue. */
export async function departPpr(
  entryId: string, depart: boolean, ctx: RowActionCtx, queue: WriteQueue = getWriteQueue(),
): Promise<void> {
  await queue.enqueueOrExecute<PprDepartPayload, null>(
    'ppr_depart',
    { entryId, baseId: ctx.baseId, depart },
    { baseId: ctx.baseId, userId: ctx.userId, optimisticEntityId: entryId },
  )
}

/** Update a contractor's status through the offline write queue. */
export async function updateContractorStatus(
  id: string, status: 'active' | 'completed', ctx: RowActionCtx, queue: WriteQueue = getWriteQueue(),
): Promise<void> {
  await queue.enqueueOrExecute<ContractorStatusUpdatePayload, null>(
    'contractor_status_update',
    { id, baseId: ctx.baseId, status },
    { baseId: ctx.baseId, userId: ctx.userId, optimisticEntityId: id },
  )
}
