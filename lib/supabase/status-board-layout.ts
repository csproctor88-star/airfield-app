import { friendlyError } from '@/lib/utils'
import { createClient } from './client'

// Per-base saved order of the Airfield Status board section cards.
// Reads are open to every base member (the board renders in the saved
// order for all viewers); writes require airfield_status:manage_layout
// (base-admin tier) — enforced by RLS, mirrored in the page's UI gate.

export async function fetchStatusBoardLayout(baseId: string): Promise<string[] | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('status_board_layouts')
    .select('section_order')
    .eq('base_id', baseId)
    .maybeSingle()
  if (error) {
    console.error('Failed to fetch status board layout:', error.message)
    return null
  }
  return (data?.section_order as string[] | undefined) ?? null
}

export async function saveStatusBoardLayout(
  baseId: string,
  order: string[],
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('status_board_layouts')
    .upsert({
      base_id: baseId,
      section_order: order,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'base_id' })
  if (error) return { error: friendlyError(error.message) }
  return { error: null }
}

/** "Reset to default" — deleting the row falls back to the built-in order. */
export async function clearStatusBoardLayout(baseId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('status_board_layouts').delete().eq('base_id', baseId)
  if (error) return { error: friendlyError(error.message) }
  return { error: null }
}
