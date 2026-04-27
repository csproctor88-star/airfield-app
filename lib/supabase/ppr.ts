import { createClient } from './client'
import { logActivity } from './activity'
import { friendlyError } from '@/lib/utils'

function db() {
  return createClient()
}

// ── Types ──

export type PprColumnType = 'text' | 'date' | 'time' | 'yes_no_na' | 'phone' | 'number' | 'email' | 'info_only'

export const PPR_COLUMN_TYPES: { value: PprColumnType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'yes_no_na', label: 'Yes / No / N/A' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'info_only', label: 'Info Only (read-only)' },
]

export type PprColumn = {
  id: string
  base_id: string
  column_name: string
  column_type: PprColumnType
  sort_order: number
  is_required: boolean
  is_public: boolean
  /** Body shown for info_only columns — null/unused for input types. */
  info_text: string | null
  created_at: string
}

export type PprStatus =
  | 'pending_amops_triage'
  | 'pending_coordination'
  | 'pending_amops_approval'
  | 'approved'
  | 'denied'

export type PprEntry = {
  id: string
  base_id: string
  ppr_number: string
  arrival_date: string
  column_values: Record<string, string>
  notes: string | null
  approver_oi: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  status: PprStatus
  requester_name: string | null
  requester_email: string | null
  triaged_by: string | null
  triaged_at: string | null
  approval_user_id: string | null
  approval_at: string | null
  denial_reason: string | null
  public_submission: boolean
}

export type PprCoordination = {
  id: string
  entry_id: string
  agency_id: string | null
  agency_name: string
  status: 'pending' | 'concur' | 'non_concur'
  comment: string | null
  coordinated_by: string | null
  coordinated_at: string | null
  created_at: string
}

export type PprRemark = {
  id: string
  entry_id: string
  base_id: string
  remark: string
  created_by: string | null
  created_at: string
  user_name?: string
  user_rank?: string
}

// ── PPR Number Generation ──

/** Get Julian day (1-366) from a date string (YYYY-MM-DD) */
function julianDay(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

/** Generate PPR number: {julian_day}-{sequence}-{OI} */
export function generatePprNumber(julDay: number, sequence: number, oi: string): string {
  const dayStr = String(julDay).padStart(3, '0')
  const seqStr = String(sequence).padStart(3, '0')
  return `${dayStr}-${seqStr}-${oi || 'XX'}`
}

/**
 * Replace the trailing OI segment of an existing PPR number with a
 * new OI. Used on approval of a public submission so the PPR# the
 * requester receives carries the approver's initials instead of
 * the 'XX' placeholder. Falls through unchanged if the number
 * doesn't fit the expected `{jul}-{seq}-{OI}` shape.
 */
export function rewritePprOiSegment(pprNumber: string, newOi: string): string {
  const trimmed = newOi.trim()
  if (!trimmed) return pprNumber
  const parts = pprNumber.split('-')
  if (parts.length < 3) return pprNumber
  parts[parts.length - 1] = trimmed
  return parts.join('-')
}

// ── Columns CRUD ──

export async function fetchPprColumns(baseId: string): Promise<PprColumn[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('ppr_columns')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })

  return (data || []) as PprColumn[]
}

export async function createPprColumn(input: {
  base_id: string
  column_name: string
  column_type?: PprColumnType
  sort_order?: number
  is_required?: boolean
  is_public?: boolean
  info_text?: string | null
}): Promise<PprColumn | null> {
  const supabase = db()
  if (!supabase) return null

  // info_text only meaningful for info_only columns; cast through any
  // until the regenerated types pick up the new field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ppr_columns')
    .insert(input)
    .select()
    .single()

  if (error || !data) return null
  return data as PprColumn
}

export async function updatePprColumn(
  id: string,
  updates: Partial<Pick<PprColumn, 'column_name' | 'column_type' | 'sort_order' | 'is_required' | 'is_public' | 'info_text'>>,
): Promise<PprColumn | null> {
  const supabase = db()
  if (!supabase) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ppr_columns')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return data as PprColumn
}

export async function deletePprColumn(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('ppr_columns')
    .delete()
    .eq('id', id)

  return !error
}

// ── Entries CRUD ──

