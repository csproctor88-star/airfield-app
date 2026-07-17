/**
 * Write-queue handlers per WriteType.
 *
 * Each handler adapts a Glidepath CRUD module (which returns
 * `{ data, error }`) into the throw-on-failure shape the queue expects.
 *
 * Error classification:
 *   - Structured error string matching a known network shape (e.g.,
 *     "Failed to fetch", "NetworkError", "Load failed") → transient.
 *     Supabase JS v2 surfaces fetch failures *structurally*, not as
 *     thrown rejections, so we have to sniff them here or the queue
 *     would mark them non-retriable and bail.
 *   - Any other structured error → NonRetriableError. RLS denials,
 *     schema violations, FK errors — retry won't help.
 *   - Thrown error (rare in v2 but possible) → bubbles as transient by
 *     default (queue's catch in enqueueOrExecute treats unknown throws
 *     as transient).
 *
 * Heuristic is intentionally conservative: a transient 5xx/429 returned
 * structurally without a network-y message will still get marked
 * non-retriable. Cost is acceptable — those are rare and the user can
 * Retry from the inspector.
 */

import { fileInspection, createInspectionDraftWithId } from '@/lib/supabase/inspections'
import { createCheck } from '@/lib/supabase/checks'
import { fileAcsiInspection } from '@/lib/supabase/acsi-inspections'
import {
  fetchDailyReview,
  signDailyReview,
  type DailyReviewRow,
} from '@/lib/supabase/daily-reviews'
import { signFlipReviewDirect, type FlipSignoff } from '@/lib/supabase/flip'
import type { FlipSignSlot } from '@/lib/flip/roles'
import { updateAirfieldStatus } from '@/lib/supabase/airfield-status'
import { updateNavaidStatus } from '@/lib/supabase/navaids'
import { bulkUpdateStatus } from '@/lib/supabase/infrastructure-features'
import { createOutageEvent } from '@/lib/supabase/outage-events'
import { logActivity } from '@/lib/supabase/activity'
import { createDiscrepancy } from '@/lib/supabase/discrepancies'
import { createSighting } from '@/lib/supabase/wildlife'
import { saveFprCheck, FPR_SAVED_REFETCH_FAILED } from '@/lib/supabase/fpr'
import {
  createDrivingCheck,
  updateDrivingCheck,
  DRIVING_CHECK_SAVED_REFETCH_FAILED,
} from '@/lib/supabase/driving-checks'
import {
  ConflictError,
  NonRetriableError,
  type WriteHandler,
  type WriteType,
} from './types'
import { WriteQueue } from './write-queue'

// ---------------------------------------------------------------------------
// Error classification helper
// ---------------------------------------------------------------------------

/**
 * Recognize Supabase / fetch / browser network-error messages so we can
 * mark them as transient (let the queue retry on next reconnect) rather
 * than NonRetriable (terminal failure visible to the user as "save
 * failed"). Each browser has its own wording; cover the common ones.
 */
const NETWORK_ERROR_RE =
  /failed to fetch|networkerror|network (error|failed|unreachable|request failed)|load failed|connection (refused|reset|timed out|aborted|closed)|the network connection was lost|the operation couldn['']?t be completed|err_(internet_disconnected|network|connection|name_not_resolved|timed_out)|fetch (failed|error|aborted)|aborted|etimedout|econnrefused|econnreset|enotfound|offline/i

function isNetworkErrorMessage(message: string): boolean {
  if (!message) return false
  if (NETWORK_ERROR_RE.test(message)) return true
  // Also treat any structured error that arrives while navigator says
  // we're offline as transient — covers messages we don't recognize.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return false
}

/**
 * Throw the right error for a structured `{ data, error }` failure.
 * Network shapes become plain Error (queue treats as transient);
 * everything else is NonRetriable.
 */
function throwForStructuredError(message: string): never {
  if (isNetworkErrorMessage(message)) {
    throw new Error(message)
  }
  throw new NonRetriableError(message)
}

// ---------------------------------------------------------------------------
// inspection_file
// ---------------------------------------------------------------------------

export type InspectionFilePayload = Parameters<typeof fileInspection>[0]
export type InspectionFileResult = Awaited<ReturnType<typeof fileInspection>>['data']

const inspectionFileHandler: WriteHandler<
  InspectionFilePayload,
  InspectionFileResult
> = async (payload) => {
  const { data, error } = await fileInspection(payload)
  if (error) throwForStructuredError(error)
  return data
}

// ---------------------------------------------------------------------------
// check_file
// ---------------------------------------------------------------------------

