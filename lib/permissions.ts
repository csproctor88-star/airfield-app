'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Canonical permission keys ───────────────────────────────
// Keep in sync with supabase/migrations/2026042200_permission_matrix_scaffold.sql
// These constants are the only way app code should refer to permission keys.
// Grep-friendly. If you add a key in SQL, mirror it here.

export const PERM = {
  // Airfield status
  AIRFIELD_STATUS_VIEW:                 'airfield_status:view',
  AIRFIELD_STATUS_WRITE:                'airfield_status:write',
  AIRFIELD_STATUS_WRITE_RSC_BWC_ONLY:   'airfield_status:write:rsc_bwc_only',

  // Ops — view/write/delete
  CHECKS_VIEW:                          'checks:view',
  CHECKS_WRITE:                         'checks:write',
  CHECKS_DELETE:                        'checks:delete',
  INSPECTIONS_VIEW:                     'inspections:view',
  INSPECTIONS_WRITE:                    'inspections:write',
  INSPECTIONS_DELETE:                   'inspections:delete',
  INSPECTIONS_FILE:                     'inspections:file',
  ACSI_VIEW:                            'acsi:view',
  ACSI_WRITE:                           'acsi:write',
  ACSI_DELETE:                          'acsi:delete',
  ACSI_FILE:                            'acsi:file',

  // Discrepancies — broken out for CES
  DISCREPANCIES_VIEW:                   'discrepancies:view',
  DISCREPANCIES_WRITE:                  'discrepancies:write',
  DISCREPANCIES_DELETE:                 'discrepancies:delete',
  DISCREPANCIES_CLOSE:                  'discrepancies:close',
  DISCREPANCIES_CANCEL:                 'discrepancies:cancel',
  DISCREPANCIES_TRANSITION_CES:         'discrepancies:transition:ces_statuses',
  DISCREPANCIES_UPDATE_RESOLUTION:      'discrepancies:update:resolution_notes',
  DISCREPANCIES_ADD_NOTE:               'discrepancies:add_note',

  CES_VIEW:                             'ces:view',
  INFRASTRUCTURE_VIEW:                  'infrastructure:view',
  INFRASTRUCTURE_WRITE:                 'infrastructure:write',
  INFRASTRUCTURE_DELETE:                'infrastructure:delete',
  PARKING_VIEW:                         'parking:view',
  PARKING_WRITE:                        'parking:write',
  PARKING_DELETE:                       'parking:delete',
  OBSTRUCTIONS_VIEW:                    'obstructions:view',
  OBSTRUCTIONS_WRITE:                   'obstructions:write',
  OBSTRUCTIONS_DELETE:                  'obstructions:delete',
  QRC_VIEW:                             'qrc:view',
  QRC_WRITE:                            'qrc:write',
  QRC_EXECUTE:                          'qrc:execute',
  SHIFT_CHECKLIST_VIEW:                 'shift_checklist:view',
  SHIFT_CHECKLIST_WRITE:                'shift_checklist:write',
  SCN_VIEW:                             'scn:view',
  SCN_WRITE:                            'scn:write',
  SCN_MANAGE_AGENCIES:                  'scn:manage_agencies',
  WILDLIFE_VIEW:                        'wildlife:view',
  WILDLIFE_WRITE:                       'wildlife:write',
  WILDLIFE_DELETE:                      'wildlife:delete',
  WAIVERS_VIEW:                         'waivers:view',
  WAIVERS_WRITE:                        'waivers:write',
  WAIVERS_DELETE:                       'waivers:delete',
  WAIVERS_REVIEW:                       'waivers:review',
  NOTAMS_VIEW:                          'notams:view',
  NOTAMS_WRITE:                         'notams:write',
  NOTAMS_CANCEL:                        'notams:cancel',
  PPR_VIEW:                             'ppr:view',
  PPR_WRITE:                            'ppr:write',
  PPR_DELETE:                           'ppr:delete',
  CONTRACTORS_VIEW:                     'contractors:view',
  CONTRACTORS_WRITE:                    'contractors:write',
  CONTRACTORS_DELETE:                   'contractors:delete',

  // Photos (shared across modules, added in Phase D2b)
  PHOTOS_WRITE:                         'photos:write',
  PHOTOS_DELETE:                        'photos:delete',

  // Daily reviews
  DAILY_REVIEWS_VIEW:                   'daily_reviews:view',
  DAILY_REVIEWS_SIGN_AMSL:              'daily_reviews:sign:amsl',
  DAILY_REVIEWS_SIGN_NAMO:              'daily_reviews:sign:namo',
  DAILY_REVIEWS_SIGN_AFM:               'daily_reviews:sign:afm',

  // Reporting / activity
  REPORTS_VIEW:                         'reports:view',
  REPORTS_EXPORT:                       'reports:export',
  ACTIVITY_LOG_VIEW:                    'activity_log:view',
  ACTIVITY_LOG_WRITE_MANUAL:            'activity_log:write_manual',
  ACTIVITY_LOG_DELETE:                  'activity_log:delete',
  RECENT_ACTIVITY_VIEW:                 'recent_activity:view',

  // Feedback
  FEEDBACK_VIEW:                        'feedback:view',
  FEEDBACK_CONFIGURE:                   'feedback:configure',
  FEEDBACK_DELETE:                      'feedback:delete',

  // Reference
  TRAINING_VIEW:                        'training:view',
  LIBRARY_VIEW:                         'library:view',
  LIBRARY_MANAGE:                       'library:manage',
  REGULATIONS_VIEW:                     'regulations:view',
  AIRCRAFT_VIEW:                        'aircraft:view',

  // Admin
  USERS_VIEW:                           'users:view',
  USERS_MANAGE:                         'users:manage',
  BASE_SETUP_VIEW:                      'base_setup:view',
  BASE_SETUP_WRITE:                     'base_setup:write',
  SETTINGS_VIEW:                        'settings:view',
  INSTALLATIONS_SWITCH:                 'installations:switch',
} as const

