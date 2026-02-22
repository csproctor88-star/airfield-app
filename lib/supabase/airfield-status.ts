import { createClient } from './client'

export interface AirfieldStatus {
  id: string
  advisory_type: 'INFO' | 'CAUTION' | 'WARNING' | null
  advisory_text: string | null
  active_runway: '01' | '19'
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

export async function fetchAirfieldStatus(): Promise<AirfieldStatus | null> {
  const supabase = createClient()
  if (!supabase) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('airfield_status')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    console.error('Failed to fetch airfield status:', error.message)
    return null
  }

  return data as AirfieldStatus
}

export async function updateAirfieldStatus(
  updates: Partial<Pick<AirfieldStatus, 'advisory_type' | 'advisory_text' | 'active_runway' | 'runway_status'>>,
  reason?: string
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { data: { user } } = await supabase.auth.getUser()

  // Get the current row before updating (for audit log)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('airfield_status')
    .select('*')
    .limit(1)
    .single()

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

  // Insert audit log entry
  try {
    const logEntry: Record<string, unknown> = {
      old_runway_status: existing.runway_status,
      new_runway_status: updates.runway_status ?? existing.runway_status,
      old_active_runway: existing.active_runway,
      new_active_runway: updates.active_runway ?? existing.active_runway,
      old_advisory_type: existing.advisory_type,
      new_advisory_type: updates.advisory_type !== undefined ? updates.advisory_type : existing.advisory_type,
      old_advisory_text: existing.advisory_text,
      new_advisory_text: updates.advisory_text !== undefined ? updates.advisory_text : existing.advisory_text,
      reason: reason || null,
      created_at: new Date().toISOString(),
    }
    if (user?.id) logEntry.changed_by = user.id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { error: logError } = await (supabase as any).from('runway_status_log').insert(logEntry)

    // Retry without changed_by if FK constraint fails (profile may not exist yet)
    if (logError && user?.id) {
      console.warn('Runway log insert failed, retrying without changed_by:', logError.message)
      delete logEntry.changed_by
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;({ error: logError } = await (supabase as any).from('runway_status_log').insert(logEntry))
    }

    if (logError) {
      console.error('Failed to log runway status change:', logError.message, logError)
    }
  } catch (e) {
    console.error('Failed to log runway status change:', e)
  }

  return true
}

/** Fetch runway status changes within a date range */
export async function fetchRunwayStatusLog(
  startUTC: string,
  endUTC: string
): Promise<RunwayStatusLogRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // Try with profile join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('runway_status_log')
    .select('*, profiles:changed_by(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      user_rank: (row.profiles as { rank?: string } | null)?.rank || undefined,
    })) as RunwayStatusLogRow[]
  }

  // Fallback without join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fallback, error: fbError } = await (supabase as any)
    .from('runway_status_log')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (fbError) {
    console.error('Failed to fetch runway status log:', fbError.message)
    return []
  }

  return (fallback ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    user_name: 'Unknown',
  })) as RunwayStatusLogRow[]
}
