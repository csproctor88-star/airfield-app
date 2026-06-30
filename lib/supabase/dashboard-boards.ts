import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import { validateBoardLayout, GRID_SCALE, type BoardLayout } from '@/lib/dashboard/layout'

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
  layout: BoardLayout
  created_at: string
  updated_at: string
}

function hydrate(row: Record<string, any>): DashboardBoardRow {
  return { ...row, layout: validateBoardLayout(row.layout) } as DashboardBoardRow
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
  layout?: BoardLayout
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
      // Stamp the current grid scale: callers build layouts from registry/template
      // defaults that are already on the current scale, so mark (don't re-scale).
      layout: { ...(input.layout ?? { lg: [] }), gridScale: GRID_SCALE },
    })
    .select('*')
    .single()
  if (error) return { data: null, error: friendlyError(error) }
  return { data: hydrate(data), error: null }
}

/** Direct layout update (online path). The offline-aware caller is in lib/dashboard-board-write.ts. */
export async function updateBoardLayout(
  id: string,
  layout: BoardLayout,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Offline' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  // .select() so we can detect a 0-row update. RLS denies the write *silently*
  // (no error, 0 rows updated) when the board isn't writable by this user —
  // e.g. a shared board they lack `dashboard:publish-shared` for. Without this
  // check the layout change is lost with no feedback; surface it as a real error
  // so the caller shows a "couldn't save" toast instead of silent data loss.
  const { data, error } = await sb
    .from('dashboard_boards')
    // Stamp the current grid scale on every write: the in-memory layout has
    // already been normalized to the current scale by validateBoardLayout on read.
    .update({ layout: { ...layout, gridScale: GRID_SCALE }, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) return { error: friendlyError(error) }
  if (!Array.isArray(data) || data.length === 0) {
    return { error: "Couldn't save — you don't have permission to edit this dashboard." }
  }
  return { error: null }
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

/** The board the user has chosen as their default at this base, or null. */
export async function getUserDefaultBoardId(
  baseId: string,
  userId: string,
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('dashboard_user_defaults')
    .select('board_id')
    .eq('user_id', userId)
    .eq('base_id', baseId)
    .maybeSingle()
  if (error) { console.error('getUserDefaultBoardId', error); return null }
  return (data?.board_id as string) ?? null
}

/**
 * Set ANY board (personal or shared) as the caller's default at this base.
 * Stored per-user in dashboard_user_defaults, so it never affects other users
 * and can point at a shared board.
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
  const { data, error } = await sb
    .from('dashboard_user_defaults')
    .upsert(
      { user_id: userId, base_id: baseId, board_id: boardId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,base_id' },
    )
    .select('board_id')
  if (error) return { error: friendlyError(error) }
  if (!Array.isArray(data) || data.length === 0) {
    return { error: "Couldn't set default — please try again." }
  }
  return { error: null }
}

/**
 * The caller's default board at this base. Resolution order:
 * 1) the per-user default (any board, incl. shared) if it's still visible;
 * 2) a legacy personal board still flagged is_default (pre-migration fallback);
 * 3) the caller's first personal board;
 * 4) otherwise seed a new personal board from the role template and record it.
 */
export async function getOrCreateDefaultBoard(
  baseId: string,
  userId: string,
): Promise<DashboardBoardRow | null> {
  const boards = await fetchBoards(baseId)
  const defaultId = await getUserDefaultBoardId(baseId, userId)
  if (defaultId) {
    const chosen = boards.find(b => b.id === defaultId)
    if (chosen) return chosen
  }
  const legacy = boards.find(b => b.owner_id === userId && b.is_default)
  if (legacy) return legacy
  const mine = boards.find(b => b.owner_id === userId)
  if (mine) return mine
  const { currentUserRole, seedLayoutFromTemplate } = await import('@/lib/dashboard/board-templates')
  const role = await currentUserRole(userId)
  const seeded = seedLayoutFromTemplate(boards, role)
  const { data } = await createBoard({
    base_id: baseId, owner_id: userId, name: 'My Dashboard', is_default: true, layout: seeded,
  })
  if (data) await setDefaultBoard(data.id, baseId, userId)
  return data
}
