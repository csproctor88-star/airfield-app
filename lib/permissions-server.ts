import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveEffectivePermissions } from './permissions'

// Server-only permission helper.
//
// Lives outside the `'use client'` module so Next.js App Router doesn't
// wrap it as a client reference when server code imports it. Use from
// API route handlers and server components; client code should use the
// `usePermissions()` hook from `./permissions` instead.
//
// For a single-key check you generally want the `user_has_permission`
// SECURITY DEFINER RPC directly — one round-trip, no role resolution
// on the client. This helper is for routes that need the full permission
// set (e.g. building a gate map for a complex workflow).
export async function getPermissionsFor(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<Set<string>> {
  if (!supabase) return new Set()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  const role = (profile as { role?: string } | null)?.role
  if (!role) return new Set()

  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    supabase.from('role_permissions').select('permission_key').eq('role', role),
    supabase
      .from('user_permission_overrides')
      .select('permission_key, granted')
      .eq('user_id', userId),
  ])

  const roleKeys = ((rolePerms ?? []) as Array<{ permission_key?: string | null }>)
    .map((row) => row.permission_key)
    .filter((k): k is string => typeof k === 'string')
  const overrideRows = ((overrides ?? []) as Array<{ permission_key?: string | null; granted?: boolean | null }>)
    .filter((r): r is { permission_key: string; granted: boolean } =>
      typeof r.permission_key === 'string' && typeof r.granted === 'boolean')
  return resolveEffectivePermissions(roleKeys, overrideRows)
}
