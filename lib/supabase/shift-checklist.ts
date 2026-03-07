import { createClient } from './client'

// --- Types ---

export type ShiftType = 'day' | 'swing'
export type FrequencyType = 'daily' | 'weekly' | 'monthly'

export interface ShiftChecklistItem {
  id: string
  base_id: string
  label: string
  shift: ShiftType
  frequency: FrequencyType
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface ShiftChecklist {
  id: string
  base_id: string
  checklist_date: string
  status: 'in_progress' | 'completed'
  completed_by: string | null
  completed_at: string | null
  created_at: string
}

export interface ShiftChecklistResponse {
  id: string
  checklist_id: string
  item_id: string
  completed: boolean
  completed_by: string | null
  completed_at: string | null
  notes: string | null
}

// --- Template Items (admin config) ---

export async function fetchChecklistItems(baseId?: string | null): Promise<ShiftChecklistItem[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  const { data } = await supabase
    .from('shift_checklist_items')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data || []) as ShiftChecklistItem[]
}

export async function createChecklistItem(input: {
  base_id: string
  label: string
  shift: ShiftType
  frequency: FrequencyType
  sort_order?: number
}): Promise<{ data: ShiftChecklistItem | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data, error } = await supabase
    .from('shift_checklist_items')
    .insert({
      base_id: input.base_id,
      label: input.label,
      shift: input.shift,
      frequency: input.frequency,
      sort_order: input.sort_order ?? 0,
    } as any)
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as ShiftChecklistItem, error: null }
}

export async function updateChecklistItem(
  id: string,
  updates: Partial<Pick<ShiftChecklistItem, 'label' | 'shift' | 'frequency' | 'sort_order' | 'is_active'>>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('shift_checklist_items')
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
  return { error: error?.message || null }
}

export async function deleteChecklistItem(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('shift_checklist_items').delete().eq('id', id)
  return { error: error?.message || null }
}

// --- Daily Checklists ---

export async function fetchOrCreateTodayChecklist(baseId: string): Promise<{ checklist: ShiftChecklist | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { checklist: null, error: 'Supabase not configured' }

  const today = new Date().toISOString().split('T')[0]

  // Try to fetch existing
  const { data: existing } = await supabase
    .from('shift_checklists')
    .select('*')
    .eq('base_id', baseId)
    .eq('checklist_date', today)
    .single()

  if (existing) return { checklist: existing as ShiftChecklist, error: null }

  // Create new
  const { data: created, error } = await supabase
    .from('shift_checklists')
    .insert({ base_id: baseId, checklist_date: today } as any)
    .select()
    .single()

  if (error) return { checklist: null, error: error.message }
  return { checklist: created as ShiftChecklist, error: null }
}

export async function fetchChecklist(checklistId: string): Promise<ShiftChecklist | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('shift_checklists')
    .select('*')
    .eq('id', checklistId)
    .single()
  return (data as ShiftChecklist) || null
}

export async function fetchChecklistHistory(baseId: string, limit = 30): Promise<ShiftChecklist[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  const { data } = await supabase
    .from('shift_checklists')
    .select('*')
    .eq('base_id', baseId)
    .order('checklist_date', { ascending: false })
    .limit(limit)
  return (data || []) as ShiftChecklist[]
}

export async function completeChecklist(checklistId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  let completedBy: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) completedBy = user.id
  } catch { /* */ }

  const { error } = await supabase
    .from('shift_checklists')
    .update({
      status: 'completed',
      completed_by: completedBy || null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', checklistId)
  return { error: error?.message || null }
}

export async function reopenChecklist(checklistId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('shift_checklists')
    .update({
      status: 'in_progress',
      completed_by: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', checklistId)
  return { error: error?.message || null }
}

// --- Responses ---

export async function fetchResponses(checklistId: string): Promise<ShiftChecklistResponse[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('shift_checklist_responses')
    .select('*')
    .eq('checklist_id', checklistId)
  return (data || []) as ShiftChecklistResponse[]
}

export async function upsertResponse(input: {
  checklist_id: string
  item_id: string
  completed: boolean
  notes?: string
}): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  let userId: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userId = user.id
  } catch { /* */ }

  const row: Record<string, any> = {
    checklist_id: input.checklist_id,
    item_id: input.item_id,
    completed: input.completed,
    completed_by: input.completed ? (userId || null) : null,
    completed_at: input.completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }
  if (input.notes !== undefined) row.notes = input.notes

  // Upsert on (checklist_id, item_id) unique constraint
  const { error } = await supabase
    .from('shift_checklist_responses')
    .upsert(row as any, { onConflict: 'checklist_id,item_id' })

  return { error: error?.message || null }
}

// --- Helpers ---

/** Determine which items should appear today based on frequency */
export function itemAppliesToday(item: ShiftChecklistItem, date?: Date): boolean {
  if (!item.is_active) return false
  if (item.frequency === 'daily') return true

  const d = date || new Date()
  if (item.frequency === 'weekly') {
    // Show weekly items on Mondays (day 1)
    return d.getDay() === 1
  }
  if (item.frequency === 'monthly') {
    // Show monthly items on the 1st of the month
    return d.getDate() === 1
  }
  return false
}
