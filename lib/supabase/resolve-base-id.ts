import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Resolve the base_id for a write into a base-scoped table.
 *
 * Returns the explicit base_id when the caller supplied one (the common path —
 * no extra queries), otherwise falls back to the authenticated user's primary
 * base. Returns null ONLY when neither is available.
 *
 * Every insert into a base-scoped table must set base_id from this helper rather
 * than the old `if (baseId) row.base_id = baseId` idiom, which silently inserted
 * NULL base_id rows. Those rows leaked cross-tenant via the user_has_base_access
 * NULL escape hatch; once that hatch is removed they will also be REJECTED on
 * write. Populating base_id here makes that hardening safe-by-construction: a
 * genuinely base-less write (no current base + no primary base) yields null and
 * is correctly refused by RLS instead of creating an orphan.
 */
export async function resolveBaseId(
  supabase: SupabaseClient<Database>,
  baseId?: string | null,
  knownUserId?: string | null,
): Promise<string | null> {
  if (baseId) return baseId
  let userId = knownUserId ?? null
  if (!userId) {
    const { data } = await supabase.auth.getUser()
    userId = data.user?.id ?? null
  }
  if (!userId) return null
  const { data } = await supabase.from('profiles').select('primary_base_id').eq('id', userId).single()
  return (data as { primary_base_id?: string | null } | null)?.primary_base_id ?? null
}
