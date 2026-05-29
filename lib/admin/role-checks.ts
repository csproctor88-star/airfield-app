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

/** Roles that only sys_admin can assign */
const ADMIN_ONLY_ROLES = ['sys_admin', 'base_admin']

/**
 * Privileged roles a user may NOT assign to themselves via the public
 * self-signup form. Mirrors SELF_SERVICE_EXCLUDED_ROLES in app/login/page.tsx,
 * but enforced server-side — the form only HIDES these, so a crafted request
 * could otherwise smuggle an admin role onto a new account.
 */
export const SELF_SIGNUP_EXCLUDED_ROLES: UserRole[] = ['sys_admin', 'base_admin']

const ALL_USER_ROLES: UserRole[] = [
  'airfield_manager', 'namo', 'amops', 'ces', 'safety', 'atc', 'read_only',
  'base_admin', 'sys_admin', 'ppr', 'airfield_status', 'majcom_rfm',
  'accountable_executive', 'sms_manager', 'aep_coordinator', 'ops_supervisor', 'arff_chief',
]

/**
 * Coerce a client-supplied self-signup role to a safe value.
 * Unknown strings and privileged (admin) roles both collapse to 'read_only'.
 * Returns the coerced role plus whether coercion happened (for logging).
 */
export function sanitizeSelfSignupRole(role: unknown): { role: UserRole; coerced: boolean } {
  if (
    typeof role !== 'string' ||
    !ALL_USER_ROLES.includes(role as UserRole) ||
    SELF_SIGNUP_EXCLUDED_ROLES.includes(role as UserRole)
  ) {
    return { role: 'read_only', coerced: true }
  }
  return { role: role as UserRole, coerced: false }
}

/**
 * Strip fields that base admins are not allowed to change.
 * Base admins cannot change primary_base_id or assign admin roles.
 * They CAN assign non-admin roles (airfield_manager, namo, amops, etc.)
 */
export function sanitizeBaseAdminUpdate(
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const { primary_base_id, ...allowed } = updates
  // Block admin role assignment by base admins
  if (allowed.role && ADMIN_ONLY_ROLES.includes(allowed.role as string)) {
    delete allowed.role
  }
  return allowed
}
