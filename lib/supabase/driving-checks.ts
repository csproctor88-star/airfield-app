import { createClient } from './client'
import { friendlyError } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DRIVING_CHECK_DEFAULT_ITEMS } from '@/lib/driving-check-default-items'

// ─────────────────────────────────────────────────────────────
// Airfield Driving Spot Check CRUD.
//
// Modeled on lib/supabase/scn.ts / lib/supabase/fpr.ts: friendly error
// strings and a pure summarize function for the Events Log preview.
// Schema in staged migrations 2026071750/2026071751.
//
// One deliberate divergence from SCN/FPR: driving_checks has NO natural
// key — spot checks are random and unbounded per day, so this is a plain
// event-log insert (create) / update-by-id (edit), never an upsert.
//
// The driving_check_* tables are created by staged migrations and are
// not yet in the generated Database type, so route queries through an
// untyped client (same idiom as amtr.ts / flip.ts) until the owner
// applies the migrations and regenerates types.
//
// House rule: this module never calls logActivity. The Events Log write
// happens in the offline-queue handler (lib/sync/handlers.ts), after a
// successful save — see saveDrivingCheck's queue wiring there.
// ─────────────────────────────────────────────────────────────

function db(): SupabaseClient | null {
  return createClient() as unknown as SupabaseClient | null
}

export type Form483Status = 'valid' | 'expired' | 'not_in_possession' | 'none'
export type DrivingItemStatus = 'pass' | 'discrepancy' | 'na'
export type DrivingCheckResult = 'pass' | 'discrepancy' | 'violation'
export type VehicleType = 'government' | 'contractor' | 'pov' | 'other'

export const FORM_483_LABELS: Record<Form483Status, string> = {
  valid: 'Valid',
  expired: 'Expired',
  not_in_possession: 'Not in Possession',
  none: 'None Issued',
}

export const DRIVING_RESULT_LABELS: Record<DrivingCheckResult, string> = {
  pass: 'Pass',
  discrepancy: 'Discrepancy',
  violation: 'Violation',
}

export const DRIVING_RESULT_COLORS: Record<DrivingCheckResult, string> = {
  pass: 'var(--color-success)',
  discrepancy: 'var(--color-warning)',
  violation: 'var(--color-danger)',
}