export type CheckFilePayload = Parameters<typeof createCheck>[0]
export type CheckFileResult = Awaited<ReturnType<typeof createCheck>>['data']

const checkFileHandler: WriteHandler<CheckFilePayload, CheckFileResult> = async (
  payload,
) => {
  const { data, error } = await createCheck(payload)
  if (error) throwForStructuredError(error)
  return data
}

// ---------------------------------------------------------------------------
// acsi_submit
// ---------------------------------------------------------------------------

export type AcsiSubmitPayload = Parameters<typeof fileAcsiInspection>[0]
export type AcsiSubmitResult = Awaited<ReturnType<typeof fileAcsiInspection>>['data']

const acsiSubmitHandler: WriteHandler<AcsiSubmitPayload, AcsiSubmitResult> = async (
  payload,
) => {
  const { data, error } = await fileAcsiInspection(payload)
  if (error) throwForStructuredError(error)
  return data
}

// ---------------------------------------------------------------------------
// daily_review_sign
// ---------------------------------------------------------------------------

export type DailyReviewSignPayload = Parameters<typeof signDailyReview>[0]
export type DailyReviewSignResult = Awaited<ReturnType<typeof signDailyReview>>['data']

const dailyReviewSignHandler: WriteHandler<
  DailyReviewSignPayload,
  DailyReviewSignResult
> = async (payload) => {
  // Daily review signatures are a regulatory record. Last-write-wins is
  // the wrong default — if the same slot for the same date was signed
  // by someone else between when the user queued and when the queue
  // drained, refuse to overwrite. The inspector surfaces this as a
  // 'conflict' status; the user can Discard once they verify the slot
  // is already signed (which the queued sign would have done anyway).
  const existing = await fetchDailyReview(payload.baseId, payload.date)
  if (existing) {
    const signedAt = (existing as DailyReviewRow & Record<string, unknown>)[
      `${payload.slot}_signed_at`
    ]
    if (typeof signedAt === 'string' && signedAt) {
      throw new ConflictError(
        `${payload.slot.toUpperCase()} slot for ${payload.date} was already signed at ${signedAt}.`,
      )
    }
  }
  const { data, error } = await signDailyReview(payload)
  if (error) throwForStructuredError(error)
  return data
}

// ---------------------------------------------------------------------------
// flip_review_sign
// ---------------------------------------------------------------------------

export type FlipReviewSignPayload = { reviewId: string; slot: FlipSignSlot }
export type FlipReviewSignResult = FlipSignoff | null

const flipReviewSignHandler: WriteHandler<FlipReviewSignPayload, FlipReviewSignResult> = async (
  payload,
) => {
  const { data, error } = await signFlipReviewDirect(payload.reviewId, payload.slot)
  // The RPC already enforces sequence + permanence; a server-side rejection
  // (already signed / out of order) is a conflict, not a transient error.
  if (error) throw new ConflictError(error)
  return data
}

// ---------------------------------------------------------------------------
// inspection_save_draft
// ---------------------------------------------------------------------------

export type InspectionSaveDraftPayload = Parameters<typeof createInspectionDraftWithId>[0]
export type InspectionSaveDraftResult = Awaited<
  ReturnType<typeof createInspectionDraftWithId>
>['data']

const inspectionSaveDraftHandler: WriteHandler<
  InspectionSaveDraftPayload,
  InspectionSaveDraftResult
> = async (payload) => {
  const { data, error } = await createInspectionDraftWithId(payload)
  if (error) {
    // Treat duplicate-key as success. This happens when the inline
    // INSERT at Begin time actually committed server-side but the
    // response was lost mid-flight (transient network drop), causing
    // the catch path to queue a retry. By the time the retry drains,
    // the row already exists with the same id — exactly the state we
    // wanted. Don't mark failed on the user's "already-synced" record.
    // friendlyError() maps "duplicate key" / "unique constraint"
    // violations to "This record already exists."
    if (/already exists/i.test(error)) return null
    throwForStructuredError(error)
  }
  return data
}

// ---------------------------------------------------------------------------
// discrepancy_create
// ---------------------------------------------------------------------------

export type DiscrepancyCreatePayload = Parameters<typeof createDiscrepancy>[0]
export type DiscrepancyCreateResult = Awaited<ReturnType<typeof createDiscrepancy>>['data']

const discrepancyCreateHandler: WriteHandler<
  DiscrepancyCreatePayload,
  DiscrepancyCreateResult
> = async (payload) => {
  const { data, error } = await createDiscrepancy(payload)
  if (error) throwForStructuredError(error)
  return data
}

// ---------------------------------------------------------------------------
// wildlife_sighting_create
// ---------------------------------------------------------------------------

