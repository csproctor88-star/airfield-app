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

  it('623a_signed: na when no entries, no when a manual entry lacks required initials, yes when complete', () => {
    expect(runInspectionScan(baseData())['623a_signed'].auto).toBe('na')
    expect(runInspectionScan(baseData({ e623a: [{ id: 'e1', entry_type: 'Initial', trainee_initials: 'JD', trainer_initials: '' }] }))['623a_signed'].auto).toBe('no')
    expect(runInspectionScan(baseData({ e623a: [{ id: 'e1', entry_type: 'Initial', trainee_initials: 'JD', trainer_initials: 'AB' }] }))['623a_signed'].auto).toBe('yes')
  })

  it('623a_signed: ignores source-linked auto-entries (certification records have no trainer slot)', () => {
    // An auto-623A created when a 1098 certifier signs: trainee + namt, no trainer.
    // It must NOT be graded by the trainee+trainer rule — only manual entries are.
    const sourceLinked = [{ id: 'e1', source_table: 'amtr_1098_progress', source_row_id: 'p1', trainee_initials: 'JD', namt_initials: 'CC', trainer_initials: '' }]
    expect(runInspectionScan(baseData({ e623a: sourceLinked }))['623a_signed'].auto).toBe('na')
    // A source-linked entry alongside a complete manual entry → grade only the manual one.
    const mixed = [...sourceLinked, { id: 'e2', entry_type: 'Initial', trainee_initials: 'JD', trainer_initials: 'AB' }]
    expect(runInspectionScan(baseData({ e623a: mixed }))['623a_signed'].auto).toBe('yes')
  })

  it('jqs_core_signed: certifier required only on caret (^) tasks per the CFETP convention', () => {
    expect(runInspectionScan(baseData()).jqs_core_signed.auto).toBe('na')
    // Non-caret core task: trainee + trainer is sufficient, empty certifier is fine.
    const plain = [{ id: 'c1', kind: 'item', number: '7.1.1', core_cert: 'C' }]
    expect(runInspectionScan(baseData({ jqsCatalog: plain, jqsProgress: [{ catalog_id: 'c1', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: '' }] })).jqs_core_signed.auto).toBe('yes')
    // Caret core task: certifier IS required.
    const caret = [{ id: 'c1', kind: 'item', number: '7.1.1', core_cert: '7^' }]
    expect(runInspectionScan(baseData({ jqsCatalog: caret, jqsProgress: [{ catalog_id: 'c1', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: '' }] })).jqs_core_signed.auto).toBe('no')
    expect(runInspectionScan(baseData({ jqsCatalog: caret, jqsProgress: [{ catalog_id: 'c1', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: 'CC' }] })).jqs_core_signed.auto).toBe('yes')
  })

  it('jqs_dates_signed: certifier required only on caret (^) tasks', () => {
    const plain = [{ id: 'c1', kind: 'item', number: '7.1.1', core_cert: 'C' }]
    expect(runInspectionScan(baseData({ jqsCatalog: plain, jqsProgress: [{ catalog_id: 'c1', complete_date: '2026-01-01', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: '' }] })).jqs_dates_signed.auto).toBe('yes')
    const caret = [{ id: 'c1', kind: 'item', number: '7.1.1', core_cert: '5^' }]
    expect(runInspectionScan(baseData({ jqsCatalog: caret, jqsProgress: [{ catalog_id: 'c1', complete_date: '2026-01-01', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: '' }] })).jqs_dates_signed.auto).toBe('no')
  })

  it('retired catalog rows are excluded from catalog-driven checks', () => {
    // jqs_core_signed: a retired caret core task with no signatures must not flag.
    const jqsCat = [
      { id: 'c1', kind: 'item', number: '7.1.1', core_cert: '7^' },
      { id: 'c2', kind: 'item', number: '7.1.2', core_cert: '7^', retired: true },
    ]
    const jqsProgress = [{ catalog_id: 'c1', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: 'CC' }]
    expect(runInspectionScan(baseData({ jqsCatalog: jqsCat, jqsProgress })).jqs_core_signed.auto).toBe('yes')
    // 1098_all_documented: a retired requirement with no progress row must not flag.
    const r1098Catalog = [
      { id: 'k1', task: 'Airfield Driving' },
      { id: 'k2', task: 'Retired Task', retired: true },
    ]
    const r1098Progress = [{ catalog_id: 'k1', last_completed: '2026-01-01', trainee_initials: 'JD', certifier_initials: 'CC' }]
    expect(runInspectionScan(baseData({ r1098Catalog, r1098Progress }))['1098_all_documented'].auto).toBe('yes')
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
