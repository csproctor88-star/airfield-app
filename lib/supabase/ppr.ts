import { createClient } from './client'
import { logActivity } from './activity'
import { formatLocalTime, friendlyError } from '@/lib/utils'

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

/**
 * Identifies admin-configured columns that should surface in the slim
 * summary tables (the `/ppr` Log and the Airfield Status `/` "Today's
 * PPRs" panel). Match is on column_name only so any base whose admin
 * has configured Callsign + Aircraft Type gets the consistent layout
 * regardless of `sort_order`. Anything not matching here lives in the
 * detail dialog / PDF only.
 */
const SUMMARY_COLUMN_NAMES = new Set(['callsign', 'call sign', 'aircraft type'])
export function isSummaryColumn(columnName: string): boolean {
  return SUMMARY_COLUMN_NAMES.has(columnName.trim().toLowerCase())
}

/**
 * Format a raw `column_values[col.id]` string for display in tables,
 * the detail card, the PDF, and outbound emails. For `time` columns
 * the output respects `col.time_display`:
 *   - 'local' + opts.tz set → "HHMM" in base local time
 *   - anything else        → "HHMMZ" (Zulu, the historical default)
 *
 * Backwards-compatible with both raw shapes in `column_values`:
 *   - "15:00" — entries written before the HHMM input swap
 *   - "1500"  — entries written after
 */
export function formatPprColumnValue(
  col: PprColumn,
  raw: string | null | undefined,
  opts?: { tz?: string },
): string {
  if (!raw) return ''
  switch (col.column_type) {
    case 'yes_no_na':
      if (raw === 'yes') return 'YES'
      if (raw === 'no')  return 'NO'
      if (raw === 'na')  return 'N/A'
      return raw
    case 'date':
      try { return new Date(raw + 'T00:00:00').toLocaleDateString() } catch { return raw }
    case 'time': {
      const digits = raw.replace(/\D/g, '').slice(0, 4)
      if (!digits) return raw
      if (col.time_display === 'local' && opts?.tz) {
        const hhmm = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
        return formatLocalTime(hhmm, opts.tz)
      }
      return `${digits}Z`
    }
    default:
      return raw
  }
}

export type PprColumn = {
  id: string
  base_id: string
  column_name: string
  column_type: PprColumnType
  sort_order: number
  is_required: boolean
  /** Independent visibility flags — replaces the legacy `is_public`. */
  show_on_status: boolean
  show_on_form: boolean
  show_on_log: boolean
  /** Display mode for `column_type='time'`. NULL → Zulu (default). */
  time_display: 'zulu' | 'local' | null
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
  | 'canceled'

// Statuses that take a PPR out of the day's operational count. A denied or
// canceled request isn't on the field and shouldn't inflate the "PPRs today"
// number on the airfield status board or the header chip. Everything else —
// approved plus any in-progress stage (triage / coordination / awaiting
// approval) — counts as an active PPR for the day.
export const PPR_INACTIVE_STATUSES: PprStatus[] = ['denied', 'canceled']
export const isActivePpr = (status: PprStatus | string): boolean =>
  !PPR_INACTIVE_STATUSES.includes(status as PprStatus)

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
  requester_phone: string | null
  triaged_by: string | null
  triaged_at: string | null
  approval_user_id: string | null
  approval_at: string | null
  denial_reason: string | null
  cancellation_reason: string | null
  public_submission: boolean
  /**
   * Set when staff mark a transient aircraft as departed. NULL = still
   * on the field. Orthogonal to `status` (a departed PPR is still
   * `approved`); this only governs the Transient Aircraft board.
   */
  departed_at: string | null
  departed_by: string | null
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
// Numbers are minted server-side via the `_ppr_generate_number` RPC,
// which uses an atomic counter table to serialize concurrent submits.
// See migration 2026042803_ppr_number_serialize.sql.

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
  show_on_status?: boolean
  show_on_form?: boolean
  show_on_log?: boolean
  time_display?: 'zulu' | 'local' | null
  info_text?: string | null
}): Promise<PprColumn | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('ppr_columns')
    .insert(input)
    .select()
    .single()

  if (error || !data) {
    if (error) console.error('[ppr] failed to create column:', error.message)
    return null
  }
  return data as PprColumn
}

