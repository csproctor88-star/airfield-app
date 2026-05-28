import { describe, it, expect } from 'vitest'
import {
  transcribableSlots, jqsRequiresCertifier, selectableCompletedItems, actionableForTranscribe,
} from '@/lib/amtr/transcribe'
import type { AmtrRole } from '@/lib/supabase/amtr'

// ─── AMTR bulk-transcribe eligibility guard ───
// Locks the rules that decide which JQS items a bulk transcribe will sign.
// These mirror the per-row Sign guards (authority, self-cert, per-block
// finality, certifier caret) so the bulk path can't sign something the
// single-row path would refuse.

type Row = Record<string, unknown>

const catalog: Row[] = [
  { id: 'sec1', kind: 'section', title: 'Admin' },
  { id: 'a', kind: 'item', core_cert: '5', title: 'Completed, no cert required' },
  { id: 'b', kind: 'item', core_cert: '7^', title: 'Completed, cert required' },
  { id: 'c', kind: 'item', core_cert: '', title: 'No completed date' },
  { id: 'd', kind: 'item', core_cert: '^', title: 'Completed, already certifier-signed' },
  { id: 'e', kind: 'item', core_cert: '5', retired: true, title: 'Retired' },
]
const progByCat = new Map<string, Row>([
  ['a', { id: 'pa', catalog_id: 'a', complete_date: '2024-01-01' }],
  ['b', { id: 'pb', catalog_id: 'b', complete_date: '2024-02-01' }],
  // c: no progress row at all
  ['d', { id: 'pd', catalog_id: 'd', complete_date: '2024-03-01', certifier_signed_by: 'user-1', certifier_initials: 'XX' }],
  ['e', { id: 'pe', catalog_id: 'e', complete_date: '2024-04-01' }],
])
const all = new Set(['a', 'b', 'c', 'd', 'e'])

describe('transcribableSlots', () => {
  it('offers all three OJT columns to NAMT on another record', () => {
    expect(transcribableSlots(['namt'] as AmtrRole[], false)).toEqual(['trainee', 'trainer', 'certifier'])
  })
  it('offers only Trainee on your own record (self-cert guard)', () => {
    expect(transcribableSlots(['namt', 'afm'] as AmtrRole[], true)).toEqual(['trainee'])
  })
  it('a trainer can only transcribe the Trainer column', () => {
    expect(transcribableSlots(['trainer'] as AmtrRole[], false)).toEqual(['trainer'])
  })
})

describe('jqsRequiresCertifier', () => {
  it('is true only when the Core/Cert column has a caret', () => {
    expect(jqsRequiresCertifier({ core_cert: '7^' })).toBe(true)
    expect(jqsRequiresCertifier({ core_cert: '^' })).toBe(true)
    expect(jqsRequiresCertifier({ core_cert: '5' })).toBe(false)
    expect(jqsRequiresCertifier({ core_cert: '' })).toBe(false)
    expect(jqsRequiresCertifier({})).toBe(false)
  })
})

describe('selectableCompletedItems', () => {
  it('returns completed, non-section, non-retired items only', () => {
    // a + b + d have complete dates; c has none; e is retired; sec1 is a section.
    expect(selectableCompletedItems(catalog, progByCat).sort()).toEqual(['a', 'b', 'd'])
  })
})

describe('actionableForTranscribe', () => {
  it('trainee: signs all completed selected items not yet trainee-signed', () => {
    expect(actionableForTranscribe(catalog, progByCat, all, 'trainee').sort()).toEqual(['a', 'b', 'd'])
  })
  it('certifier: only caret items, excluding already-certifier-signed', () => {
    // b is caret + unsigned → in; d is caret but already certifier-signed → out;
    // a is completed but no caret → out.
    expect(actionableForTranscribe(catalog, progByCat, all, 'certifier')).toEqual(['b'])
  })
  it('respects the selection set', () => {
    expect(actionableForTranscribe(catalog, progByCat, new Set(['a']), 'trainee')).toEqual(['a'])
    expect(actionableForTranscribe(catalog, progByCat, new Set(['c']), 'trainee')).toEqual([])
  })
  it('skips items already signed in the target slot', () => {
    const prog = new Map(progByCat)
    prog.set('a', { id: 'pa', catalog_id: 'a', complete_date: '2024-01-01', trainee_signed_by: 'u' })
    expect(actionableForTranscribe(catalog, prog, all, 'trainee').sort()).toEqual(['b', 'd'])
  })
})
