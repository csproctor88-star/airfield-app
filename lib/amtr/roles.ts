// ─────────────────────────────────────────────────────────────
// AMTR role layer — pure resolution logic, unit-tested.
//
// Separate from Glidepath app-permissions: app-perms (amtr:*) decide
// whether you can open the module at all; these AMTR roles decide
// what you can do INSIDE a record — record visibility, the
// one-signature-per-record rule, and who can sign which slot.
// ─────────────────────────────────────────────────────────────

import type { AmtrRole } from '@/lib/supabase/amtr'

/** Privilege order for non-trainee roles (afm highest). */
const NON_TRAINEE_PRIORITY: AmtrRole[] = ['afm', 'namt', 'certifier', 'trainer']

/** Display labels for AMTR roles (correct capitalization / acronyms). */
export const AMTR_ROLE_LABELS: Record<AmtrRole, string> = {
  trainee: 'Trainee', trainer: 'Trainer', certifier: 'Certifier', namt: 'NAMT', afm: 'AFM',
}

/**
 * May the caller enter data (dates, etc.) on a record? Supervisor-driven:
 * only non-trainee roles enter dates; the trainee self-initials only.
 * Pass the effective role for the record (see effectiveRoleForRecord).
 */
export function canEnterData(effectiveRole: AmtrRole | null): boolean {
  return effectiveRole !== null && effectiveRole !== 'trainee'
}

/** A signed item is locked once all required signatures are present. */
export function isRecordLocked(row: { locked_at?: string | null }): boolean {
  return !!row.locked_at
}

/** Roles allowed to reopen a locked record. */
export function canReopen(myRoles: Iterable<AmtrRole>): boolean {
  const roles = new Set(myRoles)
  return roles.has('namt') || roles.has('afm')
}

export type SignSlot = 'trainee' | 'trainer' | 'certifier' | 'namt' | 'afm' | 'evaluator'

/**
 * The effective AMTR role a user operates under when viewing a record.
 * - Viewing your OWN record → 'trainee' (regardless of other roles held).
 * - Viewing someone else's → your highest non-trainee role, or null.
 */
export function effectiveRoleForRecord(
  myRoles: Iterable<AmtrRole>,
  isOwnRecord: boolean,
): AmtrRole | null {
  const roles = new Set(myRoles)
  if (isOwnRecord) return roles.has('trainee') ? 'trainee' : 'trainee' // own record always trainee context
  for (const r of NON_TRAINEE_PRIORITY) if (roles.has(r)) return r
  return null
}

/**
 * Can this user even view the given record?
 * - Own record: yes (you can always see your own).
 * - Others' records: only if you hold a non-trainee role (trainer+).
 */
export function canViewRecord(myRoles: Iterable<AmtrRole>, isOwnRecord: boolean): boolean {
  if (isOwnRecord) return true
  const roles = new Set(myRoles)
  return NON_TRAINEE_PRIORITY.some((r) => roles.has(r))
}

/** Roles permitted to fill a given signature slot. */
export function rolesForSlot(slot: SignSlot): AmtrRole[] {
  if (slot === 'evaluator') return ['trainer', 'certifier', 'namt', 'afm']
  return [slot]
}

/**
 * May `myRoles` sign `slot`, given which slots the caller has ALREADY
 * signed on this record? Enforces:
 *   1. caller holds a role the slot accepts, AND
 *   2. one-signature-per-record — caller has not signed a slot mapping
 *      to a different role on this same record.
 */
export function canSignSlot(
  myRoles: Iterable<AmtrRole>,
  slot: SignSlot,
  alreadySignedSlots: readonly SignSlot[],
): boolean {
  const roles = new Set(myRoles)
  const accepted = rolesForSlot(slot)
  if (!accepted.some((r) => roles.has(r))) return false

  // One-signature-per-record: if the caller already owns a slot that
  // resolves to a different role, block this one.
  const thisRole = slotRole(slot)
  for (const signed of alreadySignedSlots) {
    if (slotRole(signed) !== thisRole) return false
  }
  return true
}

/** The canonical role a slot represents (evaluator collapses to 'certifier'-class). */
export function slotRole(slot: SignSlot): string {
  return slot === 'evaluator' ? 'evaluator' : slot
}

/** Past-tense verb for a sign-off notification, by signer role. */
export function signoffVerb(role: AmtrRole | 'evaluator'): string {
  switch (role) {
    case 'certifier': return 'certified'
    case 'trainer':   return 'signed off'
    case 'namt':      return 'reviewed'
    case 'afm':       return 'approved'
    case 'evaluator': return 'evaluated'
    default:          return 'signed'
  }
}