export type DrivingCheckItemRow = {
  id: string
  base_id: string
  label: string
  guidance: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type DrivingCheckRow = {
  id: string
  base_id: string
  checked_at: string
  driver_name: string
  driver_rank: string | null
  driver_unit: string | null
  driver_office_symbol: string | null
  driver_phone: string | null
  contractor_id: string | null
  form_483_status: Form483Status
  form_483_expires: string | null
  vehicle_type: VehicleType | null
  vehicle_id: string | null
  pov_pass_number: string | null
  location: string
  overall_result: DrivingCheckResult
  violation_description: string | null
  notes: string | null
  completed_by: string | null
  completed_by_oi: string | null
  completed_by_name: string | null
  created_at: string
  updated_at: string
}

export type DrivingCheckResultRow = {
  id: string
  check_id: string
  item_id: string | null
  item_label: string
  status: DrivingItemStatus
  notes: string | null
  sort_order: number
  created_at: string
}

export type DrivingCheckWithResults = DrivingCheckRow & { results: DrivingCheckResultRow[] }

export type DrivingCheckResultInput = {
  item_id: string | null
  item_label: string
  status: DrivingItemStatus
  notes?: string | null
  sort_order: number
}

// ─────────────────────────────────────────────────────────────
// Pure helpers (unit-tested; no Supabase access)
// ─────────────────────────────────────────────────────────────

/**
 * Derive the stored overall_result from the AF Form 483 status, the
 * per-item results, and the explicit violation-flag checkbox. Truth
 * table, in precedence order:
 *   1. form483 !== 'valid'  → violation. Operating without a valid card
 *      (expired / not in possession / none issued) is itself the
 *      violation, regardless of item results or the flag.
 *   2. violationFlag        → violation. The explicit "Airfield driving
 *      violation" checkbox, independent of 483 status.
 *   3. any item 'discrepancy' → discrepancy.
 *   4. otherwise            → pass.
 * Stored on the row (not just derived at read time) so history filters
 * and the AOB report can query it cheaply.
 */
export function deriveOverallResult(
  form483: Form483Status,
  items: Array<{ status: DrivingItemStatus }>,
  violationFlag: boolean,
): DrivingCheckResult {
  if (form483 !== 'valid' || violationFlag) return 'violation'
  if (items.some((i) => i.status === 'discrepancy')) return 'discrepancy'
  return 'pass'
}

/**
 * Summarize a check for the Events Log preview: driver, unit, 483
 * status, result, location. Deliberately does NOT prepend the
 * "Airfield Driving Spot Check" module framing — that's added by the
 * page's completion handler (a later task) before the line is
 * `.toUpperCase()`'d for the Events Log entry. Pure. Returns e.g.
 *   "SSgt Snuffy, 100 ARW/SE — AF Form 483 Valid — Pass (Taxiway A)"
 *   "A1C Doe — AF Form 483 Expired — Violation: Operating without a valid card (Gate 5)"
 *   "TSgt Lee, 100 LRS/LGRT — AF Form 483 Valid — Discrepancy: Seat belts in use (not worn) (Ramp 3)"
 * which, prefixed and uppercased by the page, matches the design spec's
 * example: "AIRFIELD DRIVING SPOT CHECK — SSGT SNUFFY, 100 ARW/SE — AF
 * FORM 483 VALID — PASS (TAXIWAY A)".
 */
export function summarizeDrivingCheck(check: DrivingCheckWithResults): string {
  const driverDisplay = [check.driver_rank, check.driver_name].filter(Boolean).join(' ')
  const unitSuffix = check.driver_unit ? `, ${check.driver_unit}` : ''
  const formLabel = FORM_483_LABELS[check.form_483_status]
  const resultLabel = DRIVING_RESULT_LABELS[check.overall_result]

  let resultDetail = resultLabel
  if (check.overall_result === 'violation') {
    if (check.violation_description) {
      resultDetail = `${resultLabel}: ${check.violation_description}`
    }
  } else if (check.overall_result === 'discrepancy') {
    const discrepancies = check.results.filter((r) => r.status === 'discrepancy')
    if (discrepancies.length > 0) {
      const parts = discrepancies.map((r) => (r.notes ? `${r.item_label} (${r.notes})` : r.item_label))
      resultDetail = `${resultLabel}: ${parts.join(', ')}`
    }
  }

  const locationSuffix = check.location ? ` (${check.location})` : ''
  return `${driverDisplay}${unitSuffix} — AF Form 483 ${formLabel} — ${resultDetail}${locationSuffix}`
}

export type AobStats = {
  total: number
  passRate: number | null
  discrepancyCount: number
  violationCount: number
  /** Desc by count, label tiebreak (alphabetical). */
  commonDiscrepancies: Array<{ label: string; count: number }>
  byChecker: Array<{ name: string; oi: string | null; total: number; passRate: number | null; violations: number }>
}

/**
 * Compute AOB (Airfield Operations Board) stats for a set of checks —
 * feeds both the /driving-checks stat strip and the PDF export (single
 * source of truth). Pure.
 *
 * byChecker groups by operating initials (`completed_by_oi`) when
 * present — a stable identity across a name-snapshot change (e.g. a
 * promotion mid-period) — falling back to the name snapshot only when
 * no OI was recorded, so legacy/unattributed checks still roll up
 * somewhere rather than being dropped.
 */
export function computeAobStats(checks: DrivingCheckWithResults[]): AobStats {
  const total = checks.length
  const passCount = checks.filter((c) => c.overall_result === 'pass').length
  const discrepancyCount = checks.filter((c) => c.overall_result === 'discrepancy').length
  const violationCount = checks.filter((c) => c.overall_result === 'violation').length
  const passRate = total === 0 ? null : passCount / total

  const discrepancyCounts = new Map<string, number>()
  for (const check of checks) {
    for (const r of check.results) {
      if (r.status === 'discrepancy') {
        discrepancyCounts.set(r.item_label, (discrepancyCounts.get(r.item_label) ?? 0) + 1)
      }
    }
  }
  const commonDiscrepancies = Array.from(discrepancyCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

  type CheckerAgg = { name: string; oi: string | null; total: number; passCount: number; violations: number }
  const byCheckerMap = new Map<string, CheckerAgg>()
  for (const check of checks) {
    const oi = check.completed_by_oi || null
    const name = check.completed_by_name || 'Unknown'
    const key = oi ?? `name:${name}`
    let agg = byCheckerMap.get(key)
    if (!agg) {
      agg = { name, oi, total: 0, passCount: 0, violations: 0 }
      byCheckerMap.set(key, agg)
    }
    agg.total += 1
    agg.name = name // latest snapshot wins
    if (check.overall_result === 'pass') agg.passCount += 1
    if (check.overall_result === 'violation') agg.violations += 1
  }
  const byChecker = Array.from(byCheckerMap.values())
    .map((a) => ({
      name: a.name,
      oi: a.oi,
      total: a.total,
      passRate: a.total === 0 ? null : a.passCount / a.total,
      violations: a.violations,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  return { total, passRate, discrepancyCount, violationCount, commonDiscrepancies, byChecker }
}

// ─────────────────────────────────────────────────────────────
// Item list (per-base config)
// ─────────────────────────────────────────────────────────────

export async function fetchDrivingCheckItems(baseId: string, activeOnly = false): Promise<DrivingCheckItemRow[]> {
  const supabase = db()
  if (!supabase || !baseId) return []

  let query = supabase
    .from('driving_check_items')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) {
    console.error('fetchDrivingCheckItems failed:', error.message)
    return []
  }
  return (data || []) as DrivingCheckItemRow[]
}

export async function createDrivingCheckItem(
  baseId: string,
  label: string,
  guidance?: string | null,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const trimmed = label.trim()
  if (!trimmed) return { error: 'Item label is required' }

  const { data: existing } = await supabase
    .from('driving_check_items')
    .select('sort_order')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order : 0) + 10

  const { error } = await supabase.from('driving_check_items').insert({
    base_id: baseId,
    label: trimmed,
    guidance: guidance?.trim() || null,
    sort_order: nextOrder,
  })
  return { error: error ? friendlyError(error.message) : null }
}

export async function updateDrivingCheckItem(
  id: string,
  patch: Partial<Pick<DrivingCheckItemRow, 'label' | 'guidance' | 'is_active'>>,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) fields.label = patch.label.trim()
  if (patch.guidance !== undefined) fields.guidance = patch.guidance?.trim() || null
  if (patch.is_active !== undefined) fields.is_active = patch.is_active

  const { error } = await supabase.from('driving_check_items').update(fields).eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

/** Persist a new ordering: sort_order is reassigned (10, 20, 30, …) in array order. */
export async function reorderDrivingCheckItems(orderedIds: string[]): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('driving_check_items')
      .update({ sort_order: (i + 1) * 10, updated_at: new Date().toISOString() })
      .eq('id', orderedIds[i])
    if (error) return { error: friendlyError(error.message) }
  }
  return { error: null }
}

export async function deleteDrivingCheckItem(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('driving_check_items').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

/**
 * Insert the proposed default items from lib/driving-check-default-items.ts.
 * Intended for an empty list (the wizard's "Load default items" button,
 * mirroring QRC/FPR's import-defaults idiom); skips items whose label
 * already exists at the base so a replay/double-click can't duplicate rows.
 */
export async function seedDefaultDrivingCheckItems(baseId: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: existing, error: fetchErr } = await supabase
    .from('driving_check_items')
    .select('label')
    .eq('base_id', baseId)
  if (fetchErr) return { error: friendlyError(fetchErr.message) }

  const existingLabels = new Set(((existing || []) as { label: string }[]).map((i) => i.label))
  const toInsert = DRIVING_CHECK_DEFAULT_ITEMS
    .filter((item) => !existingLabels.has(item.label))
    .map((item, i) => ({
      base_id: baseId,
      label: item.label,
      guidance: item.guidance ?? null,
      sort_order: (i + 1) * 10,
    }))
  if (toInsert.length === 0) return { error: null }

  const { error } = await supabase.from('driving_check_items').insert(toInsert)
  return { error: error ? friendlyError(error.message) : null }
}

// ─────────────────────────────────────────────────────────────
// Checks (event log — plain insert, no upsert)
// ─────────────────────────────────────────────────────────────

async function attachResults(supabase: SupabaseClient, checks: DrivingCheckRow[]): Promise<DrivingCheckWithResults[]> {
  if (checks.length === 0) return []
  const ids = checks.map((c) => c.id)
  const { data: results } = await supabase
    .from('driving_check_results')
    .select('*')
    .in('check_id', ids)
    .order('sort_order', { ascending: true })

  const byCheck = new Map<string, DrivingCheckResultRow[]>()
  for (const r of (results || []) as DrivingCheckResultRow[]) {
    const arr = byCheck.get(r.check_id) ?? []
    arr.push(r)
    byCheck.set(r.check_id, arr)
  }
  return checks.map((c) => ({ ...c, results: byCheck.get(c.id) ?? [] }))
}

async function fetchDrivingCheckWithResultsById(supabase: SupabaseClient, id: string): Promise<DrivingCheckWithResults | null> {
  const { data: check, error } = await supabase
    .from('driving_checks')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !check) return null

  const [withResults] = await attachResults(supabase, [check as DrivingCheckRow])
  return withResults ?? null
}

