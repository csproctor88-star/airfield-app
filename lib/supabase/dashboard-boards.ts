import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import { validateLayout, type WidgetInstance } from '@/lib/dashboard/layout'

// New tables are not yet in the generated Database type — cast the client
// to `any` for these calls (the lib/supabase/read-files.ts pattern).

export type DashboardBoardRow = {
  id: string
  base_id: string
  owner_id: string | null
  scope: 'personal' | 'shared'
  name: string
  is_default: boolean
  role_template: string | null
  layout: WidgetInstance[]
  created_at: string
  updated_at: string
}

function hydrate(row: Record<string, any>): DashboardBoardRow {
  return { ...row, layout: validateLayout(row.layout) } as DashboardBoardRow
}

/** All boards visible to the caller at a base (own personal + shared). RLS-scoped. */
export async function fetchBoards(baseId: string): Promise<DashboardBoardRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('dashboard_boards')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: true })
  if (error) { console.error('fetchBoards', error); return [] }
  return (data ?? []).map(hydrate)
}

export async function createBoard(input: {
  base_id: string
  owner_id: string | null
  name?: string
  scope?: 'personal' | 'shared'
  is_default?: boolean
  layout?: WidgetInstance[]
}): Promise<{ data: DashboardBoardRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Offline' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('dashboard_boards')
    .insert({
      base_id: input.base_id,
      owner_id: input.owner_id,
      name: input.name ?? 'My Dashboard',
      scope: input.scope ?? 'personal',
      is_default: input.is_default ?? false,
      layout: input.layout ?? [],
    })
    .select('*')
    .single()
  if (error) return { data: null, error: friendlyError(error) }
  return { data: hydrate(data), error: null }
}

/** Direct layout update (online path). The offline-aware caller is in lib/dashboard-board-write.ts. */
export async function updateBoardLayout(
  id: string,
  layout: WidgetInstance[],
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Offline' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error } = await sb
    .from('dashboard_boards')
    .update({ layout, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? friendlyError(error) : null }
}

export async function updateBoard(
  id: string,
  patch: Partial<Pick<DashboardBoardRow, 'name' | 'scope' | 'role_template'>>,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Offline' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error } = await sb
    .from('dashboard_boards')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? friendlyError(error) : null }
}

export async function deleteBoard(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Offline' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error } = await sb.from('dashboard_boards').delete().eq('id', id)
  return { error: error ? friendlyError(error) : null }
}

/**
 * Set a personal board as the user's default at this base.
 * Clears is_default on all other owned boards at the base first,
 * then sets it on the target board.
 */
export async function setDefaultBoard(
  boardId: string,
  baseId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Offline' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  // Step 1: clear is_default for all of this user's boards at this base.
  const { error: clearError } = await sb
    .from('dashboard_boards')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('owner_id', userId)
    .eq('base_id', baseId)
  if (clearError) return { error: friendlyError(clearError) }
  // Step 2: set is_default on the target board.
  const { error: setError } = await sb
    .from('dashboard_boards')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', boardId)
  return { error: setError ? friendlyError(setError) : null }
}

/** The caller's default personal board, creating an empty one on first visit. */
export async function getOrCreateDefaultBoard(
  baseId: string,
  userId: string,
): Promise<DashboardBoardRow | null> {
  const boards = await fetchBoards(baseId)
  const mine = boards.find(b => b.owner_id === userId && b.is_default)
  if (mine) return mine
  const { currentUserRole, seedLayoutFromTemplate } = await import('@/lib/dashboard/board-templates')
  const role = await currentUserRole(userId)
  const seeded = seedLayoutFromTemplate(boards, role)
  const { data } = await createBoard({
    base_id: baseId, owner_id: userId, name: 'My Dashboard', is_default: true, layout: seeded,
  })
  return data
}
