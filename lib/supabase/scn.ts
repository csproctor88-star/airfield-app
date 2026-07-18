import { createClient } from './client'
import { friendlyError } from '@/lib/utils'
import { logActivity } from './activity'
import type { Database } from './types'

type ScnCheckInsert = Database['public']['Tables']['scn_checks']['Insert']

function db() {
  return createClient()
}

export type ScnCheckType = 'primary' | 'backup'
export type ScnAgencyStatus = 'loud_clear' | 'no_response' | 'oos'

export const SCN_STATUS_LABELS: Record<ScnAgencyStatus, string> = {
  loud_clear: 'Loud & Clear',
  no_response: 'No Response',
  oos: 'Out of Service',
}

export const SCN_STATUS_COLORS: Record<ScnAgencyStatus, string> = {
  loud_clear: 'var(--color-success)',
  no_response: 'var(--color-warning)',
  oos: 'var(--color-danger)',
}

export type ScnCheckRow = {
  id: string
  base_id: string
  check_date: string
  check_type: ScnCheckType
  started_at: string
  completed_at: string | null
  completed_by: string | null
  completed_by_oi: string | null
  notes: string | null
  created_at: string
}

export type ScnCheckResultRow = {
  id: string
  check_id: string
  agency_id: string | null
  agency_name: string
  status: ScnAgencyStatus
  notes: string | null
  sort_order: number
  created_at: string
}

export type ScnCheckWithResults = ScnCheckRow & { results: ScnCheckResultRow[] }

export type ScnAgencyResultInput = {
  agency_id: string | null
  agency_name: string
  status: ScnAgencyStatus
  notes?: string | null
  sort_order: number
}

export type ScnAgencyDraft = {
  agency_id: string | null
  agency_name: string
  sort_order: number
  status: ScnAgencyStatus
  notes: string
}

/**
 * Build the check modal's per-agency draft rows from the base's active
 * agency list plus (in EDIT mode) the check's saved results.
 *
 * Prior results are matched by agency_id first (survives renames), then
 * by agency_name (covers rows whose agency_id was nulled by an agency
 * delete).
 *
 * Snapshot preservation (EDIT mode): a saved check is a point-in-time
 * record. If the agency roster changed since it was logged — an agency
 * was deactivated or hard-deleted — that agency's prior result row no
 * longer maps to any active agency. Because the save path delete-and-
 * rewrites all child rows from this draft, such rows would be silently
 * dropped. To keep the snapshot intact, any prior result NOT consumed by
 * an active agency is appended after the active rows, carrying its own
 * name / status / notes / sort_order. (New checks pass no `existing`, so
 * there are no orphans to append.)
 */
export function buildScnAgencyDrafts(
  agencies: { id: string; agency_name: string; sort_order: number }[],
  existing?: ScnCheckResultRow[] | null,
): ScnAgencyDraft[] {
  const existingRows = existing ?? []
  const byAgencyId = new Map<string, ScnCheckResultRow>()
  const byName = new Map<string, ScnCheckResultRow>()
  for (const r of existingRows) {
    if (r.agency_id) byAgencyId.set(r.agency_id, r)
    if (!byName.has(r.agency_name)) byName.set(r.agency_name, r)
  }

  const consumed = new Set<ScnCheckResultRow>()
  const activeDrafts: ScnAgencyDraft[] = agencies.map((a, i) => {
    const prior = byAgencyId.get(a.id) ?? byName.get(a.agency_name)
    if (prior) consumed.add(prior)
    return {
      agency_id: a.id,
      agency_name: a.agency_name,
      sort_order: a.sort_order || i,
      status: prior?.status ?? 'loud_clear',
      notes: prior?.notes ?? '',
    }
  })

  // Prior result rows with no matching active agency (agency deactivated
  // or deleted since the check was logged) — preserve them so the delete-
  // and-rewrite save can't drop them from the historical record.
  const orphanDrafts: ScnAgencyDraft[] = existingRows
    .filter(r => !consumed.has(r))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(r => ({
      agency_id: r.agency_id,
      agency_name: r.agency_name,
      sort_order: r.sort_order,
      status: r.status,
      notes: r.notes ?? '',
    }))

  return [...activeDrafts, ...orphanDrafts]
}