export async function fetchDrivingChecksInRange(
  baseId: string,
  startIso: string,
  endIso: string,
): Promise<DrivingCheckWithResults[]> {
  const supabase = db()
  if (!supabase || !baseId) return []

  const { data: checks } = await supabase
    .from('driving_checks')
    .select('*')
    .eq('base_id', baseId)
    .gte('checked_at', startIso)
    .lte('checked_at', endIso)
    .order('checked_at', { ascending: true })

  if (!checks || checks.length === 0) return []
  return attachResults(supabase, checks as DrivingCheckRow[])
}

/**
 * `createDrivingCheck`/`updateDrivingCheck`'s error string for the narrow
 * case where the INSERT/UPDATE COMMITTED but the follow-up re-fetch
 * round-trip failed. The write is durable, so callers (the write-queue
 * handler) must treat this as transient, never as a hard save failure.
 * Exported so the handler can classify it exactly, without string-drift.
 */
export const DRIVING_CHECK_SAVED_REFETCH_FAILED = 'Saved but could not re-fetch check'

export type DrivingCheckFormInput = {
  /** Defaults to now() via the DB column default when omitted. An offline-
   *  queued create should pass the original field time so a delayed drain
   *  doesn't misdate the check to when the queue happened to drain. */
  checkedAt?: string | null
  driverName: string
  driverRank?: string | null
  driverUnit?: string | null
  driverOfficeSymbol?: string | null
  driverPhone?: string | null
  contractorId?: string | null
  form483Status: Form483Status
  form483Expires?: string | null
  vehicleType?: VehicleType | null
  vehicleId?: string | null
  povPassNumber?: string | null
  location: string
  /** Computed by deriveOverallResult() and passed in — stored, not derived at read time. */
  overallResult: DrivingCheckResult
  violationDescription?: string | null
  notes?: string | null
  operatingInitials?: string | null
  /** Display-name snapshot of the person conducting the check — feeds the by-checker AOB report. */
  completedByName?: string | null
  items: DrivingCheckResultInput[]
}

