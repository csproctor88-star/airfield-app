import { describe, it, expect } from 'vitest'
import {
  transcribableSlots, selectableKeys, actionableRows, type TranscribeRow,
} from '@/lib/amtr/transcribe'
import type { AmtrRole } from '@/lib/supabase/amtr'
import type { SignSlot } from '@/lib/amtr/roles'

// ─── AMTR bulk-transcribe core guard ───
// Locks the form-agnostic rules that decide which rows a bulk transcribe will
// stamp. Authority/self-cert mirror the per-row Sign guards. Certifier is NOT
// a transcribe column (it's cleared instead), so the JQS/797 slot sets are
// Trainee + Trainer only. Transcription OVERRIDES existing initials, so
// already-signed rows are NOT skipped.

// Transcribe slot sets exclude certifier (it isn't transcribed).
const JQS_SLOTS: SignSlot[] = ['trainee', 'trainer']

const rows: TranscribeRow[] = [
  { key: 'a', signRowId: 'pa', completed: true },
  { key: 'b', signRowId: 'pb', completed: true },
  { key: 'c', signRowId: '', completed: false }, // not completed
  { key: 'd', signRowId: 'pd', completed: true }, // completed (already signed in source)
]
const all = new Set(['a', 'b', 'c', 'd'])

describe('transcribableSlots', () => {
  it('offers Trainee + Trainer (no Certifier) to NAMT on another record', () => {
    expect(transcribableSlots(['namt'] as AmtrRole[], false, JQS_SLOTS)).toEqual(['trainee', 'trainer'])
  })
  it('never includes certifier — it is excluded from the transcribe slot set', () => {
    expect(JQS_SLOTS).not.toContain('certifier')
  })
  it('own record collapses to Trainee only (self-cert guard)', () => {
    expect(transcribableSlots(['namt', 'afm'] as AmtrRole[], true, JQS_SLOTS)).toEqual(['trainee'])
  })
  it('a trainer can only transcribe the Trainer column', () => {
    expect(transcribableSlots(['trainer'] as AmtrRole[], false, JQS_SLOTS)).toEqual(['trainer'])
  })
  it('803 evaluator: allowed on another record, blocked on your own', () => {
    expect(transcribableSlots(['namt'] as AmtrRole[], false, ['evaluator'])).toEqual(['evaluator'])
    expect(transcribableSlots(['namt'] as AmtrRole[], true, ['evaluator'])).toEqual([])
  })
})

describe('selectableKeys', () => {
  it('returns completed rows only', () => {
    expect(selectableKeys(rows).sort()).toEqual(['a', 'b', 'd'])
  })
})

describe('actionableRows', () => {
  it('stamps all completed selected rows (no completion date → excluded)', () => {
    expect(actionableRows(rows, all).map((r) => r.key).sort()).toEqual(['a', 'b', 'd'])
  })
  it('respects the selection set and maps to signRowId', () => {
    expect(actionableRows(rows, new Set(['b'])).map((r) => r.signRowId)).toEqual(['pb'])
    expect(actionableRows(rows, new Set(['c']))).toEqual([])
  })
  it('does NOT skip rows already signed (override semantics)', () => {
    // 'd' represents a row signed in the source record — still actionable,
    // transcription overwrites it. Excluding it would defeat the override.
    expect(actionableRows(rows, new Set(['d'])).map((r) => r.key)).toEqual(['d'])
  })
})
