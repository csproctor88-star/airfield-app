import { createClient } from './client'
import { resolveBaseId } from './resolve-base-id'

export interface RunwayStatusEntry {
  status: 'open' | 'suspended' | 'closed'
  active_end: string
  remarks?: string | null
  // DAFMAN 13-204v1 Para 6.2.2: estimated time runway returns to service (ISO Zulu).
  // Only meaningful when status ≠ 'open'.
  estimated_resume_at?: string | null
}

export type RunwayStatuses = Record<string, RunwayStatusEntry>

export interface AdvisoryItem {
  id: string
  type: 'WATCH' | 'WARNING' | 'ADVISORY'
  text: string
  number?: string | null
  created_at: string
  effective_start?: string | null
  effective_end?: string | null
}

export interface AirfieldStatus {
  id: string
  base_id: string | null
  advisory_type: 'WATCH' | 'WARNING' | 'ADVISORY' | null
  advisory_text: string | null
  advisories: AdvisoryItem[]
  active_runway: string
  runway_status: 'open' | 'suspended' | 'closed'
  runway_statuses: RunwayStatuses
  arff_cat: number | null
  arff_statuses: Record<string, string>
  rsc_condition: string | null
  rsc_updated_at: string | null
  rcr_touchdown: string | null
  rcr_midpoint: string | null
  rcr_rollout: string | null
  rcr_condition: string | null
  rcr_updated_at: string | null
  bwc_value: string | null
  bwc_updated_at: string | null
  construction_remarks: string | null
  misc_remarks: string | null
  afm_out_of_office: boolean
  afm_ooo_message: string | null
  afm_closed: boolean
  afm_closed_message: string | null
  updated_by: string | null
  updated_at: string
}

export interface RunwayStatusLogRow {
  id: string
  old_runway_status: string | null
  new_runway_status: string | null
  old_active_runway: string | null
  new_active_runway: string | null
  old_advisory_type: string | null
  new_advisory_type: string | null
  old_advisory_text: string | null
  new_advisory_text: string | null
  changed_by: string | null
  reason: string | null
  created_at: string
  // Joined from profiles
  user_name?: string
  user_rank?: string
}

export async function fetchAirfieldStatus(baseId?: string | null): Promise<AirfieldStatus | null> {
  const supabase = createClient()
  if (!supabase) return null

  let query = supabase
    .from('airfield_status')
    .select('*')

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query.limit(1).single()

  if (error) {
    console.error('Failed to fetch airfield status:', error.message)
    return null
  }

  return data as unknown as AirfieldStatus
}

export async function updateAirfieldStatus(
  updates: Partial<Pick<AirfieldStatus, 'advisory_type' | 'advisory_text' | 'advisories' | 'active_runway' | 'runway_status' | 'runway_statuses' | 'arff_cat' | 'arff_statuses' | 'rsc_condition' | 'rsc_updated_at' | 'rcr_touchdown' | 'rcr_midpoint' | 'rcr_rollout' | 'rcr_condition' | 'rcr_updated_at' | 'bwc_value' | 'bwc_updated_at' | 'construction_remarks' | 'misc_remarks' | 'afm_out_of_office' | 'afm_ooo_message' | 'afm_closed' | 'afm_closed_message'>>,
  baseId?: string | null,
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { data: { user } } = await supabase.auth.getUser()

  // Get the current row ID scoped to base
  let existingQuery = supabase
    .from('airfield_status')
    .select('id')

  if (baseId) {
    existingQuery = existingQuery.eq('base_id', baseId)
  }

  const { data: existing } = await existingQuery.limit(1).single()

  if (!existing) return false

  const { error } = await supabase
    .from('airfield_status')
    .update({
      ...(updates as Record<string, unknown>),
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  if (error) {
    console.error('Failed to update airfield status:', error.message)
    return false
  }

  return true
}

export interface ArffStatusLogRow {
  id: string
  base_id: string | null
  old_cat: number | null
  new_cat: number | null
  aircraft_name: string | null
  old_readiness: string | null
  new_readiness: string | null
  changed_by: string | null
  reason: string | null
  created_at: string
  // Joined
  user_name?: string
  user_rank?: string
}

/** Log a change to arff_status_log — either a CAT change or an aircraft-readiness change. */
export async function logArffStatusChange(
  params: {
    oldCat?: number | null
    newCat?: number | null
    aircraftName?: string | null
    oldReadiness?: string | null
    newReadiness?: string | null
    reason?: string | null
  },
  baseId?: string | null,
): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('arff_status_log').insert({
    base_id: await resolveBaseId(supabase, baseId, user?.id),
    old_cat: params.oldCat ?? null,
    new_cat: params.newCat ?? null,
    aircraft_name: params.aircraftName ?? null,
    old_readiness: params.oldReadiness ?? null,
    new_readiness: params.newReadiness ?? null,
    changed_by: user?.id ?? null,
    reason: params.reason ?? null,
  })
}

/** Fetch ARFF status changes within a date range for the daily ops report. */
export async function fetchArffStatusLog(
  startUTC: string,
  endUTC: string,
  baseId?: string | null,
): Promise<ArffStatusLogRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  let query = supabase
    .from('arff_status_log')
    .select('*, profiles:changed_by(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })
  if (baseId) query = query.eq('base_id', baseId)
  const { data, error } = await query
  if (error) {
    console.error('fetchArffStatusLog:', error.message)
    return []
  }
  return (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    user_name: (r.profiles as { name?: string } | null)?.name || 'Unknown',
    user_rank: (r.profiles as { rank?: string } | null)?.rank,
  })) as ArffStatusLogRow[]
}