export type CreateDrivingCheckInput = DrivingCheckFormInput & { baseId: string }
export type UpdateDrivingCheckInput = DrivingCheckFormInput

function buildCheckPayload(input: DrivingCheckFormInput, userId: string | null): Record<string, unknown> {
  return {
    checked_at: input.checkedAt || new Date().toISOString(),
    driver_name: input.driverName.trim(),
    driver_rank: input.driverRank?.trim() || null,
    driver_unit: input.driverUnit?.trim() || null,
    driver_office_symbol: input.driverOfficeSymbol?.trim() || null,
    driver_phone: input.driverPhone?.trim() || null,
    contractor_id: input.contractorId || null,
    form_483_status: input.form483Status,
    form_483_expires: input.form483Expires || null,
    vehicle_type: input.vehicleType || null,
    vehicle_id: input.vehicleId?.trim() || null,
    pov_pass_number: input.povPassNumber?.trim() || null,
    location: input.location.trim(),
    overall_result: input.overallResult,
    violation_description: input.violationDescription?.trim() || null,
    notes: input.notes?.trim() || null,
    completed_by: userId,
    completed_by_oi: input.operatingInitials?.trim() || null,
    completed_by_name: input.completedByName?.trim() || null,
  }
}

async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null // unauthenticated — skip attribution
  }
}