export type PermissionKey = typeof PERM[keyof typeof PERM]

// ── Client-side fetch + cache ──────────────────────────────
// One read per session: union the caller's role-preset permissions
// with their per-user overrides. Grants win when no override; override
// wins when present (grant OR revoke, per the SQL helper).

async function fetchPermissionsForCurrentUser(): Promise<Set<string>> {
  const supabase = createClient()
  if (!supabase) return new Set()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile as { role?: string } | null)?.role
  if (!role) return new Set()

  // `role_permissions` and `user_permission_overrides` aren't in the
  // generated Database types yet — cast the client until types regen.
  const anySupa = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{ data: Array<Record<string, unknown>> | null }>
      }
    }
  }

  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    anySupa.from('role_permissions').select('permission_key').eq('role', role),
    anySupa.from('user_permission_overrides').select('permission_key, granted').eq('user_id', user.id),
  ])

  const set = new Set<string>()
  for (const row of (rolePerms ?? [])) {
    const key = (row as { permission_key?: string }).permission_key
    if (key) set.add(key)
  }
  // Overrides: granted=true adds, granted=false removes (wins over role preset)
  for (const row of (overrides ?? [])) {
    const r = row as { permission_key?: string; granted?: boolean }
    if (!r.permission_key) continue
    if (r.granted) set.add(r.permission_key)
    else set.delete(r.permission_key)
  }
  return set
}

// ── React hook ─────────────────────────────────────────────
export function usePermissions() {
  const [perms, setPerms] = useState<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPermissionsForCurrentUser().then((s) => {
      if (!cancelled) setPerms(s)
    })
    return () => { cancelled = true }
  }, [])

  const has = useCallback((key: PermissionKey | string) => {
    if (!perms) return false
    return perms.has(key)
  }, [perms])

  const hasAny = useCallback((keys: (PermissionKey | string)[]) => {
    if (!perms) return false
    return keys.some((k) => perms.has(k))
  }, [perms])

  const hasAll = useCallback((keys: (PermissionKey | string)[]) => {
    if (!perms) return false
    return keys.every((k) => perms.has(k))
  }, [perms])

  return useMemo(() => ({
    has,
    hasAny,
    hasAll,
    all: perms,
    loaded: perms !== null,
  }), [has, hasAny, hasAll, perms])
}

// ── Server-side helper (route handlers) ────────────────────
// For API routes that need to authorize without a React context.
export async function getPermissionsFor(
  supabase: ReturnType<typeof createClient>,
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

  const anySupa = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => Promise<{ data: Array<Record<string, unknown>> | null }>
      }
    }
  }

  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    anySupa.from('role_permissions').select('permission_key').eq('role', role),
    anySupa.from('user_permission_overrides').select('permission_key, granted').eq('user_id', userId),
  ])

  const set = new Set<string>()
  for (const row of (rolePerms ?? [])) {
    const key = (row as { permission_key?: string }).permission_key
    if (key) set.add(key)
  }
  for (const row of (overrides ?? [])) {
    const r = row as { permission_key?: string; granted?: boolean }
    if (!r.permission_key) continue
    if (r.granted) set.add(r.permission_key)
    else set.delete(r.permission_key)
  }
  return set
}
