import { describe, it, expect } from 'vitest'
import { dueItemsForMember, traineeSignatureGaps, trainerSignatureGaps } from '@/lib/amtr/inspection-engine'
import type { InspectionScanData } from '@/lib/amtr/inspection-engine'

type Row = Record<string, unknown>

// Build InspectionScanData with only the fields a test needs; everything else
// defaults to empty so the unused engine inputs don't matter here.
function scan(over: Partial<InspectionScanData>): InspectionScanData {
  return {
    member: { user_id: 'u1', status: 'Active' },
    roleAssignments: [],
    jqsCatalog: [], jqsProgress: [],
    r1098Catalog: [], r1098Progress: [],
    ratCatalog: [], ratProgress: [],
    e623a: [], items797: [], items803: [],
    milestoneCatalog: [], formalCatalog: [], formalProgress: [],
    qualCatalog: [], qualProgress: [],
    transcribedRowIds: [],
    today: '2026-06-04',
    ...over,
  } as InspectionScanData
}

describe('dueItemsForMember', () => {
  it('flags an overdue 1098 item', () => {
    const d = scan({
      r1098Catalog: [{ id: 'c1', task: 'CPR' }],
      r1098Progress: [{ catalog_id: 'c1', last_completed: '2025-01-01', next_due: '2026-01-01' }],
    })
    expect(dueItemsForMember(d)).toEqual([
      { tab: '1098', itemId: 'c1', itemName: 'CPR', dueISO: '2026-01-01' },
    ])
  })

  it('does not flag a 1098 item due far in the future', () => {
    const d = scan({
      r1098Catalog: [{ id: 'c1', task: 'CPR' }],
      r1098Progress: [{ catalog_id: 'c1', last_completed: '2026-05-01', next_due: '2027-05-01' }],
    })
    expect(dueItemsForMember(d)).toEqual([])
  })

  it('skips RAT for exempt member statuses (Contractor)', () => {
    const d = scan({
      member: { user_id: 'u1', status: 'Contractor' },
      ratCatalog: [{ id: 'r1', course: 'Active Threat' }],
      ratProgress: [{ catalog_id: 'r1', due: '2026-01-01' }],
    })
    expect(dueItemsForMember(d)).toEqual([])
  })

  it('flags an overdue RAT item for an Active member', () => {
    const d = scan({
      ratCatalog: [{ id: 'r1', course: 'Active Threat' }],
      ratProgress: [{ catalog_id: 'r1', due: '2026-01-01', completed: '2025-01-01' }],
    })
    expect(dueItemsForMember(d)).toEqual([
      { tab: 'rat', itemId: 'r1', itemName: 'Active Threat', dueISO: '2026-01-01' },
    ])
  })
})

