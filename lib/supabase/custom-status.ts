import { createClient } from './client'
import { logActivity } from './activity'

// Helper: cast supabase to bypass strict table typing for new tables not yet in generated types
function db() {
  const supabase = createClient()
  return supabase ? (supabase as any) : null
}

// ── Types ──

export type CustomStatusBoard = {
  id: string
  base_id: string
  board_name: string
  section: 'runway' | 'navaid' | 'arff' | 'standalone'
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CustomStatusItem = {
  id: string
  board_id: string
  base_id: string
  item_name: string
  status: 'green' | 'yellow' | 'red'
  notes: string | null
  sort_order: number
  updated_by: string | null
  updated_at: string
}

// ── Boards CRUD ──

export async function fetchCustomStatusBoards(baseId: string): Promise<CustomStatusBoard[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('custom_status_boards')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })

  return (data || []) as CustomStatusBoard[]
}

export async function createCustomStatusBoard(input: {
  base_id: string
  board_name: string
  sort_order?: number
  section?: 'runway' | 'navaid' | 'arff' | 'standalone'
}): Promise<CustomStatusBoard | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('custom_status_boards')
    .insert({ ...input, created_by: user?.id })
    .select()
    .single()

  if (error || !data) return null
  return data as CustomStatusBoard
}

export async function updateCustomStatusBoard(
  id: string,
  updates: Partial<Pick<CustomStatusBoard, 'board_name' | 'sort_order' | 'section'>>,
): Promise<CustomStatusBoard | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('custom_status_boards')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return data as CustomStatusBoard
}

export async function deleteCustomStatusBoard(id: string, boardName?: string, baseId?: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('custom_status_boards')
    .delete()
    .eq('id', id)

  if (!error && boardName) {
    logActivity('deleted', 'custom_status_board', id, boardName, undefined, baseId)
  }
  return !error
}

// ── Items CRUD ──

export async function fetchCustomStatusItems(boardId: string): Promise<CustomStatusItem[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('custom_status_items')
    .select('*')
    .eq('board_id', boardId)
    .order('sort_order', { ascending: true })

  return (data || []) as CustomStatusItem[]
}

export async function fetchAllCustomStatusItems(baseId: string): Promise<CustomStatusItem[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('custom_status_items')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })

  return (data || []) as CustomStatusItem[]
}

export async function createCustomStatusItem(input: {
  board_id: string
  base_id: string
  item_name: string
  sort_order?: number
}): Promise<CustomStatusItem | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('custom_status_items')
    .insert(input)
    .select()
    .single()

  if (error || !data) return null
  return data as CustomStatusItem
}

export async function updateCustomStatusItem(
  id: string,
  updates: Partial<Pick<CustomStatusItem, 'item_name' | 'status' | 'notes' | 'sort_order'>>,
): Promise<CustomStatusItem | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('custom_status_items')
    .update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return data as CustomStatusItem
}

export async function deleteCustomStatusItem(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('custom_status_items')
    .delete()
    .eq('id', id)

  return !error
}
