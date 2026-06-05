/**
 * Offline-aware discrepancy creation with its inop/outage fan-out.
 *
 * Shared by the "New Discrepancy" page and the Visual NAVAIDs "Report Outage"
 * action, both of which create a discrepancy and optionally mark infrastructure
 * features inoperative + log outage events. Previously both wrote directly and
 * were lost when offline.
 *
 * The discrepancy id is pre-allocated client-side (createDiscrepancy honors a
 * supplied id — see lib/supabase/discrepancies.ts) so photos and outage events
 * can FK the row before the queue drains. Online → runs inline; offline → queued
 * in order (discrepancy first so FKs resolve on drain) and shown in the header
 * "Queued" badge.
 */
import { getWriteQueue, type WriteQueue } from '@/lib/sync/write-queue'
import type {
  DiscrepancyCreatePayload,
  DiscrepancyCreateResult,
  OutageEventCreatePayload,
  InfrastructureFeatureStatusUpdatePayload,
} from '@/lib/sync/handlers'

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface DiscrepancyFanoutInput {
  /** createDiscrepancy input WITHOUT id — the helper pre-allocates one. */
  discrepancy: Omit<DiscrepancyCreatePayload, 'id'>
  /** Infrastructure features to mark inoperative alongside the discrepancy. */
  inopFeatureIds?: string[]
  /** Outage events to log; discrepancy_id is injected by the helper. */
  outageEvents?: Array<Omit<OutageEventCreatePayload, 'discrepancy_id'>>
  baseId: string
  userId: string
}

export interface DiscrepancyFanoutResult {
  /** Pre-allocated discrepancy id — the final id whether committed or queued. */
  id: string
  /** 'committed' when it ran inline (online); 'queued' when offline. */
  status: 'committed' | 'queued'
}

/**
 * Create a discrepancy (+ optional feature inop / outage events) through the
 * offline write queue. Throws on a non-transient online failure of the create
 * (RLS / no row) — callers should catch and surface it.
 */
export async function submitDiscrepancyFanout(
  input: DiscrepancyFanoutInput,
  queue: WriteQueue = getWriteQueue(),
): Promise<DiscrepancyFanoutResult> {
  const id = newUuid()
  const meta = { baseId: input.baseId, userId: input.userId, optimisticEntityId: id }

  const res = await queue.enqueueOrExecute<DiscrepancyCreatePayload, DiscrepancyCreateResult>(
    'discrepancy_create',
    { ...input.discrepancy, id },
    meta,
  )

  for (const fid of input.inopFeatureIds ?? []) {
    await queue.enqueueOrExecute<InfrastructureFeatureStatusUpdatePayload, number>(
      'infrastructure_feature_status_update',
      { ids: [fid], status: 'inoperative' },
      meta,
    )
  }

  for (const ev of input.outageEvents ?? []) {
    await queue.enqueueOrExecute<OutageEventCreatePayload, unknown>(
      'outage_event_create',
      { ...ev, discrepancy_id: id } as OutageEventCreatePayload,
      meta,
    )
  }

  return { id, status: res.status }
}