export async function fetchPprEntries(baseId: string, dateFrom?: string, dateTo?: string): Promise<PprEntry[]> {
  const supabase = db()
  if (!supabase) return []

  let query = supabase
    .from('ppr_entries')
    .select('*')
    .eq('base_id', baseId)
    .order('arrival_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (dateFrom) query = query.gte('arrival_date', dateFrom)
  if (dateTo) query = query.lte('arrival_date', dateTo)

  const { data } = await query
  return (data || []) as PprEntry[]
}

export async function fetchPprEntriesForDate(baseId: string, date: string): Promise<PprEntry[]> {
  return fetchPprEntries(baseId, date, date)
}

/** Count existing PPRs for a given base + arrival date (for sequence numbering) */
async function countPprsForDate(baseId: string, arrivalDate: string): Promise<number> {
  const supabase = db()
  if (!supabase) return 0

  const { count } = await supabase
    .from('ppr_entries')
    .select('id', { count: 'exact', head: true })
    .eq('base_id', baseId)
    .eq('arrival_date', arrivalDate)

  return count ?? 0
}

/**
 * Internal AMOPS create flow.
 *
 * - `agencyIds = []`  → "Pre-coordinated" path. Entry lands at
 *                       status='approved' with approval_user_id set
 *                       (skips triage + coordination). approver_oi
 *                       stamped from input.
 * - `agencyIds = [...]` → Triage already done at create time. Entry
 *                       lands at status='pending_coordination', a
 *                       ppr_coordination row is inserted per agency,
 *                       triaged_by/at stamped to current user.
 */
export async function createPprEntry(input: {
  base_id: string
  arrival_date: string
  column_values: Record<string, string>
  notes?: string
  approver_oi: string
  agencyIds?: string[]
}): Promise<PprEntry | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const agencyIds = input.agencyIds ?? []
  const skipCoordination = agencyIds.length === 0
  const nowIso = new Date().toISOString()

  // Generate PPR number
  const existingCount = await countPprsForDate(input.base_id, input.arrival_date)
  const julDay = julianDay(input.arrival_date)
  const pprNumber = generatePprNumber(julDay, existingCount + 1, input.approver_oi)

  const { data, error } = await supabase
    .from('ppr_entries')
    .insert({
      base_id: input.base_id,
      ppr_number: pprNumber,
      arrival_date: input.arrival_date,
      column_values: input.column_values,
      notes: input.notes || null,
      approver_oi: skipCoordination ? input.approver_oi : null,
      created_by: user.id,
      updated_by: user.id,
      public_submission: false,
      status: skipCoordination ? 'approved' : 'pending_coordination',
      approval_user_id: skipCoordination ? user.id : null,
      approval_at: skipCoordination ? nowIso : null,
      triaged_by: skipCoordination ? null : user.id,
      triaged_at: skipCoordination ? null : nowIso,
    })
    .select()
    .single()

  if (error || !data) return null

  const entry = data as PprEntry

  // Insert coord rows for non-skipped path. Denormalize agency_name
  // so config deletes don't lose history.
  if (!skipCoordination) {
    const agencies = await supabase
      .from('ppr_agencies')
      .select('id, agency_name')
      .in('id', agencyIds)

    const agencyRows = (agencies.data || []) as { id: string; agency_name: string }[]
    if (agencyRows.length > 0) {
      const coordRows = agencyRows.map((a) => ({
        entry_id: entry.id,
        agency_id: a.id,
        agency_name: a.agency_name,
        status: 'pending' as const,
      }))
      const { error: coordErr } = await supabase.from('ppr_coordination').insert(coordRows)
      if (coordErr) {
        console.error('createPprEntry coord insert failed:', coordErr.message)
      } else {
        // Same fire-and-forget coord email as the public-triage path.
        try {
          await fetch('/api/send-ppr-coordination-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entryId: entry.id, agencyIds }),
          })
        } catch (e) {
          console.error('createPprEntry email send failed:', e)
        }
      }
    }
  }

  const stateLabel = skipCoordination ? 'APPROVED' : 'PENDING COORDINATION'
  logActivity(
    'created',
    'ppr_entry',
    entry.id,
    `PPR ${entry.ppr_number}`,
    { details: `PPR ${entry.ppr_number} ${stateLabel} FOR ${input.arrival_date}` },
    input.base_id,
  )
  return entry
}

// ── Status flow ──

/** Fetch coordination rows for a single entry (for the coord modal). */
export async function fetchPprCoordination(entryId: string): Promise<PprCoordination[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('ppr_coordination')
    .select('*')
    .eq('entry_id', entryId)
    .order('agency_name', { ascending: true })
  return (data || []) as PprCoordination[]
}

