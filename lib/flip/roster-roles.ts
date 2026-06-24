// ─────────────────────────────────────────────────────────────
// FLIP roles-matrix scoping — which Glidepath app-roles appear in the
// FLIP role-assignment matrix (/flip/roles).
//
// Airfield-management leadership + admins only: Airfield Manager, NAMO,
// AMOPS, Base Admin, and System Admin — plus the civilian-mode parallels
// (Accountable Executive, Operations Supervisor) since FLIP is dual-mode.
// This is the set of roles that can hold flip:write / flip:manage by
// role (see migration 2026062304); read-only / CES / PPR / safety / ATC
// base members are NOT shown — they cannot act as a FLIP custodian/NAMO/AFM.
//
// Role lives on `profiles.role` (authoritative — base_members.role is
// stale). Mirrors lib/amtr/roster-roles.ts; independent of the per-record
// FLIP role layer in lib/flip/roles.ts (custodian / alternate / namo / afm).
// ─────────────────────────────────────────────────────────────

/** Glidepath app-roles whose users appear in the FLIP role-assignment matrix. */
export const FLIP_ELIGIBLE_ROLES = [
  'airfield_manager', 'namo', 'amops', 'base_admin', 'sys_admin',
  'accountable_executive', 'ops_supervisor',
] as const

/** True when a user's `profiles.role` qualifies them for the FLIP roles matrix. */
export function isFlipEligibleRole(role: string | null | undefined): boolean {
  return role != null && (FLIP_ELIGIBLE_ROLES as readonly string[]).includes(role)
}
