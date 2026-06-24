// lib/flip/roles.ts
// Pure FLIP role + signature-sequence logic. No I/O. Mirrors the
// server-side checks in flip_sign_review (2026062307). Keep in sync.

export type FlipRole = 'custodian' | 'alternate' | 'namo' | 'afm'
export type FlipSignSlot = 'custodian' | 'namo' | 'afm'

export const FLIP_ROLES: FlipRole[] = ['custodian', 'alternate', 'namo', 'afm']

// USAF default labels. UI resolves NAMO/AFM dual-mode labels via airport-mode;
// these are the fallback/admin-matrix labels.
export const FLIP_ROLE_LABELS: Record<FlipRole, string> = {
  custodian: 'Primary FLIP Custodian',
  alternate: 'Alternate FLIP Custodian',
  namo: 'NAMO',
  afm: 'AFM',
}

export const SLOT_ORDER: FlipSignSlot[] = ['custodian', 'namo', 'afm']

export const SLOT_LABELS: Record<FlipSignSlot, string> = {
  custodian: 'FLIP Custodian',
  namo: 'NAMO',
  afm: 'AFM (Final Approval)',
}

export type SignoffState = {
  custodian_signed_at: string | null
  namo_signed_at: string | null
  afm_signed_at: string | null
}

/** Roles permitted to sign a given slot. */
export function rolesForSlot(slot: FlipSignSlot): FlipRole[] {
  switch (slot) {
    case 'custodian': return ['custodian', 'alternate']
    case 'namo': return ['namo']
    case 'afm': return ['afm']
  }
}

/** The next slot that must be signed in sequence, or null if fully signed. */
export function nextSlot(s: SignoffState): FlipSignSlot | null {
  if (!s.custodian_signed_at) return 'custodian'
  if (!s.namo_signed_at) return 'namo'
  if (!s.afm_signed_at) return 'afm'
  return null
}

/** True iff `myRoles` may sign `slot` right now: it is this slot's turn AND a role matches. */
export function canSignSlot(
  myRoles: Iterable<FlipRole>,
  slot: FlipSignSlot,
  state: SignoffState,
): boolean {
  if (nextSlot(state) !== slot) return false
  const allowed = rolesForSlot(slot)
  return Array.from(myRoles).some((r) => allowed.includes(r))
}