describe('traineeSignatureGaps', () => {
  // The trainee only owes a signature once a trainer has signed + dated the
  // item but the trainee hasn't countersigned.

  it('flags a 797 item the trainer signed + dated but the trainee has not', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainer_initials: 'PG', trainee_initials: '' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '797', itemId: 'a1', itemName: 'Taxi signals' },
    ])
  })

  it('does not flag a 797 item the trainer has not signed yet (not yet trained)', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainer_initials: '', trainee_initials: '' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([])
  })

  it('does not flag a 797 item the trainee already signed', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainer_initials: 'PG', trainee_initials: 'RS' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([])
  })

  it('flags a trainer-signed 623A entry missing trainee initials but skips transcribed/source-linked', () => {
    const d = scan({
      e623a: [
        { id: 'e1', entry_type: 'Counseling', trainer_initials: 'PG', trainee_initials: '' },                 // flag
        { id: 'e2', entry_type: 'Old', trainer_initials: 'PG', trainee_initials: '', transcribed: true },      // skip (historical)
        { id: 'e3', entry_type: 'Auto', trainer_initials: 'PG', trainee_initials: '', source_table: 'amtr_1098_progress' }, // skip (source-linked)
        { id: 'e4', entry_type: 'Unsigned', trainer_initials: '', trainee_initials: '' },                      // skip (trainer hasn't signed)
      ],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '623a', itemId: 'e1', itemName: 'Counseling' },
    ])
  })

  it('flags a required JQS core task the trainer signed + dated, respecting skill level', () => {
    const d = scan({
      // Member is 5-level (attained skill_level qual).
      qualCatalog: [{ id: 'q5', category: 'skill_level', name: '1C751 Skill Level' }],
      qualProgress: [{ catalog_id: 'q5', attained: true }],
      jqsCatalog: [
        { id: 'j1', kind: 'task', required: true, core_cert: '5', number: '1.1' }, // 5-level → applies
        { id: 'j2', kind: 'task', required: true, core_cert: '7', number: '2.1' }, // 7-level → above skill, ignore
      ],
      jqsProgress: [
        { catalog_id: 'j1', start_date: '2026-05-01', trainer_initials: 'PG', trainee_initials: '' }, // trainer signed, trainee not → flag
      ],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: 'jqs', itemId: 'j1', itemName: '1.1' },
    ])
  })

  it('does not flag a JQS task with no progress row or no trainer signature (not yet trained)', () => {
    const base = {
      qualCatalog: [{ id: 'q5', category: 'skill_level', name: '1C751 Skill Level' }],
      qualProgress: [{ catalog_id: 'q5', attained: true }],
      jqsCatalog: [{ id: 'j1', kind: 'task', required: true, core_cert: '5', number: '1.1' }],
    }
    expect(traineeSignatureGaps(scan({ ...base, jqsProgress: [] }))).toEqual([]) // no progress
    expect(traineeSignatureGaps(scan({ ...base, jqsProgress: [{ catalog_id: 'j1', start_date: '2026-05-01', trainer_initials: '', trainee_initials: '' }] }))).toEqual([]) // trainer unsigned
  })

  it('flags any completed 1098 row the trainee has not signed, regardless of next-due; skips not-completed', () => {
    const d = scan({
      r1098Catalog: [{ id: 'c1', task: 'CPR' }, { id: 'c2', task: 'AED' }, { id: 'c3', task: 'OPSEC' }],
      r1098Progress: [
        { catalog_id: 'c1', start_date: '2025-01-01', last_completed: '2025-01-01', next_due: '2026-01-01', trainee_initials: '' }, // past-due, unsigned → flag
        { catalog_id: 'c2', start_date: '2026-05-01', last_completed: '2026-05-01', next_due: '2027-05-01', trainee_initials: '' }, // future-due, unsigned → flag (the fix)
        { catalog_id: 'c3', start_date: '2026-05-01', last_completed: null, trainee_initials: '' },                                 // not completed → skip
      ],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '1098', itemId: 'c1', itemName: 'CPR' },
      { tab: '1098', itemId: 'c2', itemName: 'AED' },
    ])
  })

  it('returns no gaps for a fully-signed current member', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'X', start_date: '2026-05-01', trainer_initials: 'PG', trainee_initials: 'RS' }],
      e623a: [{ id: 'e1', entry_type: 'Y', trainer_initials: 'PG', trainee_initials: 'RS' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([])
  })
})

describe('trainerSignatureGaps (supervisor owes the countersignature)', () => {
  it('flags a 797 item the trainee signed + dated but the trainer has not', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainee_initials: 'RS', trainer_initials: '' }],
    })
    expect(trainerSignatureGaps(d)).toEqual([
      { tab: '797', itemId: 'a1', itemName: 'Taxi signals' },
    ])
  })

  it('does not flag a 797 item the trainee has not signed yet (not the trainer turn)', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainee_initials: '', trainer_initials: '' }],
    })
    expect(trainerSignatureGaps(d)).toEqual([])
  })

  it('does not flag a 797 item the trainer already signed', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainee_initials: 'RS', trainer_initials: 'PG' }],
    })
    expect(trainerSignatureGaps(d)).toEqual([])
  })

  it('flags a 1098 row the trainee signed but the certifier has not, even when next-due is in the future', () => {
    const d = scan({
      r1098Catalog: [{ id: 'c1', task: 'CPR' }, { id: 'c2', task: 'OPSEC' }],
      r1098Progress: [
        { catalog_id: 'c1', start_date: '2025-01-01', last_completed: '2025-01-01', next_due: '2026-01-01', trainee_initials: 'RS', certifier_initials: '' }, // past-due
        { catalog_id: 'c2', start_date: '2026-06-02', last_completed: '2026-06-02', next_due: '2027-06-02', trainee_initials: 'PG', certifier_initials: '' }, // future-due → must still flag
      ],
    })
    expect(trainerSignatureGaps(d)).toEqual([
      { tab: '1098', itemId: 'c1', itemName: 'CPR' },
      { tab: '1098', itemId: 'c2', itemName: 'OPSEC' },
    ])
  })

  it('flags a trainee-signed 623A entry the trainer has not, skipping transcribed/source-linked', () => {
    const d = scan({
      e623a: [
        { id: 'e1', entry_type: 'Counseling', trainee_initials: 'RS', trainer_initials: '' },                 // flag
        { id: 'e2', entry_type: 'Old', trainee_initials: 'RS', trainer_initials: '', transcribed: true },      // skip
        { id: 'e3', entry_type: 'Auto', trainee_initials: 'RS', trainer_initials: '', source_table: 'amtr_797' }, // skip
      ],
    })
    expect(trainerSignatureGaps(d)).toEqual([
      { tab: '623a', itemId: 'e1', itemName: 'Counseling' },
    ])
  })

  it('returns no gaps when nothing awaits a supervisor signature', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'X', start_date: '2026-05-01', trainee_initials: 'RS', trainer_initials: 'PG' }],
    })
    expect(trainerSignatureGaps(d)).toEqual([])
  })
})