/**
 * Build the `saveCheck` input from the modal's live draft. Pure —
 * extracted so the page's save path is unit-testable and so the check's
 * date is threaded through explicitly. `checkDate` comes from the caller
 * (a NEW check passes today's Zulu date; EDITING a check passes that
 * check's own `check_date`) rather than being hardcoded to "today" —
 * editing a historical check must upsert onto that check's
 * (base, check_date, check_type) natural key, not today's.
 */
export function buildScnSavePayload(args: {
  baseId: string
  checkDate: string
  checkType: ScnCheckType
  operatingInitials: string | null
  notes: string
  draft: ScnAgencyDraft[]
}): {
  baseId: string
  checkDate: string
  checkType: ScnCheckType
  operatingInitials: string | null
  notes: string | null
  agencies: ScnAgencyResultInput[]
} {
  return {
    baseId: args.baseId,
    checkDate: args.checkDate,
    checkType: args.checkType,
    operatingInitials: args.operatingInitials,
    notes: args.notes.trim() || null,
    agencies: args.draft.map(d => ({
      agency_id: d.agency_id,
      agency_name: d.agency_name,
      status: d.status,
      notes: d.notes.trim() || null,
      sort_order: d.sort_order,
    })),
  }
}

/**
 * Sort checks for the history list: newest date first, then daily
 * (primary) before monthly back-up within a date. `fetchChecksInRange`
 * returns them check_date ASC / check_type alphabetically ('backup' <
 * 'primary'), but the history UI reads newest-first — so re-sort
 * page-side. Pure; does not mutate its input.
 */
const SCN_TYPE_ORDER: ScnCheckType[] = ['primary', 'backup']
export function sortScnHistory(checks: ScnCheckWithResults[]): ScnCheckWithResults[] {
  return [...checks].sort((a, b) => {
    if (a.check_date !== b.check_date) return b.check_date.localeCompare(a.check_date)
    return SCN_TYPE_ORDER.indexOf(a.check_type) - SCN_TYPE_ORDER.indexOf(b.check_type)
  })
}

/** Zulu YYYY-MM-DD for today. Checks are tracked by Zulu date to match the rest of the app. */
export function todayZuluDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function fetchTodayChecks(baseId: string, dateZulu: string = todayZuluDate()): Promise<ScnCheckWithResults[]> {
  const supabase = db()
  if (!supabase) return []

  const { data: checks, error } = await supabase
    .from('scn_checks')
    .select('*')
    .eq('base_id', baseId)
    .eq('check_date', dateZulu)
    .order('check_type', { ascending: true })

  if (error || !checks || checks.length === 0) return []

  const ids = (checks as ScnCheckRow[]).map(c => c.id)
  const { data: results } = await supabase
    .from('scn_check_results')
    .select('*')
    .in('check_id', ids)
    .order('sort_order', { ascending: true })

  const byCheck = new Map<string, ScnCheckResultRow[]>()
  for (const r of (results || []) as ScnCheckResultRow[]) {
    const arr = byCheck.get(r.check_id) ?? []
    arr.push(r)
    byCheck.set(r.check_id, arr)
  }
  return (checks as ScnCheckRow[]).map(c => ({ ...c, results: byCheck.get(c.id) ?? [] }))
}

export async function fetchCheckById(id: string): Promise<ScnCheckWithResults | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: check, error } = await supabase
    .from('scn_checks')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !check) return null

  const { data: results } = await supabase
    .from('scn_check_results')
    .select('*')
    .eq('check_id', id)
    .order('sort_order', { ascending: true })

  return { ...(check as ScnCheckRow), results: (results || []) as ScnCheckResultRow[] }
}

export async function fetchChecksInRange(baseId: string, startDate: string, endDate: string): Promise<ScnCheckWithResults[]> {
  const supabase = db()
  if (!supabase) return []

  const { data: checks } = await supabase
    .from('scn_checks')
    .select('*')
    .eq('base_id', baseId)
    .gte('check_date', startDate)
    .lte('check_date', endDate)
    .order('check_date', { ascending: true })
    .order('check_type', { ascending: true })

  if (!checks || checks.length === 0) return []

  const ids = (checks as ScnCheckRow[]).map(c => c.id)
  const { data: results } = await supabase
    .from('scn_check_results')
    .select('*')
    .in('check_id', ids)
    .order('sort_order', { ascending: true })

  const byCheck = new Map<string, ScnCheckResultRow[]>()
  for (const r of (results || []) as ScnCheckResultRow[]) {
    const arr = byCheck.get(r.check_id) ?? []
    arr.push(r)
    byCheck.set(r.check_id, arr)
  }
  return (checks as ScnCheckRow[]).map(c => ({ ...c, results: byCheck.get(c.id) ?? [] }))
}