export type WildlifeSightingCreatePayload = Parameters<typeof createSighting>[0]
export type WildlifeSightingCreateResult = Awaited<ReturnType<typeof createSighting>>['data']

const wildlifeSightingCreateHandler: WriteHandler<
  WildlifeSightingCreatePayload,
  WildlifeSightingCreateResult
> = async (payload) => {
  const { data, error } = await createSighting(payload)
  if (error) throwForStructuredError(error)
  return data
}

// ---------------------------------------------------------------------------
// airfield_status_update
// ---------------------------------------------------------------------------

export interface AirfieldStatusUpdatePayload {
  updates: Parameters<typeof updateAirfieldStatus>[0]
  baseId: string | null
}

const airfieldStatusUpdateHandler: WriteHandler<
  AirfieldStatusUpdatePayload,
  boolean
> = async (payload) => {
  const ok = await updateAirfieldStatus(payload.updates, payload.baseId)
  if (!ok) {
    // updateAirfieldStatus returns false on either no-row-found or a
    // structured error; treat as transient unless we're online (in which
    // case it's almost certainly a missing row, which retry won't fix).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('airfield_status update failed offline')
    }
    throw new NonRetriableError('airfield_status update failed (no row or RLS)')
  }
  return true
}

// ---------------------------------------------------------------------------
// navaid_status_update  (Airfield Status board NAVAID grid)
// ---------------------------------------------------------------------------

export interface NavaidStatusUpdatePayload {
  id: string
  status: 'green' | 'yellow' | 'red'
  notes: string | null
}

const navaidStatusUpdateHandler: WriteHandler<NavaidStatusUpdatePayload, boolean> = async (
  payload,
) => {
  const ok = await updateNavaidStatus(payload.id, payload.status, payload.notes)
  if (!ok) {
    // updateNavaidStatus returns false on a structured error or no row.
    // Offline → transient (retry on reconnect); online → non-retriable.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('navaid_status update failed offline')
    }
    throw new NonRetriableError('navaid_status update failed (no row or RLS)')
  }
  return true
}

// ---------------------------------------------------------------------------
// infrastructure_feature_status_update
// ---------------------------------------------------------------------------

export interface InfrastructureFeatureStatusUpdatePayload {
  ids: string[]
  status: 'operational' | 'inoperative'
}

const infrastructureFeatureStatusUpdateHandler: WriteHandler<
  InfrastructureFeatureStatusUpdatePayload,
  number
> = async (payload) => {
  const updated = await bulkUpdateStatus(payload.ids, payload.status)
  // bulkUpdateStatus returns 0 if all batches errored. Distinguish:
  //   - empty input → 0 with no error → treat as success (nothing to do)
  //   - non-empty input but 0 updated → some error path → retry transient
  if (payload.ids.length > 0 && updated === 0) {
    throw new Error('bulkUpdateStatus updated 0 rows')
  }
  return updated
}

// ---------------------------------------------------------------------------
// outage_event_create
// ---------------------------------------------------------------------------

export type OutageEventCreatePayload = Parameters<typeof createOutageEvent>[0]
export type OutageEventCreateResult = Awaited<ReturnType<typeof createOutageEvent>>

const outageEventCreateHandler: WriteHandler<
  OutageEventCreatePayload,
  OutageEventCreateResult
> = async (payload) => {
  const result = await createOutageEvent(payload)
  if (!result) throw new Error('createOutageEvent returned null')
  return result
}

// ---------------------------------------------------------------------------
// activity_log_insert
// ---------------------------------------------------------------------------

export interface ActivityLogInsertPayload {
  action: string
  entity_type: string
  entity_id: string
  entity_display_id?: string
  metadata?: Record<string, unknown>
  baseId?: string | null
  /**
   * Original wall-clock time of the user action — must be set when this
   * write was queued offline so the events log shows when the user
   * *actually* did the thing, not when the queue drained.
   */
  createdAt: string
}

const activityLogInsertHandler: WriteHandler<ActivityLogInsertPayload, null> = async (
  payload,
) => {
  const { error } = await logActivity(
    payload.action,
    payload.entity_type,
    payload.entity_id,
    payload.entity_display_id,
    payload.metadata,
    payload.baseId,
    payload.createdAt,
  )
  if (error) throwForStructuredError(error)
  return null
}

// ---------------------------------------------------------------------------
// dashboard_board_update
// ---------------------------------------------------------------------------

export interface DashboardBoardUpdatePayload {
  id: string
  layout: import('@/lib/dashboard/layout').BoardLayout
}

