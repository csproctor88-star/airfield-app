// ─────────────────────────────────────────────────────────────
// AMTR — Bulk transcription core (pure, unit-tested).
//
// When transcribing an imported record, an operator selects the completed
// items on a form, picks one sign column, and bulk-signs it with a single
// initials value. Each sign reuses the audited amtr_sign RPC, so authority,
// the self-cert guard, per-block finality, and the audit log all carry over.
//
// This module is form-agnostic: every tab (JQS, 1098, 797, 803) reduces its
// rows to a `TranscribeRow` and the same logic decides what's selectable and
// what a given column will actually sign. The shared UI + apply loop live in
// components/amtr/transcribe-bar.tsx.
// ─────────────────────────────────────────────────────────────

import type { AmtrRole } from '@/lib/supabase/amtr'
import { canSignSlot, type SignSlot } from '@/lib/amtr/roles'

type Row = Record<string, unknown>

/** A form row reduced to what bulk transcription needs.
 *  - `key`         — selection key (catalog id for catalog-backed tabs like
 *    JQS/1098, row id for free-form tabs like 797/803).
 *  - `signRowId`   — id passed to amtr_transcribe. Always known for a completed
 *    row (the row already exists), which is the only kind we transcribe.
 *  - `completed`   — has the form's completion date (eligible to transcribe).
 *  - `certifierApplies` — whether the certifier column applies to this row
 *    (JQS caret / 797 requires_certifier / 1098 always). Irrelevant for forms
 *    without a certifier slot. */
export type TranscribeRow = {
  key: string
  signRowId: string
  completed: boolean
  certifierApplies: boolean
}

/** Columns the caller may bulk-transcribe: the form's slot set intersected
 * with their signing authority. On your own record this collapses to Trainee
 * only (self-cert guard), matching the per-row Sign rules. */
export function transcribableSlots(myRoles: Iterable<AmtrRole>, isOwn: boolean, slots: SignSlot[]): SignSlot[] {
  return slots.filter((s) => canSignSlot(myRoles, s, isOwn))
}

/** CFETP convention: a JQS task needs a separate certifier sign-off only when
 * its Core/Cert column carries a caret (e.g. '5^', '^'). */
export const jqsRequiresCertifier = (item: Row): boolean =>
  String(item.core_cert ?? '').includes('^')

/** Selection keys eligible for transcription (completed rows). Backs the
 * "Select all completed" action. */
export const selectableKeys = (rows: TranscribeRow[]): string[] =>
  rows.filter((r) => r.completed).map((r) => r.key)

/** Rows a bulk transcribe into `slot` will actually stamp: selected, completed,
 * and — for the certifier column — only where it applies. Transcription
 * OVERWRITES any existing initials, so already-signed rows are NOT skipped
 * (unlike a plain sign). The certifier-applicability check still mirrors the
 * per-row rule so the bulk path can't stamp a column the form doesn't carry. */
export function actionableRows(rows: TranscribeRow[], selected: Set<string>, slot: SignSlot): TranscribeRow[] {
  return rows.filter((r) =>
    selected.has(r.key) && r.completed &&
    (slot !== 'certifier' || r.certifierApplies))
}
