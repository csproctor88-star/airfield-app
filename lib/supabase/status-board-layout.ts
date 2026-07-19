import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import type { Json } from './types'
import {
  validateStatusBoardGridLayout, layoutStackOrder, type StatusBoardGridLayout,
} from '@/lib/status-board-grid'

// Per-base saved layout of the Airfield Status board section cards —
// grid rects (drag + resize) since 2026071902; the original section_order
// column persists as the derived phone-stacking order. Reads are open to
// every base member (the board renders in the saved layout for all
// viewers); writes require airfield_status:manage_layout (base-admin
// tier) — enforced by RLS, mirrored in the page's UI gate. The page
// buffers edits locally and calls save ONCE on the explicit Save action.

export type StatusBoardLayoutRow = {
  grid: StatusBoardGridLayout | null
  sectionOrder: string[] | null
}

export async function fetchStatusBoardLayout(baseId: string): Promise<StatusBoardLayoutRow> {
  const supabase = createClient()
  if (!supabase) return { grid: null, sectionOrder: null }
  const { data, error } = await supabase
    .from('status_board_layouts')
    .select('section_order, layout')
    .eq('base_id', baseId)
    .maybeSingle()
  if (error) {
    console.error('Failed to fetch status board layout:', error.message)
    return { grid: null, sectionOrder: null }
  }
  return {
    grid: validateStatusBoardGridLayout(data?.layout ?? null),
    sectionOrder: (data?.section_order as string[] | null) ?? null,
  }
}

export async function saveStatusBoardLayout(
  baseId: string,
  grid: StatusBoardGridLayout,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('status_board_layouts')
    .upsert({
      base_id: baseId,
      layout: grid as unknown as Json,
      section_order: layoutStackOrder(grid),
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'base_id' })
  if (error) return { error: friendlyError(error.message) }
  return { error: null }
}

/** "Reset to default" — deleting the row falls back to the built-in band. */
export async function clearStatusBoardLayout(baseId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('status_board_layouts').delete().eq('base_id', baseId)
  if (error) return { error: friendlyError(error.message) }
  return { error: null }
}