/** Fetch all coord rows for visible entries — used to drive per-agency badges + filters. */
export async function fetchPprCoordinationForEntries(entryIds: string[]): Promise<PprCoordination[]> {
  const supabase = db()
  if (!supabase || entryIds.length === 0) return []
  const { data } = await supabase
    .from('ppr_coordination')
    .select('*')
    .in('entry_id', entryIds)
  return (data || []) as PprCoordination[]
}

/**
 * Triage step (post-public-submission). Any user holding `ppr:triage` —
 * AFM, NAMO, AMOPS, base_admin, sys_admin by default — picks which
 * agencies must coordinate. Empty `agencyIds` marks the entry approved
 * outright (pre-coordinated path).
 */
export async function triagePprEntry(input: {
  entryId: string
  baseId: string
  agencyIds: string[]
  approver_oi?: string  // only used on the skip-coord path
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const skip = input.agencyIds.length === 0
  const nowIso = new Date().toISOString()

  if (skip) {
    // Same OI rewrite as approvePprEntry: a public submission that
    // arrives here had the placeholder 'XX'; pre-coordinated approval
    // should carry the approver's actual initials.
    const { data: current } = await supabase
      .from('ppr_entries')
      .select('ppr_number')
      .eq('id', input.entryId)
      .single()
    const currentNumber = (current as { ppr_number?: string } | null)?.ppr_number
    const rewritten = (currentNumber && input.approver_oi)
      ? rewritePprOiSegment(currentNumber, input.approver_oi)
      : currentNumber

    const patch: Record<string, unknown> = {
      status: 'approved',
      triaged_by: user.id,
      triaged_at: nowIso,
      approval_user_id: user.id,
      approval_at: nowIso,
      approver_oi: input.approver_oi || null,
      updated_by: user.id,
    }
    if (rewritten && rewritten !== currentNumber) {
      patch.ppr_number = rewritten
    }

    const { error } = await supabase
      .from('ppr_entries')
      .update(patch)
      .eq('id', input.entryId)
    if (error) return { ok: false, error: friendlyError(error.message) }
    logActivity(
      'updated',
      'ppr_entry',
      input.entryId,
      'Triaged (no coordination needed)',
      { details: 'PRE-COORDINATED — APPROVED' },
      input.baseId,
    )
    return { ok: true }
  }

  // Lookup agency names for denormalized insert
  const { data: agencies } = await supabase
    .from('ppr_agencies')
    .select('id, agency_name')
    .in('id', input.agencyIds)

  const rows = ((agencies || []) as { id: string; agency_name: string }[]).map((a) => ({
    entry_id: input.entryId,
    agency_id: a.id,
    agency_name: a.agency_name,
    status: 'pending' as const,
  }))

  if (rows.length === 0) return { ok: false, error: 'No matching agencies' }

  const { error: insErr } = await supabase.from('ppr_coordination').insert(rows)
  if (insErr) return { ok: false, error: friendlyError(insErr.message) }

  const { error: updErr } = await supabase
    .from('ppr_entries')
    .update({
      status: 'pending_coordination',
      triaged_by: user.id,
      triaged_at: nowIso,
      updated_by: user.id,
    })
    .eq('id', input.entryId)
  if (updErr) return { ok: false, error: friendlyError(updErr.message) }

  logActivity(
    'updated',
    'ppr_entry',
    input.entryId,
    'Triaged',
    { details: `Routed to ${rows.length} agency(ies) for coordination` },
    input.baseId,
  )

  // Best-effort coordination-request email to each agency's coordinators.
  // Mirrors the approval-email pattern: failures here don't roll back
  // the status flip, since agency members can still see the entry via
  // the sidebar dot and the /ppr page once they log in.
  try {
    await fetch('/api/send-ppr-coordination-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: input.entryId, agencyIds: input.agencyIds }),
    })
  } catch (e) {
    console.error('triagePprEntry email send failed:', e)
  }

  return { ok: true }
}

/**
 * Agency user acts on their coordination row. If this was the last
 * pending row, the entry transitions to pending_amops_approval.
 */
