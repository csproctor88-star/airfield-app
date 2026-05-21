// ─────────────────────────────────────────────────────────────
// AMTR role layer — pure resolution logic, unit-tested.
//
// Separate from Glidepath app-permissions: app-perms (amtr:*) decide
// whether you can open the module at all; these AMTR roles decide
// what you can do INSIDE a record — record visibility and who may
// sign which slot.
//
// Signing authority is HIERARCHICAL (a higher role may sign the lower
// blocks too) and signatures lock PER BLOCK, not per record:
//   trainee   → trainee
//   trainer   → trainer
//   certifier → trainee, trainer, certifier
//   namt      → trainee, trainer, certifier, namt
//   afm       → every block
// On your OWN record you may only ever sign the Trainee block, no
// matter which roles you hold (self-certification guard).
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

/** Slots each held role is authorized to sign (hierarchical — higher roles
 * inherit the lower blocks). The `evaluator` slot (DAF 803) is granted to any
 * non-trainee role and handled separately in slotsUserCanSign. */
const SLOT_AUTHORITY: Record<AmtrRole, SignSlot[]> = {
  trainee: ['trainee'],
  trainer: ['trainer'],
  certifier: ['trainee', 'trainer', 'certifier'],
  namt: ['trainee', 'trainer', 'certifier', 'namt'],
  afm: ['trainee', 'trainer', 'certifier', 'namt', 'afm'],
}

/**
 * The full set of signature slots a user may fill on a record.
 * - Own record → only `trainee` (self-certification guard), always.
 * - Others' records → the union of the slots their held roles authorize,
 *   plus `evaluator` if they hold any non-trainee role.
 */
export function slotsUserCanSign(
  myRoles: Iterable<AmtrRole>,
  isOwnRecord: boolean,
): Set<SignSlot> {
  if (isOwnRecord) return new Set<SignSlot>(['trainee'])
  const roles = Array.from(myRoles)
  const out: SignSlot[] = []
  for (const r of roles) for (const s of SLOT_AUTHORITY[r] ?? []) out.push(s)
  if (roles.includes('trainer') || roles.includes('certifier') || roles.includes('namt') || roles.includes('afm')) {
    out.push('evaluator')
  }
  return new Set(out)
}

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
 * May `myRoles` sign `slot` on this record? Hierarchical authority — a
 * higher role may sign lower blocks too (see slotsUserCanSign). On your
 * own record only the Trainee block is signable. A single caller MAY sign
 * multiple blocks (e.g. a Certifier signing Trainee + Trainer + Certifier);
 * each block is independent and locks on its own once signed.
 */
export function canSignSlot(
  myRoles: Iterable<AmtrRole>,
  slot: SignSlot,
  isOwnRecord: boolean,
): boolean {
  return slotsUserCanSign(myRoles, isOwnRecord).has(slot)
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
