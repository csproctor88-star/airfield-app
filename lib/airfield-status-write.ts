/**
 * Single entry point for persisting an airfield_status board change through the
 * offline write queue.
 *
 * Why this exists: the airfield-status board (lib/dashboard-context.tsx) used to
 * call updateAirfieldStatus() directly. When offline that write hit a network
 * error, logged to the console, returned false, and was silently dropped — no
 * queue entry, no retry on reconnect. Inspections, checks, ACSI submits, and
 * daily-review signing all route through the write queue and survive a dropped
 * connection; the board did not. Routing board writes through here closes that
 * gap: the `airfield_status_update` handler already exists in lib/sync/handlers,
 * the header "Queued" badge already counts it, and the queue inspector already
 * labels it — only this call was missing.
 *
 * Online: runs inline (same as before). Offline: persisted to the queue and
 * drained on the next `online` / visibility event.
 */
import { getWriteQueue, type WriteQueue } from '@/lib/sync/write-queue'
import type { AirfieldStatusUpdatePayload } from '@/lib/sync/handlers'
import type { EnqueueResult } from '@/lib/sync/types'

/** The same patch shape updateAirfieldStatus accepts. */
export type AirfieldStatusUpdates = AirfieldStatusUpdatePayload['updates']

/**
 * Enqueue (or, when online, immediately execute) an airfield_status patch.
 * Mirrors updateAirfieldStatus's call shape so it is a drop-in replacement.
 *
 * Throws NonRetriableError / ConflictError on a non-transient online failure
 * (e.g. no row / RLS denial), exactly as enqueueOrExecute does — callers should
 * catch and surface it. A transient/offline failure resolves to
 * `{ status: 'queued' }` instead of throwing.
 *
 * @param queue injectable for tests; defaults to the app singleton.
 */
export function enqueueAirfieldStatus(
  updates: AirfieldStatusUpdates,
  baseId: string | null,
  userId: string,
  queue: WriteQueue = getWriteQueue(),
): Promise<EnqueueResult<boolean>> {
  return queue.enqueueOrExecute<AirfieldStatusUpdatePayload, boolean>(
    'airfield_status_update',
    { updates, baseId },
    { baseId: baseId ?? '', userId },
  )
}
