import { createClient } from './client'

export interface AirfieldStatus {
  id: string
  base_id: string | null
  advisory_type: 'INFO' | 'CAUTION' | 'WARNING' | null
  advisory_text: string | null
  active_runway: string
  runway_status: 'open' | 'suspended' | 'closed'
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
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
  updates: Partial<Pick<AirfieldStatus, 'advisory_type' | 'advisory_text' | 'active_runway' | 'runway_status'>>,
  baseId?: string | null,
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { data: { user } } = await supabase.auth.getUser()

  // Get the current row ID scoped to base
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingQuery = (supabase as any)
    .from('airfield_status')
    .select('id')

  if (baseId) {
    existingQuery = existingQuery.eq('base_id', baseId)
  }

  const { data: existing } = await existingQuery.limit(1).single()

  if (!existing) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
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

/** Fetch runway status changes within a date range */
export async function fetchRunwayStatusLog(
  startUTC: string,
  endUTC: string,
  baseId?: string | null
): Promise<RunwayStatusLogRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // Try with profile join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fallbackQuery = (supabase as any)
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