export async function updatePprColumn(
  id: string,
  updates: Partial<Pick<PprColumn,
    | 'column_name'
    | 'column_type'
    | 'sort_order'
    | 'is_required'
    | 'show_on_status'
    | 'show_on_form'
    | 'show_on_log'
    | 'time_display'
    | 'info_text'
  >>,
): Promise<PprColumn | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('ppr_columns')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    if (error) console.error('[ppr] failed to update column:', error.message)
    return null
  }
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

export async function fetchPprEntryById(id: string): Promise<PprEntry | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('ppr_entries')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as PprEntry
}

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

/**
 * Drives the Transient Aircraft board on the dashboard and the header
 * chip. A PPR is ADDED to the board on its arrival day (arrival_date <=
 * today) and then REMAINS until staff mark it departed (departed_at IS
 * NULL) — it never auto-drops at day rollover. `arrival_date <= today`
 * stays true once the arrival day arrives, so only the Departed mark
 * removes it. Callers still filter `isActivePpr` to drop denied/canceled.
 * `today` is a YYYY-MM-DD string in base-local time.
 */
export async function fetchPprEntriesOnField(baseId: string, today: string): Promise<PprEntry[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('ppr_entries')
    .select('*')
    .eq('base_id', baseId)
    .lte('arrival_date', today)
    .is('departed_at', null)
    .order('arrival_date', { ascending: true })
    .order('created_at', { ascending: true })
  return (data || []) as PprEntry[]
}

/** Mark a transient aircraft as departed — removes it from the board. */
export async function markPprDeparted(entryId: string, baseId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('ppr_entries')
    .update({ departed_at: new Date().toISOString(), departed_by: user.id, updated_by: user.id })
    .eq('id', entryId)
    .select('ppr_number')
    .single()
  if (error) return { ok: false, error: friendlyError(error.message) }

  logActivity(
    'updated',
    'ppr_entry',
    entryId,
    `PPR ${(data as { ppr_number?: string } | null)?.ppr_number ?? ''} DEPARTED`.trim(),
    { details: 'Marked departed — removed from Transient Aircraft board' },
    baseId,
  )
  return { ok: true }
}

/** Undo a departed mark — returns the aircraft to the Transient board. */
export async function clearPprDeparted(entryId: string, baseId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('ppr_entries')
    .update({ departed_at: null, departed_by: null, updated_by: user.id })
    .eq('id', entryId)
  if (error) return { ok: false, error: friendlyError(error.message) }

  logActivity('updated', 'ppr_entry', entryId, 'PPR returned to field', { details: 'Departed mark cleared' }, baseId)
  return { ok: true }
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
  /**
   * AMOPS path: save the PPR at status='pending_amops_approval' so
   * the requester can be coordinated externally (phone / email /
   * face-to-face) and the same AMOPS user can come back later via
   * Decide → Approve to finalize. No agency rows are created.
   * Mutually exclusive with agencyIds — if both are passed,
   * manualCoordPending wins (no in-app coord).
   */
  manualCoordPending?: boolean
}): Promise<PprEntry | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const manualPending = Boolean(input.manualCoordPending)
  const agencyIds = manualPending ? [] : (input.agencyIds ?? [])
  const skipCoordination = !manualPending && agencyIds.length === 0
  const nowIso = new Date().toISOString()

  // Mint the PPR number via the atomic RPC. This serializes concurrent
  // submits on the same (base, arrival_date) — the prior JS-side
  // COUNT-and-format had a race where two simultaneous submissions
  // could both observe the same count and insert duplicate numbers.
  const { data: minted, error: mintErr } = await supabase
    .rpc('_ppr_generate_number', {
      p_base_id: input.base_id,
      p_arrival: input.arrival_date,
      p_oi: input.approver_oi,
    })
  if (mintErr || !minted) {
    console.error('[createPprEntry] mint failed:', mintErr)
    return null
  }
  const pprNumber = minted as string

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
      status: manualPending
        ? 'pending_amops_approval'
        : (skipCoordination ? 'approved' : 'pending_coordination'),
      approval_user_id: skipCoordination ? user.id : null,
      approval_at: skipCoordination ? nowIso : null,
      // For manual-pending the creator IS the triager (they decided
      // to handle coord externally), so log them as such — keeps the
      // audit trail consistent with how routed-to-coord PPRs record
      // the triage actor.
      triaged_by: manualPending ? user.id : (skipCoordination ? null : user.id),
      triaged_at: manualPending ? nowIso : (skipCoordination ? null : nowIso),
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

