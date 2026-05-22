import { describe, it, expect } from 'vitest'
import { runInspectionScan, type InspectionScanData } from '@/lib/amtr/inspection-engine'

function baseData(over: Partial<InspectionScanData> = {}): InspectionScanData {
  return {
    member: { id: 'm1', user_id: 'u1', full_name: 'Doe, Jane', grade: 'SSgt', duty_position: 'AMOPS', dafsc: '1C751', tsc: 'A', status: 'Active' },
    roleAssignments: [],
    jqsCatalog: [], jqsProgress: [],
    r1098Catalog: [], r1098Progress: [],
    ratCatalog: [], ratProgress: [],
    e623a: [],
    items797: [],
    items803: [],
    milestoneCatalog: [],
    formalCatalog: [], formalProgress: [],
    ...over,
  }
}

describe('runInspectionScan', () => {
  it('member_identity: yes when all cover fields present, no when one missing', () => {
    expect(runInspectionScan(baseData()).member_identity.auto).toBe('yes')
    const missing = runInspectionScan(baseData({ member: { id: 'm1', full_name: 'Doe, Jane', grade: 'SSgt', duty_position: 'AMOPS', dafsc: '1C751', tsc: '', status: 'Active' } }))
    expect(missing.member_identity.auto).toBe('no')
    expect(missing.member_identity.findings[0]).toContain('TSC')
  })

  it('trainer/certifier_qualified: yes when the member holds the AMTR role, else na', () => {
    const r = runInspectionScan(baseData({ roleAssignments: [{ user_id: 'u1', role: 'trainer' }] }))
    expect(r.trainer_qualified.auto).toBe('yes')
    expect(r.certifier_qualified.auto).toBe('na')
  })

  it('623a_signed: na when no entries, no when missing required initials, yes when complete', () => {
    expect(runInspectionScan(baseData())['623a_signed'].auto).toBe('na')
    expect(runInspectionScan(baseData({ e623a: [{ id: 'e1', entry_type: 'Initial', trainee_initials: 'JD', trainer_initials: '' }] }))['623a_signed'].auto).toBe('no')
    expect(runInspectionScan(baseData({ e623a: [{ id: 'e1', entry_type: 'Initial', trainee_initials: 'JD', trainer_initials: 'AB' }] }))['623a_signed'].auto).toBe('yes')
  })

  it('jqs_core_signed: no when a core task is unsigned, yes when all signed, na when no core tasks', () => {
    expect(runInspectionScan(baseData()).jqs_core_signed.auto).toBe('na')
    const cat = [{ id: 'c1', kind: 'item', number: '7.1.1', core_cert: 'C' }]
    expect(runInspectionScan(baseData({ jqsCatalog: cat, jqsProgress: [{ catalog_id: 'c1', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: '' }] })).jqs_core_signed.auto).toBe('no')
    expect(runInspectionScan(baseData({ jqsCatalog: cat, jqsProgress: [{ catalog_id: 'c1', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: 'CC' }] })).jqs_core_signed.auto).toBe('yes')
  })

  it('1098_catalog_fields: no when a catalog row lacks score/type/frequency', () => {
    const full = [{ id: 'c1', task: 'Airfield Driving', score_or_hours: '1 Hr', type: 'Hands-On', frequency: 'Annual' }]
    expect(runInspectionScan(baseData({ r1098Catalog: full }))['1098_catalog_fields'].auto).toBe('yes')
    const noType = [{ id: 'c1', task: 'Airfield Driving', score_or_hours: '1 Hr', type: '', frequency: 'Annual' }]
    expect(runInspectionScan(baseData({ r1098Catalog: noType }))['1098_catalog_fields'].auto).toBe('no')
  })

  it('803_unsat_remarks: na when nothing unsat, no when an UNSAT row lacks remarks', () => {
    expect(runInspectionScan(baseData({ items803: [{ id: 'r1', results: 'SAT' }] }))['803_unsat_remarks'].auto).toBe('na')
    expect(runInspectionScan(baseData({ items803: [{ id: 'r1', sts_item: '7.5.1', results: 'UNSAT', remarks: '' }] }))['803_unsat_remarks'].auto).toBe('no')
    expect(runInspectionScan(baseData({ items803: [{ id: 'r1', results: 'UNSAT', remarks: 'retrain plan' }] }))['803_unsat_remarks'].auto).toBe('yes')
  })

  it('rat_dates: na for RAT-exempt members', () => {
    expect(runInspectionScan(baseData({ member: { id: 'm1', status: 'Civilian' } })).rat_dates.auto).toBe('na')
  })
})
