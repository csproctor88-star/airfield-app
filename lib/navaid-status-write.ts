/**
 * Offline-aware writer for the Airfield Status board's NAVAID grid.
 *
 * The grid used to call updateNavaidStatus() directly, so a status/notes change
 * made on the flightline while offline was silently dropped. Routing through the
 * queue gives it the same survive-offline behavior as inspections: online runs
 * inline, offline is queued and drains on reconnect (and shows in the header
 * "Queued" badge). The `navaid_status_update` handler lives in lib/sync/handlers.
 */
import { getWriteQueue, type WriteQueue } from '@/lib/sync/write-queue'
import type { NavaidStatusUpdatePayload } from '@/lib/sync/handlers'
import type { EnqueueResult } from '@/lib/sync/types'

export function enqueueNavaidStatus(
  id: string,
  status: 'green' | 'yellow' | 'red',
  notes: string | null,
  baseId: string | null,
  userId: string,
  queue: WriteQueue = getWriteQueue(),
): Promise<EnqueueResult<boolean>> {
  return queue.enqueueOrExecute<NavaidStatusUpdatePayload, boolean>(
    'navaid_status_update',
    { id, status, notes },
    { baseId: baseId ?? '', userId, optimisticEntityId: id },
  )
}
