import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Authorize a PPR side-effect route (the outbound-email sends:
 * approval / denial / cancellation / update / coordination-request).
 *
 * SECURITY (H-1): these routes read the target `ppr_entries` row with the
 * service-role client (RLS-bypassing) so they can pull the entry right after
 * the triage/approve mutation lands. Because the service role bypasses RLS,
 * the permission + base-access checks the database would normally enforce on
 * a session client MUST be performed explicitly here. Without them, ANY
 * authenticated principal — a read-only user, or the shared kiosk account —
 * could POST an entryId and cause Glidepath to send "{Base} AMOPS" emails
 * (or, cross-tenant, for a guessed entry id of another base).
 *
 * Returns true only when the caller has access to `baseId` AND holds at least
 * one of `anyOf` permission keys. `anyOf` is the set of permissions that gate
 * the in-app action which precedes the email (e.g. a denial can be triggered
 * from the triage-Deny path — `ppr:triage` — or the post-coordination
 * decide-Deny path — `ppr:approve`), so a caller who could perform the action
 * is never blocked, while a same-base read-only account is.
 *
 * Pass a service-role client — the matrix RPCs mirror the airfield-status
 * route's pattern (`user_has_base_access` / `user_has_permission`).
 */
export async function callerCanActOnPpr(
  admin: SupabaseClient,
  userId: string,
  baseId: string,
  anyOf: readonly string[],
): Promise<boolean> {
  if (!userId || !baseId || anyOf.length === 0) return false

  const { data: hasBase } = await admin.rpc('user_has_base_access', {
    p_user_id: userId,
    p_base_id: baseId,
  })
  if (hasBase !== true) return false

  for (const key of anyOf) {
    const { data: ok } = await admin.rpc('user_has_permission', {
      p_user_id: userId,
      p_key: key,
    })
    if (ok === true) return true
  }
  return false
}

/**
 * Permission sets per PPR email route. Each set is the permission(s) that gate
 * the in-app action preceding that email, so authorization here never blocks a
 * user who could perform the action itself.
 */
export const PPR_EMAIL_PERMS = {
  approval: ['ppr:approve'],
  // Denial fires from triage-Deny (ppr:triage) or post-coord decide-Deny (ppr:approve).
  denial: ['ppr:triage', 'ppr:approve'],
  cancellation: ['ppr:write'],
  update: ['ppr:write'],
  coordinationRequest: ['ppr:triage'],
} as const
