import { createClient } from './client'
import type { InspectionType, InspectionItem } from './types'

export type InspectionRow = {
  id: string
  display_id: string
  inspection_type: InspectionType
  inspector_id: string
  inspector_name: string | null
  inspection_date: string
  status: 'in_progress' | 'completed'
  items: InspectionItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  completion_percent: number
  construction_meeting: boolean
  joint_monthly: boolean
  bwc_value: string | null
  weather_conditions: string | null
  temperature_f: number | null
  notes: string | null
  daily_group_id: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export async function fetchInspections(): Promise<InspectionRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('inspections')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch inspections:', error.message)
    return []
  }

  return (data ?? []) as InspectionRow[]
}

export async function fetchInspection(id: string): Promise<InspectionRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('inspections')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch inspection:', error.message)
    return null
  }

  return data as InspectionRow
}

/** Fetch both halves of a daily inspection by group ID */
export async function fetchDailyGroup(groupId: string): Promise<InspectionRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('inspections')
    .select('*')
    .eq('daily_group_id', groupId)
    .order('inspection_type', { ascending: true })

  if (error) {
    console.error('Failed to fetch daily group:', error.message)
    return []
  }

  return (data ?? []) as InspectionRow[]
}

export async function createInspection(input: {
  inspection_type: InspectionType
  inspector_name: string
  items: InspectionItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  construction_meeting: boolean
  joint_monthly: boolean
  bwc_value: string | null
  weather_conditions: string | null
  temperature_f: number | null
  notes: string | null
  daily_group_id?: string | null
}): Promise<{ data: InspectionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // Get authenticated user for inspector_id
  let inspector_id: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) inspector_id = user.id
  } catch {
    // No authenticated user
  }

  // Generate display ID
  const now = new Date()
  const year = now.getFullYear()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const prefix = input.inspection_type === 'airfield' ? 'AI' : 'LI'
  const display_id = `${prefix}-${year}-${ts}`

  const completion_percent = input.total_items > 0
    ? Math.round(((input.passed_count + input.failed_count + input.na_count) / input.total_items) * 100)
    : 0

  const row: Record<string, unknown> = {
    display_id,
    inspection_type: input.inspection_type,
    inspector_name: input.inspector_name,
    inspection_date: now.toISOString().split('T')[0],
    status: 'completed',
    items: input.items,
    total_items: input.total_items,
    passed_count: input.passed_count,
    failed_count: input.failed_count,
    na_count: input.na_count,
    completion_percent,
    construction_meeting: input.construction_meeting,
    joint_monthly: input.joint_monthly,
    bwc_value: input.bwc_value,
    weather_conditions: input.weather_conditions,
    temperature_f: input.temperature_f,
    notes: input.notes,
    daily_group_id: input.daily_group_id || null,
    completed_at: now.toISOString(),
  }
  if (inspector_id) row.inspector_id = inspector_id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('inspections')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Failed to create inspection:', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as InspectionRow, error: null }
}

/** Get the current user's profile name for auto-fill */
export async function getInspectorName(): Promise<{ name: string | null; id: string | null }> {
  const supabase = createClient()
  if (!supabase) return { name: null, id: null }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { name: null, id: null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('name, rank')
      .eq('id', user.id)
      .single()

    if (profile) {
      const displayName = profile.rank
        ? `${profile.rank} ${profile.name}`
        : profile.name
      return { name: displayName, id: user.id }
    }

    // Fall back to email if no profile
    return { name: user.email || null, id: user.id }
  } catch {
    return { name: null, id: null }
  }
}

export async function deleteInspection(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('inspections')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Delete inspection failed:', error.message)
    return { error: error.message }
  }

  return { error: null }
}
