// ─────────────────────────────────────────────────────────────
// AMTR — Bulk transcription helpers (pure, unit-tested).
//
// Phase 1: when transcribing an imported JQS/CFETP record, an operator
// selects the completed items and bulk-signs one OJT column (trainee /
// trainer / certifier) with a single initials value. Each sign reuses the
// audited amtr_sign RPC, so authority, the self-cert guard, per-block
// finality, and the audit log all carry over unchanged. This module just
// decides which catalog items are eligible / actionable; the actual signing
// happens in the JQS tab.
// ─────────────────────────────────────────────────────────────

import type { AmtrRole } from '@/lib/supabase/amtr'
import { canSignSlot, type SignSlot } from '@/lib/amtr/roles'

type Row = Record<string, unknown>

// The three JQS OJT sign columns, in display order.
export const TRANSCRIBE_SLOTS: SignSlot[] = ['trainee', 'trainer', 'certifier']

/** Columns the caller may bulk-transcribe on this record, in column order.
 * Mirrors the per-row Sign authority (canSignSlot) + self-cert guard, so on
 * your own record only the Trainee column is offered. */
export function transcribableSlots(myRoles: Iterable<AmtrRole>, isOwn: boolean): SignSlot[] {
  return TRANSCRIBE_SLOTS.filter((s) => canSignSlot(myRoles, s, isOwn))
}

/** CFETP convention: a task needs a separate certifier sign-off only when its
 * Core/Cert column carries a caret (e.g. '5^', '^'). Mirrors the per-row rule
 * that suppresses the Certifier Sign affordance on non-caret rows. */
export const jqsRequiresCertifier = (item: Row): boolean =>
  String(item.core_cert ?? '').includes('^')

/** A JQS item is eligible for transcription once its progress row carries a
 * completed date (the import sets this). Section rows never are. */
export const hasCompleteDate = (prog: Row | undefined): boolean =>
  !!prog && !!prog.complete_date

/** All non-section catalog item ids that are selectable for transcription
 * (have a completed date). Backs the "Select all completed" action. */
export function selectableCompletedItems(catalog: Row[], progByCat: Map<string, Row>): string[] {
  const out: string[] = []
  for (const c of catalog) {
    if (c.kind === 'section' || c.retired) continue
    if (hasCompleteDate(progByCat.get(String(c.id)))) out.push(String(c.id))
  }
  return out
}

/** Catalog item ids that will actually be signed for a bulk transcribe into
 * `slot`, given the current selection. An item is actionable when it is:
 *   - selected,
 *   - a non-section item with a completed date,
 *   - NOT already signed in `slot` (per-block finality — amtr_sign rejects it),
 *   - and, for the certifier slot, marked with the CFETP caret.
 * Slot authority is the caller's responsibility (see transcribableSlots). */
export function actionableForTranscribe(
  catalog: Row[],
  progByCat: Map<string, Row>,
  selected: Set<string>,
  slot: SignSlot,
): string[] {
  const out: string[] = []
  for (const c of catalog) {
    if (c.kind === 'section' || c.retired) continue
    const id = String(c.id)
    if (!selected.has(id)) continue
    const p = progByCat.get(id)
    if (!hasCompleteDate(p)) continue
    if (p?.[`${slot}_signed_by`]) continue
    if (slot === 'certifier' && !jqsRequiresCertifier(c)) continue
    out.push(id)
  }
  return out
}
