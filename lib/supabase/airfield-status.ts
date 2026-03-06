import { createClient } from './client'

export interface RunwayStatusEntry {
  status: 'open' | 'suspended' | 'closed'
  active_end: string
}

export type RunwayStatuses = Record<string, RunwayStatusEntry>

export interface AirfieldStatus {
  id: string
  base_id: string | null
  advisory_type: 'INFO' | 'CAUTION' | 'WARNING' | null
  advisory_text: string | null
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

  return data as AirfieldStatus
}

export async function updateAirfieldStatus(
  updates: Partial<Pick<AirfieldStatus, 'advisory_type' | 'advisory_text' | 'active_runway' | 'runway_status' | 'runway_statuses' | 'arff_cat' | 'arff_statuses' | 'rsc_condition' | 'rsc_updated_at' | 'rcr_touchdown' | 'rcr_midpoint' | 'rcr_rollout' | 'rcr_condition' | 'rcr_updated_at' | 'bwc_value' | 'bwc_updated_at'>>,
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
      ...updates,
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

  await supabase.from('runway_status_log').insert({
    base_id: baseId ?? null,
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
  } as any)
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
