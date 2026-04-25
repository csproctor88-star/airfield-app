/**
 * Write-queue handlers per WriteType.
 *
 * Each handler adapts a Glidepath CRUD module (which returns
 * `{ data, error }`) into the throw-on-failure shape the queue expects.
 *
 * Error classification:
 *   - Structured error from the server (PostgrestError surfaced through
 *     fileInspection, etc.) → NonRetriableError. RLS denials, schema
 *     violations, FK errors — retry won't help.
 *   - Thrown TypeError / fetch failure → transient, default catch path
 *     so the queue retries with backoff.
 *
 * That heuristic mis-classifies transient 5xx/429 as non-retriable. Cost
 * is acceptable: those are rare in our deployment and the user can
 * "retry" from the queue inspector. Keeping it simple beats a regex over
 * friendlyError-mangled strings.
 */

import { fileInspection } from '@/lib/supabase/inspections'
import { createCheck } from '@/lib/supabase/checks'
import { fileAcsiInspection } from '@/lib/supabase/acsi-inspections'
import {
  NonRetriableError,
  type WriteHandler,
  type WriteType,
} from './types'
import { WriteQueue } from './write-queue'

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
  if (error) throw new NonRetriableError(error)
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
  if (error) throw new NonRetriableError(error)
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
  if (error) throw new NonRetriableError(error)
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
}

/**
 * Handlers exposed as a map for tests that want to invoke a handler in
 * isolation without spinning up a WriteQueue instance.
 */
export const HANDLERS: Partial<Record<WriteType, WriteHandler<any, any>>> = {
  inspection_file: inspectionFileHandler,
  check_file: checkFileHandler,
  acsi_submit: acsiSubmitHandler,
}
