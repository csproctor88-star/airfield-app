import { describe, it, expect } from 'vitest'
import { runInspectionScan, highestSkillLevel, type InspectionScanData } from '@/lib/amtr/inspection-engine'

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
    qualCatalog: [], qualProgress: [],
    transcribedRowIds: [],
    today: '2026-06-02',
    ...over,
  }
}

describe('runInspectionScan', () => {
  it('findings list every offending item (no "+N more" cap)', () => {
    // 9 unsigned core tasks → all 9 should be enumerated in the findings.
    const cat = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, kind: 'item', number: `7.1.${i}`, core_cert: 'C' }))
    const r = runInspectionScan(baseData({ jqsCatalog: cat, jqsProgress: [] }))
    expect(r.jqs_core_signed.auto).toBe('no')
    const text = r.jqs_core_signed.findings.join(' ')
    expect(text).not.toContain('more')
    for (let i = 0; i < 9; i++) expect(text).toContain(`7.1.${i}`)
  })

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

  it('highestSkillLevel: parses the highest attained 1C7X1 level, ignoring non-level quals', () => {
    const cat = [
      { id: 'q5', category: 'skill_level', name: '1C751 Skill Level' },
      { id: 'q7', category: 'skill_level', name: '1C771 Skill Level' },
      { id: 'tr', category: 'skill_level', name: 'Trainer' },
      { id: 'qtp', category: 'qtp', name: '7-level QTP' },
    ]
    expect(highestSkillLevel(cat, [{ catalog_id: 'q5', attained: true }])).toBe(5)
    expect(highestSkillLevel(cat, [{ catalog_id: 'q5', attained: true }, { catalog_id: 'q7', attained: true }])).toBe(7)
    expect(highestSkillLevel(cat, [{ catalog_id: 'q7', attained: false }])).toBe(null) // not attained
    expect(highestSkillLevel(cat, [{ catalog_id: 'tr', attained: true }])).toBe(null) // Trainer is not a skill level
    expect(highestSkillLevel(cat, [{ catalog_id: 'qtp', attained: true }])).toBe(null) // QTP category ignored
    expect(highestSkillLevel(cat, [])).toBe(null)
    // Custom "5-Skill Level" naming also parses.
    expect(highestSkillLevel([{ id: 'x', category: 'skill_level', name: '5-Skill Level' }], [{ catalog_id: 'x', attained: true }])).toBe(5)
  })

  it('jqs_core_signed: ignores core tasks above the member’s attained skill level', () => {
    const qualCatalog = [
      { id: 'q5', category: 'skill_level', name: '1C751 Skill Level' },
      { id: 'q7', category: 'skill_level', name: '1C771 Skill Level' },
    ]
    const qualProgress = [{ catalog_id: 'q5', attained: true }] // 5-level only
    // A 7-level core task left unsigned must NOT be flagged for a 5-level member.
    const sevenOnly = [{ id: 'c1', kind: 'item', number: '7.9.1', core_cert: '7' }]
    expect(runInspectionScan(baseData({ qualCatalog, qualProgress, jqsCatalog: sevenOnly, jqsProgress: [] })).jqs_core_signed.auto).toBe('na')
    // A 5-level core task IS expected → unsigned → 'no', and findings name only the 5-level task.
    const both = [...sevenOnly, { id: 'c2', kind: 'item', number: '5.1.1', core_cert: '5' }]
    const r = runInspectionScan(baseData({ qualCatalog, qualProgress, jqsCatalog: both, jqsProgress: [] }))
    expect(r.jqs_core_signed.auto).toBe('no')
    expect(r.jqs_core_signed.findings.join()).toContain('5.1.1')
    expect(r.jqs_core_signed.findings.join()).not.toContain('7.9.1')
  })

  it('jqs_core_signed: a 7-level member IS expected to have 7-level core tasks signed', () => {
    const qualCatalog = [{ id: 'q7', category: 'skill_level', name: '1C771 Skill Level' }]
    const qualProgress = [{ catalog_id: 'q7', attained: true }]
    const jqsCatalog = [{ id: 'c1', kind: 'item', number: '7.9.1', core_cert: '7' }]
    expect(runInspectionScan(baseData({ qualCatalog, qualProgress, jqsCatalog, jqsProgress: [] })).jqs_core_signed.auto).toBe('no')
  })

  it('jqs_core_signed: with no skill-level data, no level gate is applied (all core inspected)', () => {
    const jqsCatalog = [{ id: 'c1', kind: 'item', number: '7.9.1', core_cert: '7' }]
    expect(runInspectionScan(baseData({ jqsCatalog, jqsProgress: [] })).jqs_core_signed.auto).toBe('no')
  })

  it('jqs_core_signed: a transcribed caret task missing certifier is NOT flagged (certifier not transcribed)', () => {
    const jqsCatalog = [{ id: 'c1', kind: 'item', number: '7.1.1', core_cert: '5^' }]
    // trainee + trainer present, certifier blank (cleared by transcription)
    const jqsProgress = [{ id: 'p1', catalog_id: 'c1', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: '' }]
    // Not transcribed → caret task needs certifier → flagged.
    expect(runInspectionScan(baseData({ jqsCatalog, jqsProgress })).jqs_core_signed.auto).toBe('no')
    // Transcribed (audit row_id 'p1') → certifier waived → not flagged.
    expect(runInspectionScan(baseData({ jqsCatalog, jqsProgress, transcribedRowIds: ['p1'] })).jqs_core_signed.auto).toBe('yes')
  })

  it('jqs_dates_signed: a transcribed caret task missing certifier is NOT flagged', () => {
    const jqsCatalog = [{ id: 'c1', kind: 'item', number: '7.1.1', core_cert: '7^' }]
    const jqsProgress = [{ id: 'p1', catalog_id: 'c1', complete_date: '2026-01-01', trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: '' }]
    expect(runInspectionScan(baseData({ jqsCatalog, jqsProgress })).jqs_dates_signed.auto).toBe('no')
    expect(runInspectionScan(baseData({ jqsCatalog, jqsProgress, transcribedRowIds: ['p1'] })).jqs_dates_signed.auto).toBe('yes')
  })

  it('797_dates_initials: a transcribed certifier-required task missing certifier is NOT flagged', () => {
    const items797 = [{ id: 'r1', task: 'Drive', start_date: '2026-01-01', requires_certifier: true, trainee_initials: 'JD', trainer_initials: 'AB', certifier_initials: '' }]
    expect(runInspectionScan(baseData({ items797 }))['797_dates_initials'].auto).toBe('no')
    expect(runInspectionScan(baseData({ items797, transcribedRowIds: ['r1'] }))['797_dates_initials'].auto).toBe('yes')
  })

  it('1098_dates_signed: a transcribed completed item missing certifier is NOT flagged', () => {
    const r1098Progress = [{ id: 'p1', catalog_id: 'k1', start_date: '2026-01-01', last_completed: '2026-01-01', trainee_initials: 'JD', certifier_initials: '' }]
    expect(runInspectionScan(baseData({ r1098Progress }))['1098_dates_signed'].auto).toBe('no')
    expect(runInspectionScan(baseData({ r1098Progress, transcribedRowIds: ['p1'] }))['1098_dates_signed'].auto).toBe('yes')
  })

  it('1098_dates_signed: findings name the task, not the catalog id', () => {
    const r1098Catalog = [{ id: 'k1', task: 'Airfield Driving' }]
    const r1098Progress = [{ id: 'p1', catalog_id: 'k1', start_date: '2026-01-01', last_completed: '2026-01-01', trainee_initials: 'JD', certifier_initials: '' }]
    const r = runInspectionScan(baseData({ r1098Catalog, r1098Progress }))
    expect(r['1098_dates_signed'].auto).toBe('no')
    expect(r['1098_dates_signed'].findings.join()).toContain('Airfield Driving')
    expect(r['1098_dates_signed'].findings.join()).not.toContain('k1')
  })

  it('rat_dates: findings name the course, not the catalog id', () => {
    const ratCatalog = [{ id: 'rc1', course: 'Self Aid Buddy Care' }]
    const ratProgress = [{ id: 'rp1', catalog_id: 'rc1', completed: '', due: '' }]
    const r = runInspectionScan(baseData({ ratCatalog, ratProgress }))
    expect(r.rat_dates.auto).toBe('no')
    expect(r.rat_dates.findings.join()).toContain('Self Aid Buddy Care')
    expect(r.rat_dates.findings.join()).not.toContain('rc1')
  })

  it('1098_dates_signed: not-due items (missing start and/or completed date) are not evaluated', () => {
    // Future monthly proficiency test: a next_due but no dates/signatures → not flagged.
    expect(runInspectionScan(baseData({ r1098Progress: [{ id: 'p1', catalog_id: 'k1', next_due: '2027-07-01', trainee_initials: '', certifier_initials: '' }] }))['1098_dates_signed'].auto).toBe('na')
    // Completed date but no start date → not evaluated (needs BOTH dates).
    expect(runInspectionScan(baseData({ r1098Progress: [{ id: 'p1', catalog_id: 'k1', last_completed: '2026-01-01', trainee_initials: '', certifier_initials: '' }] }))['1098_dates_signed'].auto).toBe('na')
  })

  it('1098_dates_signed: a completed item that is not due again yet (future next_due) is not flagged', () => {
    // Completed this cycle, missing trainee signature, but next_due is in the future → current, not a gap.
    const future = [{ id: 'p1', catalog_id: 'k1', start_date: '2026-02-01', last_completed: '2026-02-01', next_due: '2027-02-01', trainee_initials: '', certifier_initials: 'PG' }]
    expect(runInspectionScan(baseData({ r1098Progress: future }))['1098_dates_signed'].auto).toBe('na')
    // Same item but past-due (next_due already passed) → evaluated → missing trainee → flagged.
    const due = [{ id: 'p1', catalog_id: 'k1', start_date: '2025-02-01', last_completed: '2025-02-01', next_due: '2026-02-01', trainee_initials: '', certifier_initials: 'PG' }]
    expect(runInspectionScan(baseData({ r1098Progress: due }))['1098_dates_signed'].auto).toBe('no')
  })

  it('monthly_inspection_done: yes when a Monthly Training Records Inspection 623A entry exists', () => {
    expect(runInspectionScan(baseData()).monthly_inspection_done.auto).toBe('no')
    const e623a = [{ id: 'e1', entry_type: 'Monthly Training Records Inspection' }]
    expect(runInspectionScan(baseData({ e623a })).monthly_inspection_done.auto).toBe('yes')
  })

  it('transcribed-completeness checks: na when nothing transcribed, else verify date + initials', () => {
    // Nothing transcribed → na on every form.
    const none = runInspectionScan(baseData({ items797: [{ id: 'r1', task: 'X', complete_date: '2026-01-01', trainee_initials: 'JD' }] }))
    expect(none['797_transcribed'].auto).toBe('na')
    // Transcribed 797 row with date + trainee initials → yes.
    expect(runInspectionScan(baseData({ items797: [{ id: 'r1', task: 'X', complete_date: '2026-01-01', trainee_initials: 'JD' }], transcribedRowIds: ['r1'] }))['797_transcribed'].auto).toBe('yes')
    // Transcribed 797 row missing initials → no.
    expect(runInspectionScan(baseData({ items797: [{ id: 'r1', task: 'X', complete_date: '2026-01-01', trainee_initials: '' }], transcribedRowIds: ['r1'] }))['797_transcribed'].auto).toBe('no')
    // JQS transcribed missing date → no.
    expect(runInspectionScan(baseData({ jqsCatalog: [{ id: 'c1', kind: 'item', number: '7.1.1' }], jqsProgress: [{ id: 'p1', catalog_id: 'c1', complete_date: '', trainee_initials: 'JD' }], transcribedRowIds: ['p1'] })).jqs_transcribed.auto).toBe('no')
    // 803 transcribed with eval date + evaluator → yes.
    expect(runInspectionScan(baseData({ items803: [{ id: 's1', sts_item: '7.5', eval_date: '2026-01-01', evaluator_initials: 'EV' }], transcribedRowIds: ['s1'] }))['803_transcribed'].auto).toBe('yes')
  })

  it('623a_signed: historical (transcribed) entries are ignored', () => {
    // A historical import: trainee/trainer blank, marked transcribed → not flagged.
    const historical = [{ id: 'e1', entry_type: 'Initial', transcribed: true, trainee_initials: '', trainer_initials: '' }]
    expect(runInspectionScan(baseData({ e623a: historical }))['623a_signed'].auto).toBe('na')
    // Same entry NOT marked historical → flagged for missing initials.
    const notMarked = [{ id: 'e1', entry_type: 'Initial', transcribed: false, trainee_initials: '', trainer_initials: '' }]
    expect(runInspectionScan(baseData({ e623a: notMarked }))['623a_signed'].auto).toBe('no')
    // Historical alongside a complete manual entry → grade only the manual one.
    const mixed = [...historical, { id: 'e2', entry_type: 'Initial', trainee_initials: 'JD', trainer_initials: 'AB' }]
    expect(runInspectionScan(baseData({ e623a: mixed }))['623a_signed'].auto).toBe('yes')
  })
})
