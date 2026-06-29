import { createClient } from '@/lib/supabase/client'
import type { DashboardBoardRow } from '@/lib/supabase/dashboard-boards'
import type { BoardLayout } from '@/lib/dashboard/layout'

/** The caller's role from profiles (authoritative; base_members.role is stale). */
export async function currentUserRole(userId: string): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return (data as { role: string | null } | null)?.role ?? null
}

/**
 * Pick the starter layout for a new user's first board: the shared board whose
 * role_template matches the user's role, else { lg: [] }. Pure given the inputs.
 */
export function seedLayoutFromTemplate(
  boards: Pick<DashboardBoardRow, 'owner_id' | 'role_template' | 'layout'>[],
  role: string | null,
): BoardLayout {
  if (!role) return { lg: [] }
  const tpl = boards.find(b => b.owner_id === null && b.role_template === role)
  return tpl ? tpl.layout : { lg: [] }
}
