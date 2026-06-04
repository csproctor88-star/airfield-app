// ─────────────────────────────────────────────────────────────
// AMTR notification message builders + firing helpers.
//
// Bodies/targets follow the Role Assignments doc exactly. Builders
// are pure; firing helpers persist via lib/supabase/amtr.
// ─────────────────────────────────────────────────────────────

import {
  createAmtrNotification, fetchAmtrRoleAssignments,
  type AmtrNotificationKind,
} from '@/lib/supabase/amtr'
import { signoffVerb } from './roles'
import type { AmtrRole } from '@/lib/supabase/amtr'

/** Format a date as "DD Month YYYY" (e.g. "30 November 2027"). */
export function formatDueLabel(dateISO: string): string {
  const d = new Date(dateISO.length <= 10 ? `${dateISO}T00:00:00Z` : dateISO)
  if (Number.isNaN(d.getTime())) return dateISO
  return `${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`
}

export type NotificationDraft = {
  kind: AmtrNotificationKind
  body: string
  target_tab: string
  target_item_id: string
  dedupe_key: string
}

export function buildTrainingDue(
  trainingName: string, dueISO: string, itemId: string, tab: string = '1098',
): NotificationDraft {
  return {
    kind: 'training_due',
    body: `${trainingName} due by ${formatDueLabel(dueISO)}.`,
    target_tab: tab,
    target_item_id: itemId,
    dedupe_key: `training_due:${tab}:${itemId}`,
  }
}

export function buildSignoff(
  signerName: string, signerRole: AmtrRole | 'evaluator', formLabel: string, itemRef: string, itemId: string, tab: string,
): NotificationDraft {
  return {
    kind: 'signoff',
    body: `${signerName} ${signoffVerb(signerRole)} ${formLabel} item ${itemRef}.`,
    target_tab: tab,
    target_item_id: itemId,
    dedupe_key: `signoff:${itemId}:${signerRole}`,
  }
}

export function buildEntry623a(entryType: string, itemId: string): NotificationDraft {
  return {
    kind: 'entry_623a',
    body: `Signature required – ${entryType} – 623A`,
    target_tab: '623a',
    target_item_id: itemId,
    dedupe_key: `entry_623a:${itemId}`,
  }
}

export function build797Added(trainerName: string, taskName: string, itemId: string): NotificationDraft {
  return {
    kind: 'item_797_added',
    body: `${trainerName} added 797 item – ${taskName} to your training record.`,
    target_tab: '797',
    target_item_id: itemId,
    dedupe_key: `item_797_added:${itemId}`,
  }
}

export function build797Signature(traineeName: string, taskName: string, itemId: string): NotificationDraft {
  return {
    kind: 'signature_797',
    body: `Signature requested – ${traineeName} – 797 item – ${taskName}.`,
    target_tab: '797',
    target_item_id: itemId,
    dedupe_key: `signature_797:${itemId}`,
  }
}

/** Trainee-owed signature on a form item (fired by the daily reconcile).
 *  formLabel is the human form name, e.g. "DAF 1098". */
export function buildSignatureRequired(
  formLabel: string, itemName: string, tab: string, itemId: string,
): NotificationDraft {
  return {
    kind: 'signature_required',
    body: `Signature required – ${formLabel} – ${itemName}`,
    target_tab: tab,
    target_item_id: itemId,
    dedupe_key: `signature_required:${tab}:${itemId}`,
  }
}

/** A supervisor owes a countersignature on an item the trainee already signed
 *  (fired by the daily reconcile, fanned to the base's signers). memberName
 *  identifies whose record it is. */
export function buildTrainerSignatureRequired(
  memberName: string, formLabel: string, itemName: string, tab: string, itemId: string,
): NotificationDraft {
  return {
    kind: 'trainer_signature_required',
    body: `${memberName} – ${formLabel} – ${itemName} awaiting a trainer signature`,
    target_tab: tab,
    target_item_id: itemId,
    dedupe_key: `trainer_signature_required:${tab}:${itemId}`,
  }
}

// ── Firing helpers (persist) ───────────────────────────────

/** Send a notification to a single recipient (the trainee). */
export async function fireToRecipient(
  baseId: string, recipientUserId: string | null, memberId: string, draft: NotificationDraft,
): Promise<void> {
  if (!recipientUserId) return // unlinked member — nobody to notify
  await createAmtrNotification({
    base_id: baseId,
    recipient_user_id: recipientUserId,
    member_id: memberId,
    ...draft,
  })
}

/**
 * Fan a due/overdue alert out to the member's whole training team: the
 * trainee (if linked) plus every Trainer / NAMT / AFM at the base. Each
 * recipient's dedupe_key is suffixed with their id so the upsert
 * (onConflict recipient_user_id,dedupe_key) is idempotent per person.
 */
export async function fireToTrainingTeam(
  baseId: string, memberId: string, traineeUserId: string | null, draft: NotificationDraft,
): Promise<void> {
  const assignments = await fetchAmtrRoleAssignments(baseId)
  const recipients = new Set(
    assignments.filter((a) => a.role === 'trainer' || a.role === 'namt' || a.role === 'afm').map((a) => a.user_id),
  )
  if (traineeUserId) recipients.add(traineeUserId)
  await Promise.all(Array.from(recipients).map((uid) =>
    createAmtrNotification({
      base_id: baseId,
      recipient_user_id: uid,
      member_id: memberId,
      ...draft,
      dedupe_key: `${draft.dedupe_key}:${uid}`,
    }),
  ))
}

/** Fan a notification out to every Trainer at the base (797 signature request). */
export async function fireToAllTrainers(
  baseId: string, memberId: string, draft: NotificationDraft, excludeUserId?: string,
): Promise<void> {
  const assignments = await fetchAmtrRoleAssignments(baseId)
  const trainerIds = Array.from(
    new Set(assignments.filter((a) => a.role === 'trainer').map((a) => a.user_id)),
  ).filter((id) => id !== excludeUserId)
  await Promise.all(trainerIds.map((uid) =>
    createAmtrNotification({
      base_id: baseId,
      recipient_user_id: uid,
      member_id: memberId,
      ...draft,
      dedupe_key: `${draft.dedupe_key}:${uid}`,
    }),
  ))
}
