import { createClient } from './client'

export interface NavaidStatus {
  id: string
  navaid_name: string
  status: 'green' | 'yellow' | 'red'
  notes: string | null
  updated_by: string | null
  updated_at: string
}

export async function fetchNavaidStatuses(): Promise<NavaidStatus[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('navaid_statuses')
    .select('*')
    .order('navaid_name')

  if (error) {
    console.error('Failed to fetch NAVAID statuses:', error.message)
    return []
  }

  return data as NavaidStatus[]
}

export async function updateNavaidStatus(
  id: string,
  status: 'green' | 'yellow' | 'red',
  notes: string | null
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('navaid_statuses')
    .update({
      status,
      notes: status === 'green' ? null : notes,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Failed to update NAVAID status:', error.message)
    return false
  }

  return true
}