/** Log a change to runway_status_log for the daily operations report */
export async function logRunwayStatusChange(
  params: {
    oldRunwayStatus?: string | null
    newRunwayStatus?: string | null
    oldActiveRunway?: string | null
    newActiveRunway?: string | null
    oldAdvisoryType?: string | null
    newAdvisoryType?: string | null
    oldAdvisoryText?: string | null
    newAdvisoryText?: string | null
  },
  baseId?: string | null
): Promise<void> {
  const supabase = createClient()
  if (!supabase) return

  const { data: { user } } = await supabase.auth.getUser()

  // Never write an orphan (NULL base_id) audit row — those are hidden from every
  // base by RLS (migration 2026062011) and rejected once the helper's NULL escape
  // hatch is removed. Fall back to the actor's primary base when none was supplied.
  await supabase.from('runway_status_log').insert({
    base_id: await resolveBaseId(supabase, baseId, user?.id),
    old_runway_status: params.oldRunwayStatus ?? null,
    new_runway_status: params.newRunwayStatus ?? null,
    old_active_runway: params.oldActiveRunway ?? null,
    new_active_runway: params.newActiveRunway ?? null,
    old_advisory_type: params.oldAdvisoryType ?? null,
    new_advisory_type: params.newAdvisoryType ?? null,
    old_advisory_text: params.oldAdvisoryText ?? null,
    new_advisory_text: params.newAdvisoryText ?? null,
    changed_by: user?.id ?? null,
    reason: null,
  })
}

/** Fetch runway status changes within a date range */
export async function fetchRunwayStatusLog(
  startUTC: string,
  endUTC: string,
  baseId?: string | null
): Promise<RunwayStatusLogRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // Try with profile join
  let query = supabase
    .from('runway_status_log')
    .select('*, profiles:changed_by(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      user_rank: (row.profiles as { rank?: string } | null)?.rank || undefined,
    })) as RunwayStatusLogRow[]
  }

  // Fallback without join
  let fallbackQuery = supabase
    .from('runway_status_log')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) {
    fallbackQuery = fallbackQuery.eq('base_id', baseId)
  }

  const { data: fallback, error: fbError } = await fallbackQuery

  if (fbError) {
    console.error('Failed to fetch runway status log:', fbError.message)
    return []
  }

  return (fallback ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    user_name: 'Unknown',
  })) as RunwayStatusLogRow[]
}

// ── Safety-role narrow writer ──
// Safety users don't have full `airfield_status:write`. They route
// their RSC / RCR / BWC edits through the safety_update_rsc_bwc
// SECURITY DEFINER RPC, which enforces the narrow permission and
// writes the matching runway_status_log audit row.
export async function safetyUpdateRscBwc(
  baseId: string,
  input: {
    rsc_condition?: string | null
    rcr_touchdown?: string | null
    rcr_midpoint?: string | null
    rcr_rollout?: string | null
    rcr_condition?: string | null
    bwc_value?: string | null
    reason?: string | null
  },
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  }).rpc('safety_update_rsc_bwc', {
    p_base_id: baseId,
    p_rsc_condition: input.rsc_condition ?? null,
    p_rcr_touchdown: input.rcr_touchdown ?? null,
    p_rcr_midpoint:  input.rcr_midpoint  ?? null,
    p_rcr_rollout:   input.rcr_rollout   ?? null,
    p_rcr_condition: input.rcr_condition ?? null,
    p_bwc_value:     input.bwc_value     ?? null,
    p_reason:        input.reason        ?? null,
  })

  if (error) {
    console.error('safety_update_rsc_bwc failed:', error.message)
    return { error: error.message }
  }
  return { error: null }
}