/**
 * Add additional coordinating agencies to an existing PPR. Allowed when
 * the entry is in `pending_coordination` or `pending_amops_approval` —
 * the second case reverts the status back to `pending_coordination`
 * because a new pending coord row resets the "all agencies responded"
 * gate.
 *
 * Skips agencies already on the entry (no duplicate coord rows). Fires
 * the coord-request email for newly added agencies via the existing
 * /api/send-ppr-coordination-request route — same fire-and-forget
 * pattern as `triagePprEntry`.
 *
 * Requires `ppr:triage` permission upstream (gated by the UI).
 */
export async function addPprCoordinationAgencies(input: {
  entryId: string
  baseId: string
  agencyIds: string[]
}): Promise<{ ok: boolean; error?: string; addedCount: number; statusReverted: boolean }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured', addedCount: 0, statusReverted: false }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated', addedCount: 0, statusReverted: false }

  if (input.agencyIds.length === 0) {
    return { ok: true, addedCount: 0, statusReverted: false }
  }

  const { data: entry } = await supabase
    .from('ppr_entries')
    .select('id, status, ppr_number')
    .eq('id', input.entryId)
    .single<{ id: string; status: PprStatus; ppr_number: string }>()
  if (!entry) {
    return { ok: false, error: 'Entry not found', addedCount: 0, statusReverted: false }
  }

  const allowed: PprStatus[] = ['pending_coordination', 'pending_amops_approval']
  if (!allowed.includes(entry.status)) {
    return {
      ok: false,
      error: `Cannot add coordination to a PPR in status "${entry.status}"`,
      addedCount: 0,
      statusReverted: false,
    }
  }

  // De-dupe against agencies already on this entry — coord rows are
  // never re-issued; a non-concur or concur from a prior round stands.
  const { data: existing } = await supabase
    .from('ppr_coordination')
    .select('agency_id')
    .eq('entry_id', input.entryId)
    .in('agency_id', input.agencyIds)
  const existingIds = new Set(
    ((existing || []) as { agency_id: string | null }[])
      .map((r) => r.agency_id)
      .filter((id): id is string => Boolean(id)),
  )
  const newAgencyIds = input.agencyIds.filter((id) => !existingIds.has(id))

  if (newAgencyIds.length === 0) {
    return { ok: false, error: 'All selected agencies are already on this PPR', addedCount: 0, statusReverted: false }
  }

  const { data: agencies } = await supabase
    .from('ppr_agencies')
    .select('id, agency_name')
    .in('id', newAgencyIds)

  const rows = ((agencies || []) as { id: string; agency_name: string }[]).map((a) => ({
    entry_id: input.entryId,
    agency_id: a.id,
    agency_name: a.agency_name,
    status: 'pending' as const,
  }))

  if (rows.length === 0) {
    return { ok: false, error: 'No matching agencies', addedCount: 0, statusReverted: false }
  }

  const { error: insErr } = await supabase.from('ppr_coordination').insert(rows)
  if (insErr) {
    return { ok: false, error: friendlyError(insErr.message), addedCount: 0, statusReverted: false }
  }

  // Revert to pending_coordination if previously pending_amops_approval —
  // a new pending row means coordination is not actually complete.
  let statusReverted = false
  if (entry.status === 'pending_amops_approval') {
    const { error: updErr } = await supabase
      .from('ppr_entries')
      .update({ status: 'pending_coordination', updated_by: user.id })
      .eq('id', input.entryId)
      .eq('status', 'pending_amops_approval') // idempotent guard
    if (updErr) {
      console.error('addPprCoordinationAgencies status revert failed:', updErr.message)
    } else {
      statusReverted = true
    }
  }

  logActivity(
    'updated',
    'ppr_entry',
    input.entryId,
    statusReverted ? 'Coordination added (status reverted)' : 'Coordination added',
    {
      details: `Added ${rows.length} agency(ies)${statusReverted ? '; status reverted to pending_coordination' : ''}`,
    },
    input.baseId,
  )

  // Fire-and-forget coord-request email for the new agencies only.
  try {
    await fetch('/api/send-ppr-coordination-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: input.entryId, agencyIds: newAgencyIds }),
    })
  } catch (e) {
    console.error('addPprCoordinationAgencies email send failed:', e)
  }

  return { ok: true, addedCount: rows.length, statusReverted }
}

