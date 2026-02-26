import { createClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/supabase/types'

export type AdminRole = 'sys_admin' | 'base_admin'

export interface CallerProfile {
  id: string
  role: UserRole
  primary_base_id: string | null
}

/** Create a Supabase admin client using the service role key */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Create a Supabase client using the anon key (for auth.getUser with cookie) */
export function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return null
  return createClient(url, key)
}

export function isSysAdmin(role: string): boolean {
  return role === 'sys_admin'
}

export function isBaseAdmin(role: string): boolean {
  return role === 'base_admin' || role === 'airfield_manager' || role === 'namo'
}

export function isAdmin(role: string): boolean {
  return role === 'sys_admin' || isBaseAdmin(role)
}

/**
 * Validate that a base admin can operate on a target user.
 * Base admins can only manage users at their own primary base.
 */
export function canBaseAdminManageUser(
  callerBaseId: string | null,
  targetBaseId: string | null,
): boolean {
  if (!callerBaseId || !targetBaseId) return false
  return callerBaseId === targetBaseId
}

/**
 * Strip fields that base admins are not allowed to change.
 * Base admins cannot change role or primary_base_id.
 */
export function sanitizeBaseAdminUpdate(
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const { role, primary_base_id, ...allowed } = updates
  return allowed
}
