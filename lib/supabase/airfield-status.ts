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
  updates: Partial<Pick<AirfieldStatus, 'advisory_type' | 'advisory_text' | 'active_runway' | 'runway_status'>>
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { data: { user } } = await supabase.auth.getUser()

  // Get the single row id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('airfield_status')
    .select('id')
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

  return true
}
