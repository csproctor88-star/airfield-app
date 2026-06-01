// ─────────────────────────────────────────────────────────────
// AMTR roster scoping — which Glidepath app-roles get an Airfield
// Management Training Record auto-created when the roster syncs.
//
// Airfield-management personnel only: Airfield Manager, NAMO, Base
// Admin, and AMOPS. Read-only / CES / PPR / safety / ATC / kiosk base
// members are NOT auto-rostered (they can still be added manually).
//
// This is the airfield-management subset of the `amtr:view` holders
// (see migration 2026052400) — `amtr:view` additionally includes
// sys_admin, who can view and manage the program but is not an
// airfield-management trainee and so is not auto-rostered.
//
// Role lives on `profiles.role` (a single Glidepath app-role per user).
// This is independent of the per-record AMTR role layer in
// `lib/amtr/roles.ts` (trainee / trainer / certifier / namt / afm).
// ─────────────────────────────────────────────────────────────

/** Glidepath app-roles whose users get an auto-created training record. */
export const AMTR_ROSTER_ROLES = ['airfield_manager', 'namo', 'amops', 'base_admin'] as const

/** True when a user's `profiles.role` qualifies them for auto-rostering. */
export function isAmtrRosterRole(role: string | null | undefined): boolean {
  return role != null && (AMTR_ROSTER_ROLES as readonly string[]).includes(role)
}
