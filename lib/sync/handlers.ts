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

import { fileInspection } from '@/lib/supabase/inspections'
import { createCheck } from '@/lib/supabase/checks'
import { fileAcsiInspection } from '@/lib/supabase/acsi-inspections'
import {
  fetchDailyReview,
  signDailyReview,
  type DailyReviewRow,
} from '@/lib/supabase/daily-reviews'
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
}
