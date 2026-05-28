import { describe, it, expect } from 'vitest'
import {
  transcribableSlots, jqsRequiresCertifier, selectableKeys, actionableRows,
  type TranscribeRow,
} from '@/lib/amtr/transcribe'
import type { AmtrRole } from '@/lib/supabase/amtr'
import type { SignSlot } from '@/lib/amtr/roles'

// ─── AMTR bulk-transcribe core guard ───
// Locks the form-agnostic rules that decide which rows a bulk transcribe will
// stamp. Authority/self-cert mirror the per-row Sign guards; certifier
// applicability mirrors the per-row rule. Transcription OVERRIDES existing
// initials, so (unlike a plain sign) already-signed rows are NOT skipped.

const JQS_SLOTS: SignSlot[] = ['trainee', 'trainer', 'certifier']

const rows: TranscribeRow[] = [
  { key: 'a', signRowId: 'pa', completed: true, certifierApplies: false }, // completed, no cert
  { key: 'b', signRowId: 'pb', completed: true, certifierApplies: true }, // completed, cert applies
  { key: 'c', signRowId: '', completed: false, certifierApplies: false }, // not completed
  { key: 'd', signRowId: 'pd', completed: true, certifierApplies: true }, // completed, cert applies (already signed in source)
]
const all = new Set(['a', 'b', 'c', 'd'])

describe('transcribableSlots', () => {
  it('intersects the form slots with signing authority (NAMT, other record)', () => {
    expect(transcribableSlots(['namt'] as AmtrRole[], false, JQS_SLOTS)).toEqual(['trainee', 'trainer', 'certifier'])
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

describe('jqsRequiresCertifier', () => {
  it('is true only when the Core/Cert column has a caret', () => {
    expect(jqsRequiresCertifier({ core_cert: '7^' })).toBe(true)
    expect(jqsRequiresCertifier({ core_cert: '^' })).toBe(true)
    expect(jqsRequiresCertifier({ core_cert: '5' })).toBe(false)
    expect(jqsRequiresCertifier({})).toBe(false)
  })
})

describe('selectableKeys', () => {
  it('returns completed rows only', () => {
    expect(selectableKeys(rows).sort()).toEqual(['a', 'b', 'd'])
  })
})

describe('actionableRows', () => {
  it('trainee: all completed selected rows (no completion date → excluded)', () => {
    expect(actionableRows(rows, all, 'trainee').map((r) => r.key).sort()).toEqual(['a', 'b', 'd'])
  })
  it('certifier: completed rows where the certifier column applies', () => {
    // b + d apply → in (override means d is NOT skipped despite being signed in
    // source); a has no cert column → out; c not completed → out.
    expect(actionableRows(rows, all, 'certifier').map((r) => r.key).sort()).toEqual(['b', 'd'])
  })
  it('respects the selection set and signRowId mapping', () => {
    const picked = actionableRows(rows, new Set(['b']), 'certifier')
    expect(picked.map((r) => r.signRowId)).toEqual(['pb'])
    expect(actionableRows(rows, new Set(['c']), 'trainee')).toEqual([])
  })
  it('does NOT skip rows already signed (override semantics)', () => {
    // A completed, already-signed row is still actionable — transcription
    // overwrites it. Excluding it would defeat the override requirement.
    expect(actionableRows(rows, new Set(['d']), 'certifier').map((r) => r.key)).toEqual(['d'])
  })
})
