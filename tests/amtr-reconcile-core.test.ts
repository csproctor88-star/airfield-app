import { describe, it, expect } from 'vitest'
import { dueItemsForMember, traineeSignatureGaps } from '@/lib/amtr/inspection-engine'
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
  it('flags a started 797 item missing trainee initials', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainee_initials: '' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '797', itemId: 'a1', itemName: 'Taxi signals' },
    ])
  })

  it('does not flag a 797 item the trainee already signed', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainee_initials: 'RS' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([])
  })

  it('flags a manual 623A entry missing trainee initials but skips transcribed/source-linked', () => {
    const d = scan({
      e623a: [
        { id: 'e1', entry_type: 'Counseling', trainee_initials: '' },                 // flag
        { id: 'e2', entry_type: 'Old', trainee_initials: '', transcribed: true },      // skip (historical)
        { id: 'e3', entry_type: 'Auto', trainee_initials: '', source_table: 'amtr_1098_progress' }, // skip (source-linked)
      ],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '623a', itemId: 'e1', itemName: 'Counseling' },
    ])
  })

  it('flags a required JQS core task missing trainee initials, respecting skill level', () => {
    const d = scan({
      // Member is 5-level (attained skill_level qual).
      qualCatalog: [{ id: 'q5', category: 'skill_level', name: '1C751 Skill Level' }],
      qualProgress: [{ catalog_id: 'q5', attained: true }],
      jqsCatalog: [
        { id: 'j1', kind: 'task', required: true, core_cert: '5', number: '1.1' }, // 5-level → applies
        { id: 'j2', kind: 'task', required: true, core_cert: '7', number: '2.1' }, // 7-level → above skill, ignore
      ],
      jqsProgress: [],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: 'jqs', itemId: 'j1', itemName: '1.1' },
    ])
  })

  it('flags a completed-and-due 1098 row missing trainee initials, not a future-due one', () => {
    const d = scan({
      r1098Catalog: [{ id: 'c1', task: 'CPR' }, { id: 'c2', task: 'AED' }],
      r1098Progress: [
        { catalog_id: 'c1', start_date: '2025-01-01', last_completed: '2025-01-01', next_due: '2026-01-01', trainee_initials: '' }, // due → flag
        { catalog_id: 'c2', start_date: '2026-05-01', last_completed: '2026-05-01', next_due: '2027-05-01', trainee_initials: '' }, // future → skip
      ],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '1098', itemId: 'c1', itemName: 'CPR' },
    ])
  })

  it('returns no gaps for a fully-signed current member', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'X', start_date: '2026-05-01', trainee_initials: 'RS' }],
      e623a: [{ id: 'e1', entry_type: 'Y', trainee_initials: 'RS' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([])
  })
})