async function dashboardBoardUpdateHandler(p: DashboardBoardUpdatePayload): Promise<null> {
  const { updateBoardLayout } = await import('@/lib/supabase/dashboard-boards')
  const { error } = await updateBoardLayout(p.id, p.layout)
  if (error) throwForStructuredError(error)
  return null
}

// ---------------------------------------------------------------------------
// fpr_save
// ---------------------------------------------------------------------------

export type FprSavePayload = Parameters<typeof saveFprCheck>[0] & {
  /**
   * Pre-built Events Log (AF Form 3616) summary line — `summarizeFprCheck`
   * output computed on the page, where the resolved shift label lives.
   * Carried on the payload so this handler can write the completion entry
   * AFTER the save commits without needing the base's shift config.
   * Optional: replay/legacy payloads that lack it simply skip the log.
   */
  summary?: string
}
export type FprSaveResult = Awaited<ReturnType<typeof saveFprCheck>>['data']

/**
 * Replay-safe: saveFprCheck upserts on the natural key
 * (base_id, check_date, shift) and delete-and-rewrites the child
 * results, so draining the same queued save twice (or after a
 * lost-response commit) converges on the same single check row.
 *
 * Events Log write (controller-approved deviation from the spec's letter,
 * ledgered): the spec placed the `logActivity('completed', 'fpr', …)` call
 * in the page's completion handler. It lives HERE instead — after a
 * successful `saveFprCheck` — so the AF Form 3616 completion entry is
 * coupled to actual persistence: a queued/offline check documents its
 * completion when it truly commits (at drain), not when it was merely
 * enqueued. The house rule still holds — `lib/supabase/fpr.ts` never
 * touches `activity_log`; the log is hoisted out of the CRUD module into
 * the queue handler. The log is best-effort: a failure must not fail the
 * handler (that would retry the already-committed save and double-log).
 */
const fprSaveHandler: WriteHandler<FprSavePayload, FprSaveResult> = async (
  payload,
) => {
  const { data, error } = await saveFprCheck(payload)
  if (error) {
    // The save is an idempotent natural-key upsert. This specific error means
    // the upsert COMMITTED and only the follow-up re-fetch failed — classify
    // it transient so the queue retries (a retry re-commits harmlessly, then
    // re-fetches) rather than NonRetriable, which would permanently fail the
    // item, toast "Failed to save" on an already-saved check, and skip the
    // Events Log write.
    if (error === FPR_SAVED_REFETCH_FAILED) throw new Error(error)
    throwForStructuredError(error)
  }
  if (data?.id && payload.summary) {
    try {
      await logActivity(
        'completed',
        'fpr',
        data.id,
        undefined,
        { details: payload.summary.toUpperCase() },
        payload.baseId,
      )
    } catch {
      /* best-effort — the check is already saved; don't retry & double-log */
    }
  }
  return data
}

// ---------------------------------------------------------------------------
// driving_check_save
// ---------------------------------------------------------------------------

export type DrivingCheckSavePayload = Parameters<typeof createDrivingCheck>[0] & {
  /**
   * Pre-built Events Log summary line — `summarizeDrivingCheck` output
   * (prefixed with the "Airfield Driving Spot Check" framing by the page,
   * a later task) computed where the full check-with-results shape is
   * available. Carried on the payload so this handler can write the
   * completion entry AFTER the save commits without re-fetching. Optional:
   * replay/legacy payloads that lack it simply skip the log.
   */
  summary?: string
}
export type DrivingCheckSaveResult = Awaited<ReturnType<typeof createDrivingCheck>>['data']

/**
 * NOT idempotent: `driving_checks` has no natural key (spot checks are
 * random and unbounded per day — plain inserts, like an event log; see
 * the design spec's Architecture decision). If the INSERT commits but the
 * queue crashes/reloads before the drain loop's `storage.delete(item.id)`
 * runs, replaying this item on a later drain inserts a second row for the
 * same check. This mirrors the `check_file` handler above — `createCheck`
 * on `airfield_checks` is likewise a plain insert with no dedup key —
 * so this is an accepted risk carried forward from existing precedent,
 * not a new gap introduced here. Do not add new idempotency
 * infrastructure to close it; it's an owner call for a future task if the
 * duplicate-row rate in practice warrants it.
 *
 * Events Log write happens HERE (after a successful createDrivingCheck),
 * same placement as fpr_save above: a queued/offline check documents its
 * completion when it truly commits (at drain), not when it was merely
 * enqueued. lib/supabase/driving-checks.ts never touches activity_log.
 * The log is best-effort: a failure must not fail the handler (that would
 * retry the already-committed save and double-log).
 */