/**
 * Insert a new spot check + its item results. Plain insert — no natural
 * key, no upsert (see the module header). Replay caveat: because there is
 * no natural key, replaying an already-committed create (e.g. the write
 * queue retries after the INSERT committed but the drain loop's ack step
 * never ran) inserts a second row for the same check. This mirrors
 * `check_file` (createCheck on `airfield_checks`, also a plain insert
 * with no dedup key) — an accepted risk, not a new gap introduced here.
 */
export async function createDrivingCheck(
  input: CreateDrivingCheckInput,
): Promise<{ data: DrivingCheckWithResults | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const userId = await currentUserId(supabase)
  const checkPayload = { base_id: input.baseId, ...buildCheckPayload(input, userId) }

  const { data: inserted, error } = await supabase
    .from('driving_checks')
    .insert(checkPayload)
    .select('id')
    .single()
  if (error || !inserted) return { data: null, error: friendlyError(error?.message || 'Failed to save check') }
  const checkId = (inserted as { id: string }).id

  if (input.items.length > 0) {
    const resultRows = input.items.map((i) => ({
      check_id: checkId,
      item_id: i.item_id,
      item_label: i.item_label,
      status: i.status,
      notes: i.notes || null,
      sort_order: i.sort_order,
    }))
    const { error: rErr } = await supabase.from('driving_check_results').insert(resultRows)
    if (rErr) return { data: null, error: friendlyError(rErr.message) }
  }

  const full = await fetchDrivingCheckWithResultsById(supabase, checkId)
  if (!full) return { data: null, error: DRIVING_CHECK_SAVED_REFETCH_FAILED }
  return { data: full, error: null }
}

/**
 * Update an existing spot check by id and rewrite its per-item results
 * (delete-and-rewrite children, per the scn.ts/fpr.ts idiom). Replay-safe:
 * re-running the same update lands on the same row and rewrites the same
 * results — unlike create, this is a real UPDATE by id, not an insert, so
 * there's no double-insert risk on replay.
 */
export async function updateDrivingCheck(
  id: string,
  input: UpdateDrivingCheckInput,
): Promise<{ data: DrivingCheckWithResults | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const userId = await currentUserId(supabase)
  const checkPayload = buildCheckPayload(input, userId)

  const { error } = await supabase.from('driving_checks').update(checkPayload).eq('id', id)
  if (error) return { data: null, error: friendlyError(error.message) }

  // Clear existing results so we can rewrite — a silent delete failure
  // followed by the reinsert below would duplicate result rows.
  const { error: clearError } = await supabase.from('driving_check_results').delete().eq('check_id', id)
  if (clearError) return { data: null, error: friendlyError(clearError.message) }

  if (input.items.length > 0) {
    const resultRows = input.items.map((i) => ({
      check_id: id,
      item_id: i.item_id,
      item_label: i.item_label,
      status: i.status,
      notes: i.notes || null,
      sort_order: i.sort_order,
    }))
    const { error: rErr } = await supabase.from('driving_check_results').insert(resultRows)
    if (rErr) return { data: null, error: friendlyError(rErr.message) }
  }

  const full = await fetchDrivingCheckWithResultsById(supabase, id)
  if (!full) return { data: null, error: DRIVING_CHECK_SAVED_REFETCH_FAILED }
  return { data: full, error: null }
}

export async function deleteDrivingCheck(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('driving_checks').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