// ── Status flow ──

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

    // Pre-coordinated path lands at status='approved' but used to skip
    // the approval-email send entirely — only approvePprEntry (the
    // post-coord Decide path) was firing the email. Send it here too
    // so the requester gets their PPR number regardless of which
    // approval path AMOPS used.
    try {
      const res = await fetch('/api/send-ppr-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: input.entryId }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error('[triagePprEntry] approval email API non-2xx', res.status, body)
      }
    } catch (e) {
      console.error('[triagePprEntry] approval email fetch threw:', e)
    }

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
    // The coordination row itself saved — a lost mirror only gaps the
    // human-readable remarks timeline, so log it (matches the status-advance
    // handling above) rather than failing the coordination.
    const { error: remarkErr } = await supabase.from('ppr_remarks').insert({
      entry_id: input.entryId,
      base_id: input.baseId,
      remark: remarkText,
      created_by: user.id,
    })
    if (remarkErr) console.error('coordinatePprEntry: remarks mirror failed:', remarkErr.message)
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

  const { data, error } = await supabase
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
  const { data: bare } = await supabase
    .from('ppr_remarks')
    .select('*')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false })

  return ((bare || []) as PprRemark[]).map((r) => ({ ...r, user_name: 'Unknown' }))
}

// Batch variant: one query for many entries (avoids N+1 on PPR export). Returns
// a Record keyed by entry_id (entries with no remarks are simply absent).
export async function fetchPprRemarksForEntries(entryIds: string[]): Promise<Record<string, PprRemark[]>> {
  const out: Record<string, PprRemark[]> = {}
  const supabase = db()
  if (!supabase || entryIds.length === 0) return out

  const push = (r: PprRemark) => {
    const eid = (r as unknown as { entry_id?: string }).entry_id
    if (!eid) return
    if (!out[eid]) out[eid] = []
    out[eid].push(r)
  }

  const { data, error } = await supabase
    .from('ppr_remarks')
    .select('*, profiles:created_by(name, rank)')
    .in('entry_id', entryIds)
    .order('created_at', { ascending: false })

  if (!error && data) {
    ;(data as Record<string, unknown>[]).forEach((row) => push({
      ...(row as unknown as PprRemark),
      user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      user_rank: (row.profiles as { rank?: string } | null)?.rank || undefined,
    }))
    return out
  }

  // Fallback mirrors fetchPprRemarks — bare rows if the implicit FK join fails.
  console.warn('PPR remarks batch profile join failed, falling back:', error?.message)
  const { data: bare } = await supabase
    .from('ppr_remarks')
    .select('*')
    .in('entry_id', entryIds)
    .order('created_at', { ascending: false })
  ;((bare || []) as PprRemark[]).forEach((r) => push({ ...r, user_name: 'Unknown' }))
  return out
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

  const { error } = await supabase.from('ppr_remarks').insert({
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

/**
 * Soft-cancel a PPR. Keeps the row, flips status to 'canceled',
 * stores the reason, and stamps the canceller via updated_by /
 * updated_at. Unlike denial this does not gate on
 * approval_user_id — anyone with ppr:write can cancel any non-
 * terminal entry. Already-denied or already-canceled entries are
 * treated as no-ops at the UI layer; this function will still
 * write the new reason if called.
 */
export async function cancelPprEntry(input: {
  entryId: string
  baseId: string
  reason: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const reason = input.reason.trim()
  if (!reason) return { ok: false, error: 'Cancellation reason is required' }

  const { data, error } = await supabase
    .from('ppr_entries')
    .update({
      status: 'canceled',
      cancellation_reason: reason,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.entryId)
    .select('id, requester_email')
    .single()
  if (error) return { ok: false, error: friendlyError(error.message) }

  logActivity(
    'updated',
    'ppr_entry',
    input.entryId,
    'PPR CANCELED',
    { details: `Reason: ${reason}` },
    input.baseId,
  )

  // Best-effort cancellation email; mirrors approvePprEntry / denyPprEntry.
  // Fire-and-forget — email failures don't block the status flip, and an
  // internally-created PPR with no requester_email skips silently.
  const requesterEmail = (data as { requester_email: string | null } | null)?.requester_email
  if (requesterEmail) {
    try {
      const res = await fetch('/api/send-ppr-cancellation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: input.entryId }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error('[cancelPprEntry] cancellation email API non-2xx', res.status, body)
      }
    } catch (e) {
      console.error('[cancelPprEntry] cancellation email fetch threw:', e)
    }
  }

  return { ok: true }
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

  const { data, error } = await supabase
    .from('ppr_entries')
    .update({
      status: 'denied',
      denial_reason: reason,
      approval_user_id: user.id,
      approval_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', input.entryId)
    .select('id, requester_email')
    .single()
  if (error) return { ok: false, error: friendlyError(error.message) }

  logActivity(
    'updated',
    'ppr_entry',
    input.entryId,
    'PPR DENIED',
    { details: `Reason: ${reason}` },
    input.baseId,
  )

  // Best-effort denial email; failures don't block the status flip.
  // Mirrors approvePprEntry's pattern — covers both deny call sites
  // (triage-Deny radio and post-coord Decide-Deny).
  const requesterEmail = (data as { requester_email: string | null } | null)?.requester_email
  if (requesterEmail) {
    try {
      const res = await fetch('/api/send-ppr-denial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: input.entryId }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error('[denyPprEntry] denial email API non-2xx', res.status, body)
      }
    } catch (e) {
      console.error('[denyPprEntry] denial email fetch threw:', e)
    }
  }

  return { ok: true }
}

/**
 * Re-open a DENIED PPR for coordination. A denial isn't always final —
 * circumstances change and AMOPS may reconsider. This flips a denied
 * entry back to pending_coordination and (re)issues coordination rows
 * for the chosen agencies.
 *
 * Handles both denial origins: denied-at-triage (no coordination rows
 * ever existed → all selected agencies are inserted fresh) and
 * denied-after-coordination (rows exist → the selected agencies are
 * reset to pending; agencies not re-selected keep their standing
 * decision as history).
 *
 * The prior denial reason + prior coordination outcomes are snapshotted
 * into the remarks thread first, so the audit trail survives the reset.
 * No requester email — agencies get the standard coordination-request
 * notice; the requester only hears back on the eventual decision.
 *
 * Gated on `ppr:approve` at the UI; RLS still enforces ppr:write
 * (entry update) + ppr:coordinate (row reset) + ppr:triage/write
 * (row insert), all held by the approval-authority roles.
 */
export async function reopenPprEntry(input: {
  entryId: string
  baseId: string
  agencyIds: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  if (input.agencyIds.length === 0) {
    return { ok: false, error: 'Select at least one agency to coordinate with' }
  }

  const { data: entry } = await supabase
    .from('ppr_entries')
    .select('id, status, ppr_number, denial_reason')
    .eq('id', input.entryId)
    .single<{ id: string; status: PprStatus; ppr_number: string; denial_reason: string | null }>()
  if (!entry) return { ok: false, error: 'Entry not found' }
  if (entry.status !== 'denied') {
    return { ok: false, error: `Only a denied PPR can be re-opened (status is "${entry.status}")` }
  }

  const nowIso = new Date().toISOString()

  // Snapshot prior coordination outcomes into the remarks thread BEFORE
  // resetting the rows, so a concur/non-concur from the prior round
  // isn't silently lost when its row flips back to pending.
  const { data: priorCoords } = await supabase
    .from('ppr_coordination')
    .select('agency_id, agency_name, status')
    .eq('entry_id', input.entryId)
  const priorList = (priorCoords || []) as { agency_id: string | null; agency_name: string; status: string }[]
  const priorSummary = priorList.length > 0
    ? priorList.map((c) => `${c.agency_name}: ${c.status === 'concur' ? 'CONCUR' : c.status === 'non_concur' ? 'NON-CONCUR' : 'pending'}`).join(', ')
    : 'none'
  const { error: snapshotErr } = await supabase.from('ppr_remarks').insert({
    entry_id: input.entryId,
    base_id: input.baseId,
    remark: `[Re-opened from Denied] Prior denial reason: ${entry.denial_reason || '(none)'}. Prior coordination: ${priorSummary}.`,
    created_by: user.id,
  })
  if (snapshotErr) {
    // The whole point of the snapshot is to preserve the prior outcomes the
    // reset below destroys. If it didn't save, abort BEFORE anything is reset.
    console.error('reopenPprEntry: snapshot remark failed:', snapshotErr.message)
    return { ok: false, error: friendlyError(snapshotErr.message) }
  }

  // Split selected agencies into those already on the entry (reset to
  // pending) and brand-new ones (insert).
  const existingIds = new Set(
    priorList.map((c) => c.agency_id).filter((id): id is string => Boolean(id)),
  )
  const toReset = input.agencyIds.filter((id) => existingIds.has(id))
  const toInsert = input.agencyIds.filter((id) => !existingIds.has(id))

  if (toReset.length > 0) {
    const { error: resetErr } = await supabase
      .from('ppr_coordination')
      .update({ status: 'pending', comment: null, coordinated_by: null, coordinated_at: null })
      .eq('entry_id', input.entryId)
      .in('agency_id', toReset)
    if (resetErr) return { ok: false, error: friendlyError(resetErr.message) }
  }

  if (toInsert.length > 0) {
    const { data: agencies } = await supabase
      .from('ppr_agencies')
      .select('id, agency_name')
      .in('id', toInsert)
    const rows = ((agencies || []) as { id: string; agency_name: string }[]).map((a) => ({
      entry_id: input.entryId,
      agency_id: a.id,
      agency_name: a.agency_name,
      status: 'pending' as const,
    }))
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('ppr_coordination').insert(rows)
      if (insErr) return { ok: false, error: friendlyError(insErr.message) }
    }
  }

  // Flip the entry back into coordination. Clear the denial fields — the
  // PPR is no longer denied; the prior reason now lives in the remark
  // above. Re-stamp triaged_by/at to reflect this re-routing.
  const { error: updErr } = await supabase
    .from('ppr_entries')
    .update({
      status: 'pending_coordination',
      denial_reason: null,
      approval_user_id: null,
      approval_at: null,
      triaged_by: user.id,
      triaged_at: nowIso,
      updated_by: user.id,
    })
    .eq('id', input.entryId)
    .eq('status', 'denied') // idempotent guard against a double-submit
  if (updErr) return { ok: false, error: friendlyError(updErr.message) }

  logActivity(
    'updated',
    'ppr_entry',
    input.entryId,
    `PPR ${entry.ppr_number} RE-OPENED`,
    { details: `Re-opened from Denied; routed to ${input.agencyIds.length} agency(ies) for coordination` },
    input.baseId,
  )

  // Best-effort coordination-request email to the chosen agencies'
  // coordinators — same pattern as triagePprEntry.
  try {
    await fetch('/api/send-ppr-coordination-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: input.entryId, agencyIds: input.agencyIds }),
    })
  } catch (e) {
    console.error('reopenPprEntry email send failed:', e)
  }

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
  updates: Partial<Pick<PprEntry, 'column_values' | 'notes' | 'arrival_date' | 'approver_oi'>>,
  baseId?: string,
): Promise<PprEntry | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  // approver_oi changes on an already-approved entry must rewrite the
  // OI segment of the ppr_number so the displayed identifier matches
  // the new approver. Mirrors approvePprEntry's behavior. Only fetch
  // the current row when the caller is touching approver_oi.
  const patch: Record<string, unknown> = {
    ...updates,
    updated_by: user?.id,
    updated_at: new Date().toISOString(),
  }
  if (updates.approver_oi !== undefined) {
    const { data: current } = await supabase
      .from('ppr_entries')
      .select('ppr_number, approver_oi')
      .eq('id', id)
      .single<{ ppr_number: string; approver_oi: string | null }>()
    if (current && updates.approver_oi && updates.approver_oi !== current.approver_oi) {
      const rewritten = rewritePprOiSegment(current.ppr_number, updates.approver_oi)
      if (rewritten && rewritten !== current.ppr_number) {
        patch.ppr_number = rewritten
      }
    }
  }

  const { data, error } = await supabase
    .from('ppr_entries')
    .update(patch)
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