const drivingCheckSaveHandler: WriteHandler<DrivingCheckSavePayload, DrivingCheckSaveResult> = async (
  payload,
) => {
  const { data, error } = await createDrivingCheck(payload)
  if (error) {
    if (error === DRIVING_CHECK_SAVED_REFETCH_FAILED) throw new Error(error)
    throwForStructuredError(error)
  }
  if (data?.id && payload.summary) {
    try {
      await logActivity(
        'completed',
        'driving_check',
        data.id,
        undefined,
        { details: payload.summary.toUpperCase() },
        payload.baseId,
      )
    } catch {
      /* best-effort — the check is already saved; don't retry & double-log */
    }
  }
  return data
}

// ---------------------------------------------------------------------------
// driving_check_update
// ---------------------------------------------------------------------------

export type DrivingCheckUpdatePayload = { id: string } & Parameters<typeof updateDrivingCheck>[1]
export type DrivingCheckUpdateResult = Awaited<ReturnType<typeof updateDrivingCheck>>['data']

/**
 * Edits (typo fixes) never re-log to the Events Log — SCN/FPR precedent:
 * completion logs once, on create; edits don't re-log. Replay-safe: this
 * is a real UPDATE by id (not an insert), so replaying an already-applied
 * update just re-applies the same fields and re-rewrites the same child
 * results — no double-insert risk like the create path above.
 */
const drivingCheckUpdateHandler: WriteHandler<DrivingCheckUpdatePayload, DrivingCheckUpdateResult> = async (
  payload,
) => {
  const { id, ...input } = payload
  const { data, error } = await updateDrivingCheck(id, input)
  if (error) {
    if (error === DRIVING_CHECK_SAVED_REFETCH_FAILED) throw new Error(error)
    throwForStructuredError(error)
  }
  return data
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Wire all currently-supported handlers onto a queue instance. Idempotent;
 * registering twice is a no-op (Map overwrites). Called from the provider
 * once at app startup.
 *
 * As features wrap onto the queue (discrepancies, ACSI, …), add their
 * handlers here.
 */
export function registerAllHandlers(queue: WriteQueue): void {
  queue.registerHandler('inspection_file', inspectionFileHandler)
  queue.registerHandler('check_file', checkFileHandler)
  queue.registerHandler('acsi_submit', acsiSubmitHandler)
  queue.registerHandler('daily_review_sign', dailyReviewSignHandler)
  queue.registerHandler('flip_review_sign', flipReviewSignHandler)
  queue.registerHandler('airfield_status_update', airfieldStatusUpdateHandler)
  queue.registerHandler('navaid_status_update', navaidStatusUpdateHandler)
  queue.registerHandler(
    'infrastructure_feature_status_update',
    infrastructureFeatureStatusUpdateHandler,
  )
  queue.registerHandler('outage_event_create', outageEventCreateHandler)
  queue.registerHandler('activity_log_insert', activityLogInsertHandler)
  queue.registerHandler('discrepancy_create', discrepancyCreateHandler)
  queue.registerHandler('inspection_save_draft', inspectionSaveDraftHandler)
  queue.registerHandler('dashboard_board_update', dashboardBoardUpdateHandler)
  queue.registerHandler('wildlife_sighting_create', wildlifeSightingCreateHandler)
  queue.registerHandler('fpr_save', fprSaveHandler)
  queue.registerHandler('driving_check_save', drivingCheckSaveHandler)
  queue.registerHandler('driving_check_update', drivingCheckUpdateHandler)
}

/**
 * Handlers exposed as a map for tests that want to invoke a handler in
 * isolation without spinning up a WriteQueue instance.
 */
export const HANDLERS: Partial<Record<WriteType, WriteHandler<any, any>>> = {
  inspection_file: inspectionFileHandler,
  check_file: checkFileHandler,
  acsi_submit: acsiSubmitHandler,
  daily_review_sign: dailyReviewSignHandler,
  flip_review_sign: flipReviewSignHandler,
  airfield_status_update: airfieldStatusUpdateHandler,
  navaid_status_update: navaidStatusUpdateHandler,
  infrastructure_feature_status_update: infrastructureFeatureStatusUpdateHandler,
  outage_event_create: outageEventCreateHandler,
  activity_log_insert: activityLogInsertHandler,
  discrepancy_create: discrepancyCreateHandler,
  inspection_save_draft: inspectionSaveDraftHandler,
  dashboard_board_update: dashboardBoardUpdateHandler,
  wildlife_sighting_create: wildlifeSightingCreateHandler,
  fpr_save: fprSaveHandler,
  driving_check_save: drivingCheckSaveHandler,
  driving_check_update: drivingCheckUpdateHandler,
}