/** Summarize a check for the Events Log. Returns e.g.
 *   "Daily SCN check complete — all agencies loud & clear"
 *   "Daily SCN check complete — all loud & clear except Fire Dept (No Response), ATC (Out of Service: radio fault)"
 *   "Monthly Back-up SCN check complete — all agencies loud & clear"
 */
export function summarizeCheck(check: ScnCheckWithResults): string {
  const label = check.check_type === 'backup' ? 'Monthly Back-up SCN check complete' : 'Daily SCN check complete'
  const exceptions = check.results.filter(r => r.status !== 'loud_clear')
  if (exceptions.length === 0) {
    return `${label} — all agencies loud & clear`
  }
  const parts = exceptions.map(r => {
    const base = `${r.agency_name} (${SCN_STATUS_LABELS[r.status]}`
    const note = r.notes ? `: ${r.notes}` : ''
    return `${base}${note})`
  })
  return `${label} — all loud & clear except ${parts.join(', ')}`
}

export async function saveCheck(input: {
  baseId: string
  checkDate: string
  checkType: ScnCheckType
  operatingInitials?: string | null
  notes?: string | null
  agencies: ScnAgencyResultInput[]
}): Promise<{ data: ScnCheckWithResults | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let userId: string | null = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* unauthenticated — skip attribution */ }

  // Upsert the check row by (base_id, check_date, check_type)
  const { data: existing } = await supabase
    .from('scn_checks')
    .select('id')
    .eq('base_id', input.baseId)
    .eq('check_date', input.checkDate)
    .eq('check_type', input.checkType)
    .maybeSingle()

  const completedAt = new Date().toISOString()
  const checkPayload: ScnCheckInsert = {
    base_id: input.baseId,
    check_date: input.checkDate,
    check_type: input.checkType,
    completed_at: completedAt,
    completed_by: userId,
    completed_by_oi: input.operatingInitials || null,
    notes: input.notes || null,
  }

  let checkId: string
  if (existing?.id) {
    checkId = existing.id
    const { error } = await supabase.from('scn_checks').update(checkPayload).eq('id', checkId)
    if (error) return { data: null, error: friendlyError(error.message) }
    // Clear existing results so we can rewrite — a silent delete failure
    // followed by the reinsert below would duplicate result rows.
    const { error: clearError } = await supabase.from('scn_check_results').delete().eq('check_id', checkId)
    if (clearError) return { data: null, error: friendlyError(clearError.message) }
  } else {
    const { data: inserted, error } = await supabase
      .from('scn_checks')
      .insert(checkPayload)
      .select('id')
      .single()
    if (error || !inserted) return { data: null, error: friendlyError(error?.message || 'Failed to save check') }
    checkId = (inserted as { id: string }).id
  }

  // Insert results
  if (input.agencies.length > 0) {
    const resultRows = input.agencies.map(a => ({
      check_id: checkId,
      agency_id: a.agency_id,
      agency_name: a.agency_name,
      status: a.status,
      notes: a.notes || null,
      sort_order: a.sort_order,
    }))
    const { error: rErr } = await supabase.from('scn_check_results').insert(resultRows)
    if (rErr) return { data: null, error: friendlyError(rErr.message) }
  }

  const full = await fetchCheckById(checkId)
  if (!full) return { data: null, error: 'Saved but could not re-fetch check' }

  // Write an Events Log entry summarizing the result
  try {
    const summary = summarizeCheck(full)
    await logActivity(
      'completed',
      input.checkType === 'backup' ? 'scn_backup' : 'scn',
      full.id,
      undefined,
      { details: summary.toUpperCase() },
      input.baseId,
    )
  } catch (e) {
    console.error('SCN summary activity insert failed:', e)
  }

  return { data: full, error: null }
}

export async function deleteCheck(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('scn_checks').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
