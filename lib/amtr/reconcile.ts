// ─────────────────────────────────────────────────────────────
// Shared reconcile core: the notifications a single member's record
// currently owes. Used by BOTH the daily fleet cron and the on-sign
// per-member reconcile endpoint so the two can never drift.
// ─────────────────────────────────────────────────────────────

import {
  dueItemsForMember, traineeSignatureGaps, trainerSignatureGaps, type InspectionScanData,
} from './inspection-engine'
import { buildTrainingDue, buildSignatureRequired, buildTrainerSignatureRequired } from './notifications'

export type ReconcileNotif = {
  base_id: string
  recipient_user_id: string
  member_id: string
  kind: string
  body: string
  target_tab: string
  target_item_id: string
  dedupe_key: string
}

export const FORM_LABEL: Record<string, string> = {
  jqs: 'JQS-CFETP', '1098': 'DAF 1098', '797': 'DAF 797', '623a': 'DAF 623A',
}

/**
 * Every notification a member's record currently owes, plus the live-key set
 * (`${recipient}::${dedupe_key}`) used to resolve (delete) anything stale.
 *  - Trainee (the record's owner): due/overdue + items awaiting their signature.
 *  - Supervisors (signerUids): items awaiting a trainer/certifier countersignature.
 */
export function buildMemberNotifs(
  d: InspectionScanData, baseId: string, signerUids: string[],
): { notifs: ReconcileNotif[]; liveKeys: Set<string> } {
  const notifs: ReconcileNotif[] = []
  const liveKeys = new Set<string>()
  const m = d.member
  const memberId = String(m.id)
  const traineeUid = m.user_id ? String(m.user_id) : null

  if (traineeUid) {
    for (const item of dueItemsForMember(d)) {
      const draft = buildTrainingDue(item.itemName, item.dueISO, item.itemId, item.tab)
      const dedupe_key = `${draft.dedupe_key}:${traineeUid}`
      liveKeys.add(`${traineeUid}::${dedupe_key}`)
      notifs.push({ base_id: baseId, recipient_user_id: traineeUid, member_id: memberId, kind: draft.kind, body: draft.body, target_tab: draft.target_tab, target_item_id: draft.target_item_id, dedupe_key })
    }
    for (const gap of traineeSignatureGaps(d)) {
      const draft = buildSignatureRequired(FORM_LABEL[gap.tab] ?? gap.tab, gap.itemName, gap.tab, gap.itemId)
      liveKeys.add(`${traineeUid}::${draft.dedupe_key}`)
      notifs.push({ base_id: baseId, recipient_user_id: traineeUid, member_id: memberId, kind: draft.kind, body: draft.body, target_tab: draft.target_tab, target_item_id: draft.target_item_id, dedupe_key: draft.dedupe_key })
    }
  }

  const memberName = String(m.full_name ?? 'Member')
  for (const gap of trainerSignatureGaps(d)) {
    const draft = buildTrainerSignatureRequired(memberName, FORM_LABEL[gap.tab] ?? gap.tab, gap.itemName, gap.tab, gap.itemId)
    for (const uid of signerUids) {
      const dedupe_key = `${draft.dedupe_key}:${uid}`
      liveKeys.add(`${uid}::${dedupe_key}`)
      notifs.push({ base_id: baseId, recipient_user_id: uid, member_id: memberId, kind: draft.kind, body: draft.body, target_tab: draft.target_tab, target_item_id: draft.target_item_id, dedupe_key })
    }
  }

  return { notifs, liveKeys }
}

/** Supervisor user-ids who can countersign — recipients of trainer_signature_required. */
export function signerUidsFromRoles(roleAssignments: { user_id: string; role: string }[]): string[] {
  return Array.from(new Set(
    roleAssignments
      .filter((a) => a.role === 'trainer' || a.role === 'certifier' || a.role === 'namt' || a.role === 'afm')
      .map((a) => a.user_id),
  ))
}
