import { createClient } from './client'
import { logActivity } from './activity'

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
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch current state for activity logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('airfield_status')
    .select('*')
    .limit(1)
    .single()

  // Use RPC function (SECURITY DEFINER) to bypass RLS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('update_airfield_status', {
    p_updates: updates,
    p_updated_by: user?.id ?? null,
  })

  if (error) {
    console.error('Failed to update airfield status:', error.message)
    return false
  }

  // Log to activity_log so changes appear in Recent Activity on the dashboard
  if (existing) {
    try {
      if (updates.runway_status && updates.runway_status !== existing.runway_status) {
        logActivity('updated', 'runway_status', existing.id,
          `${existing.runway_status.toUpperCase()} → ${updates.runway_status.toUpperCase()}`)
      }
      if (updates.active_runway && updates.active_runway !== existing.active_runway) {
        logActivity('updated', 'active_runway', existing.id,
          `RWY ${existing.active_runway} → RWY ${updates.active_runway}`)
      }
      if (updates.advisory_type !== undefined &&
          (updates.advisory_type !== existing.advisory_type || updates.advisory_text !== existing.advisory_text)) {
        const oldAdv = existing.advisory_type || 'None'
        const newAdv = updates.advisory_type || 'None'
        logActivity('updated', 'advisory', existing.id,
          oldAdv !== newAdv ? `${oldAdv} → ${newAdv}` : `${newAdv} (text updated)`)
      }
    } catch {
      // Activity logging is non-critical
    }
  }

  // Audit log entry is created automatically by the
  // trg_log_airfield_status database trigger (see migrations).
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
