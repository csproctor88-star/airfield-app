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
 *   "Monthly SCN check complete — all agencies loud & clear"
 */
export function summarizeCheck(check: ScnCheckWithResults): string {
  const label = check.check_type === 'backup' ? 'Monthly SCN check complete' : 'Daily SCN check complete'
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
    // Clear existing results so we can rewrite
    await supabase.from('scn_check_results').delete().eq('check_id', checkId)
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
