/**
 * Offline write queue — type definitions.
 *
 * See docs/Offline_Write_Queue_Spec.md for the design rationale.
 *
 * Foundation only. Feature wraps register handlers per WriteType in
 * follow-up sessions; nothing in this module knows about Supabase or
 * any specific entity.
 */

/**
 * Discriminated tag identifying which write surface produced a queued
 * payload. The drainer uses this to dispatch to the correct handler.
 *
 * Add new types here as features wrap onto the queue. The full list
 * is intentionally enumerated (not `string`) so a missing handler is
 * a compile-time error.
 */
export type WriteType =
  | 'inspection_file'
  | 'check_file'
  | 'acsi_submit'
  | 'discrepancy_create'
  | 'discrepancy_update'
  | 'notam_create'
  | 'waiver_create'
  | 'waiver_update'
  | 'daily_review_sign'
  | 'photo_upload'
  | 'airfield_status_update'
  | 'infrastructure_feature_status_update'
  | 'outage_event_create'
  | 'activity_log_insert'

/**
 * Lifecycle state of a queued write.
 *
 * - `pending`     — eligible for the next drain pass.
 * - `failed`      — terminal: handler threw NonRetriableError, or attempts hit cap.
 *                   UI surfaces these for manual retry / discard.
 * - `conflict`    — terminal-pending: handler detected the server row was
 *                   modified concurrently. UI prompts the user to resolve.
 */
export type QueueStatus = 'pending' | 'failed' | 'conflict'

/**
 * A single queued write. JSON-serializable so it survives reload via IndexedDB.
 *
 * `payload` shape is owned by the handler registered for `type`. The queue
 * stores it as `unknown`; handlers narrow at dispatch time.
 *
 * Photo uploads (Blob payloads) are not yet supported — that wrap will need
 * to extend the storage layer to hold Blobs alongside JSON metadata.
 */
export interface QueuedWrite<P = unknown> {
  id: string
  type: WriteType
  payload: P
  createdAt: string
  attempts: number
  lastAttemptAt: string | null
  lastError: string | null
  baseId: string
  userId: string
  status: QueueStatus
  optimisticEntityId?: string
  conflictAt?: string
}

/**
 * Function executed by the drainer for a given WriteType. Receives the
 * type-narrowed payload (handlers cast / validate) and returns whatever
 * the underlying CRUD module returns.
 *
 * Throw `NonRetriableError` for permanent failures (auth, validation, 400/403).
 * Throw `ConflictError` to mark the queued write as needing manual resolution.
 * Any other thrown error is treated as transient (retry with backoff).
 */
export type WriteHandler<P = unknown, R = unknown> = (payload: P) => Promise<R>

/**
 * Result returned to the caller of enqueueOrExecute().
 *
 * - `committed` — handler ran inline (online path) and the write succeeded.
 *                 `data` is whatever the handler returned.
 * - `queued`    — write was persisted to IndexedDB for later drain.
 *                 `id` lets the caller correlate optimistic UI rows.
 */
export type EnqueueResult<R = unknown> =
  | { status: 'committed'; data: R }
  | { status: 'queued'; id: string }

/**
 * Permanent failure — drainer marks the queued write as `failed` and
 * stops retrying. Use for 4xx responses, schema validation, missing-FK,
 * etc. — anywhere a retry would just fail again.
 */
export class NonRetriableError extends Error {
  readonly nonRetriable = true as const
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'NonRetriableError'
  }
}

/**
 * Server row was modified concurrently. Drainer marks the queued write as
 * `conflict`; UI walks the user through resolution (overwrite / discard /
 * merge depending on write type).
 */
export class ConflictError extends Error {
  readonly conflict = true as const
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'ConflictError'
  }
}