export async function coordinatePprEntry(input: {
  coordinationId: string
  entryId: string
  baseId: string
  status: 'concur' | 'non_concur'
  comment?: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const nowIso = new Date().toISOString()

  const { error: updErr } = await supabase
    .from('ppr_coordination')
    .update({
      status: input.status,
      comment: input.comment?.trim() || null,
      coordinated_by: user.id,
      coordinated_at: nowIso,
    })
    .eq('id', input.coordinationId)
  if (updErr) return { ok: false, error: friendlyError(updErr.message) }

  // If no remaining pending coord rows for this entry, advance status.
  const { count: pendingCount } = await supabase
    .from('ppr_coordination')
    .select('id', { count: 'exact', head: true })
    .eq('entry_id', input.entryId)
    .eq('status', 'pending')

  if ((pendingCount ?? 0) === 0) {
    const { error: entryErr } = await supabase
      .from('ppr_entries')
      .update({ status: 'pending_amops_approval', updated_by: user.id })
      .eq('id', input.entryId)
      .eq('status', 'pending_coordination') // idempotent guard
    if (entryErr) {
      console.error('coordinatePprEntry status advance failed:', entryErr.message)
    }
  }

  // Mirror the coordination comment into ppr_remarks so the remarks
  // thread is the single human-readable timeline on an entry. The
  // agency name + concur/non-concur is prefixed so context survives
  // even if the coord row is later edited.
  const trimmedComment = input.comment?.trim()
  if (trimmedComment) {
    const { data: coordRow } = await supabase
      .from('ppr_coordination')
      .select('agency_name')
      .eq('id', input.coordinationId)
      .single<{ agency_name: string }>()
    const decision = input.status === 'concur' ? 'CONCUR' : 'NON-CONCUR'
    const agency = coordRow?.agency_name || 'Coordination'
    const remarkText = `[${agency} — ${decision}] ${trimmedComment}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('ppr_remarks').insert({
      entry_id: input.entryId,
      base_id: input.baseId,
      remark: remarkText,
      created_by: user.id,
    })
  }

  logActivity(
    'updated',
    'ppr_entry',
    input.entryId,
    `Coordination — ${input.status === 'concur' ? 'CONCUR' : 'NON-CONCUR'}`,
    { details: input.comment ? `Comment: ${input.comment}` : undefined },
    input.baseId,
  )
  return { ok: true }
}

// ── Remarks ──

/**
 * Free-form comment thread on a PPR entry. Any user with `ppr:view`
 * can read or add a remark; edit/delete is gated on `ppr:write`.
 * Coordination comments are mirrored here automatically by
 * coordinatePprEntry so this is a single timeline.
 */
export async function fetchPprRemarks(entryId: string): Promise<PprRemark[]> {
  const supabase = db()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ppr_remarks')
    .select('*, profiles:created_by(name, rank)')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false })

  if (!error && data) {
    return (data as Record<string, unknown>[]).map((row) => ({
      ...(row as unknown as PprRemark),
      user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      user_rank: (row.profiles as { rank?: string } | null)?.rank || undefined,
    }))
  }

  // Fallback path mirrors discrepancies.fetchStatusUpdates — if the
  // implicit FK join can't resolve (older DBs, dropped FK), return
  // the bare rows so the UI still renders something useful.
  console.warn('PPR remarks profile join failed, falling back:', error?.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bare } = await (supabase as any)
    .from('ppr_remarks')
    .select('*')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false })

  return ((bare || []) as PprRemark[]).map((r) => ({ ...r, user_name: 'Unknown' }))
}

export async function addPprRemark(input: {
  entryId: string
  baseId: string
  remark: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const text = input.remark.trim()
  if (!text) return { ok: false, error: 'Remark cannot be empty' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('ppr_remarks').insert({
    entry_id: input.entryId,
    base_id: input.baseId,
    remark: text,
    created_by: user.id,
  })
  if (error) return { ok: false, error: friendlyError(error.message) }
  return { ok: true }
}

/**
 * Final approval. Any user holding `ppr:approve` (AFM, NAMO, AMOPS,
 * base_admin, sys_admin by default) can call. Triggers the requester
 * approval email via the API route.
 *
 * Public submissions mint their PPR# with an 'XX' OI placeholder
 * because there's no logged-in user at submit time. On approval we
 * rewrite the trailing OI segment to the approver's actual initials
 * so the number reads as 'JJJ-SSS-XX' → 'JJJ-SSS-JD'. Internal
 * pre-coordinated entries already have the creator's OI baked in,
 * so we leave those untouched.
 */
export async function approvePprEntry(input: {
  entryId: string
  baseId: string
  approver_oi?: string
}): Promise<{ ok: boolean; error?: string; entry?: PprEntry }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const nowIso = new Date().toISOString()

  const { data: current } = await supabase
    .from('ppr_entries')
    .select('ppr_number')
    .eq('id', input.entryId)
    .single()
  const currentNumber = (current as { ppr_number?: string } | null)?.ppr_number
  const rewritten = (currentNumber && input.approver_oi)
    ? rewritePprOiSegment(currentNumber, input.approver_oi)
    : currentNumber

  const updatePatch: Record<string, unknown> = {
    status: 'approved',
    approval_user_id: user.id,
    approval_at: nowIso,
    approver_oi: input.approver_oi || null,
    updated_by: user.id,
  }
  if (rewritten && rewritten !== currentNumber) {
    updatePatch.ppr_number = rewritten
  }

  const { data, error } = await supabase
    .from('ppr_entries')
    .update(updatePatch)
    .eq('id', input.entryId)
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Update failed' }

  const entry = data as PprEntry
  logActivity(
    'updated',
    'ppr_entry',
    entry.id,
    `PPR ${entry.ppr_number} APPROVED`,
    { details: 'Final approval' },
    input.baseId,
  )

  // Best-effort approval email; failures don't block the status flip.
  if (entry.requester_email) {
    try {
      const res = await fetch('/api/send-ppr-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: entry.id }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error('[approvePprEntry] approval email API non-2xx', res.status, body)
      }
    } catch (e) {
      console.error('[approvePprEntry] approval email fetch threw:', e)
    }
  }

  return { ok: true, entry }
}

export async function denyPprEntry(input: {
  entryId: string
  baseId: string
  reason: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const reason = input.reason.trim()
  if (!reason) return { ok: false, error: 'Denial reason is required' }

  const { error } = await supabase
    .from('ppr_entries')
    .update({
      status: 'denied',
      denial_reason: reason,
      approval_user_id: user.id,
      approval_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', input.entryId)
  if (error) return { ok: false, error: friendlyError(error.message) }

  logActivity(
    'updated',
    'ppr_entry',
    input.entryId,
    'PPR DENIED',
    { details: `Reason: ${reason}` },
    input.baseId,
  )
  return { ok: true }
}

// ── Pending counts (for KPI badges) ──

export async function fetchPendingTriageCount(baseId: string): Promise<number> {
  const supabase = db()
  if (!supabase) return 0
  const { count } = await supabase
    .from('ppr_entries')
    .select('id', { count: 'exact', head: true })
    .eq('base_id', baseId)
    .eq('status', 'pending_amops_triage')
  return count ?? 0
}

export async function fetchPendingApprovalCount(baseId: string): Promise<number> {
  const supabase = db()
  if (!supabase) return 0
  const { count } = await supabase
    .from('ppr_entries')
    .select('id', { count: 'exact', head: true })
    .eq('base_id', baseId)
    .eq('status', 'pending_amops_approval')
  return count ?? 0
}

/**
 * Per-agency pending counts. Returns a map of agency_id → count of
 * pending coord rows where the parent entry is still in coordination.
 */
export async function fetchPendingCoordinationCounts(
  baseId: string,
): Promise<Record<string, number>> {
  const supabase = db()
  if (!supabase) return {}

  // Two-step: get pending-coordination entry ids for this base, then
  // count pending coord rows per agency among those entries.
  const { data: entries } = await supabase
    .from('ppr_entries')
    .select('id')
    .eq('base_id', baseId)
    .eq('status', 'pending_coordination')

  const ids = ((entries || []) as { id: string }[]).map((e) => e.id)
  if (ids.length === 0) return {}

  const { data: coords } = await supabase
    .from('ppr_coordination')
    .select('agency_id')
    .in('entry_id', ids)
    .eq('status', 'pending')

  const counts: Record<string, number> = {}
  for (const row of (coords || []) as { agency_id: string | null }[]) {
    if (!row.agency_id) continue
    counts[row.agency_id] = (counts[row.agency_id] || 0) + 1
  }
  return counts
}


export async function updatePprEntry(
  id: string,
  updates: Partial<Pick<PprEntry, 'column_values' | 'notes' | 'arrival_date'>>,
  baseId?: string,
): Promise<PprEntry | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('ppr_entries')
    .update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null

  const entry = data as PprEntry
  logActivity('updated', 'ppr_entry', entry.id, `PPR ${entry.ppr_number}`, undefined, baseId)
  return entry
}

export async function deletePprEntry(id: string, pprNumber?: string, baseId?: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('ppr_entries')
    .delete()
    .eq('id', id)

  if (!error && pprNumber) {
    logActivity('deleted', 'ppr_entry', id, `PPR ${pprNumber}`, undefined, baseId)
  }
  return !error
}
