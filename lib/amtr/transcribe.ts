// ─────────────────────────────────────────────────────────────
// AMTR — Bulk transcription core (pure, unit-tested).
//
// When transcribing an imported record, an operator selects the completed
// items on a form, picks a column (Trainee / Trainer / Evaluator — NOT
// Certifier), and stamps it with a single initials value. Each stamp goes
// through the audited amtr_transcribe RPC, which overrides any existing
// initials, sets the completion date to today, clears the certifier column
// (certifier sign-offs aren't transcribed), and records who/when + audit.
//
// This module is form-agnostic: every tab (JQS, 1098, 797, 803) reduces its
// rows to a `TranscribeRow` and the same logic decides what's selectable and
// what a column will actually stamp. The shared UI + apply loop live in
// components/amtr/transcribe-bar.tsx.
// ─────────────────────────────────────────────────────────────

import type { AmtrRole } from '@/lib/supabase/amtr'
import { canSignSlot, type SignSlot } from '@/lib/amtr/roles'

/** A form row reduced to what bulk transcription needs.
 *  - `key`       — selection key (catalog id for catalog-backed tabs like
 *    JQS/1098, row id for free-form tabs like 797/803).
 *  - `signRowId` — id passed to amtr_transcribe. Always known for a completed
 *    row (the row already exists), which is the only kind we transcribe.
 *  - `completed` — has the form's completion date (eligible to transcribe). */
export type TranscribeRow = {
  key: string
  signRowId: string
  completed: boolean
}

/** Columns the caller may bulk-transcribe: the form's slot set intersected
 * with their signing authority. On your own record this collapses to Trainee
 * only (self-cert guard), matching the per-row Sign rules. Certifier is never
 * passed in (it isn't transcribed — it's cleared instead). */
export function transcribableSlots(myRoles: Iterable<AmtrRole>, isOwn: boolean, slots: SignSlot[]): SignSlot[] {
  return slots.filter((s) => canSignSlot(myRoles, s, isOwn))
}

/** Selection keys eligible for transcription (completed rows). Backs the
 * "Select all completed" action. */
export const selectableKeys = (rows: TranscribeRow[]): string[] =>
  rows.filter((r) => r.completed).map((r) => r.key)

/** Rows a bulk transcribe will actually stamp: selected and completed.
 * Transcription OVERWRITES any existing initials, so already-signed rows are
 * NOT skipped (unlike a plain sign), and the target column is always a
 * non-certifier slot, so there's no per-column applicability filter. */
export function actionableRows(rows: TranscribeRow[], selected: Set<string>): TranscribeRow[] {
  return rows.filter((r) => selected.has(r.key) && r.completed)
}
