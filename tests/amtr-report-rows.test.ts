import { describe, it, expect } from 'vitest'
import { buildDueItemRows, latestInspectionPerMember, buildProgressRows, buildTaskComplianceRows } from '@/lib/amtr/report-rows'
import type { MemberRollup, ComplianceCounts } from '@/lib/amtr/rollup'

const TODAY = new Date('2026-06-29T00:00:00Z')
const members = [
  { id: 'm1', full_name: 'Alpha, A', grade: 'MSgt', status: 'Active' },
  { id: 'm2', full_name: 'Bravo, B', grade: 'TSgt', status: 'Civilian' }, // RAT-exempt
]
const cat1098 = [{ id: 'c1', task: 'Self-Inspection Program' }]
const catRat = [{ id: 'r1', course: 'OPSEC Awareness' }]

describe('buildDueItemRows', () => {
  it('classifies overdue/due_soon and resolves the item label', () => {
    const p1098 = [
      { member_id: 'm1', catalog_id: 'c1', next_due: '2026-06-01', last_completed: '2025-06-01' }, // overdue
    ]
    const pRat = [
      { member_id: 'm1', catalog_id: 'r1', due: '2026-07-10', completed: null }, // due_soon (11d)
    ]
    const rows = buildDueItemRows(members, p1098, pRat, cat1098, catRat, TODAY)
    expect(rows).toHaveLength(2)
    const overdue = rows.find(r => r.type === '1098')!
    expect(overdue.itemName).toBe('Self-Inspection Program')
    expect(overdue.status).toBe('overdue')
    expect(overdue.daysUntilDue).toBeLessThan(0)
    expect(overdue.memberName).toBe('Alpha, A')
    const dueSoon = rows.find(r => r.type === 'RAT')!
    expect(dueSoon.status).toBe('due_soon')
    expect(dueSoon.daysUntilDue).toBe(11)
  })

  it('skips RAT items for RAT-exempt members', () => {
    const pRat = [{ member_id: 'm2', catalog_id: 'r1', due: '2026-06-01', completed: null }]
    const rows = buildDueItemRows(members, [], pRat, cat1098, catRat, TODAY)
    expect(rows).toHaveLength(0)
  })

  it('skips progress rows whose member is absent', () => {
    const p1098 = [{ member_id: 'ghost', catalog_id: 'c1', next_due: '2026-06-01', last_completed: null }]
    expect(buildDueItemRows(members, p1098, [], cat1098, catRat, TODAY)).toHaveLength(0)
  })

  it('uses em-dash fallback when catalog id is not found', () => {
    const p1098 = [{ member_id: 'm1', catalog_id: 'unknown', next_due: '2026-09-01', last_completed: null }]
    const rows = buildDueItemRows(members, p1098, [], cat1098, catRat, TODAY)
    expect(rows[0].itemName).toBe('—')
  })
})

describe('latestInspectionPerMember', () => {
  const inspections = [
    { member_id: 'm1', inspection_date: '2026-05-01', status: 'completed' as const, no_count: 1, gap_count: 1, completed_by_name: 'SSgt Cee' },
    { member_id: 'm1', inspection_date: '2026-06-15', status: 'completed' as const, no_count: 0, gap_count: 0, completed_by_name: 'SSgt Dee' },
    { member_id: 'm1', inspection_date: '2026-06-20', status: 'draft' as const, no_count: 5, gap_count: 5, completed_by_name: null },
  ]
  it('picks the latest COMPLETED inspection and computes result', () => {
    const rows = latestInspectionPerMember([members[0]], inspections)
    expect(rows).toHaveLength(1)
    expect(rows[0].lastDate).toBe('2026-06-15')   // ignores the later draft
    expect(rows[0].result).toBe('clean')           // gap_count === 0
    expect(rows[0].findings).toBe(0)
    expect(rows[0].inspector).toBe('SSgt Dee')
  })
  it('reports findings count when present', () => {
    const rows = latestInspectionPerMember([members[0]], [inspections[0]])
    expect(rows[0].result).toBe('findings')
    expect(rows[0].findings).toBe(1)
  })
  it('marks members with no completed inspection as none', () => {
    const rows = latestInspectionPerMember([members[1]], inspections)
    expect(rows[0].result).toBe('none')
    expect(rows[0].lastDate).toBeNull()
  })
})

const rollup = (over: Partial<MemberRollup>): MemberRollup => ({
  memberId: 'm1', name: 'Alpha, A', grade: 'MSgt', status: 'Active',
  jqsRequired: 10, jqsDone: 8, jqsPct: 80,
  formalRequired: 4, formalDone: 4, formalPct: 100,
  overdueCount: 0, dueSoonCount: 0, lastUpdated: '2026-06-01',
  ...over,
})

describe('buildProgressRows', () => {
  it('maps rollup fields and preserves member order', () => {
    const rollups: MemberRollup[] = [
      rollup({ memberId: 'm1', name: 'Alpha, A', grade: 'MSgt', jqsPct: 80, formalPct: 100, overdueCount: 2 }),
      rollup({ memberId: 'm2', name: 'Bravo, B', grade: null, jqsPct: 0, formalPct: 50, overdueCount: 0 }),
      rollup({ memberId: 'm3', name: 'Charlie, C', grade: 'SSgt', jqsPct: 45, formalPct: 0, overdueCount: 5 }),
    ]
    const rows = buildProgressRows(rollups)
    expect(rows).toHaveLength(3)
    expect(rows.map(r => r.memberId)).toEqual(['m1', 'm2', 'm3'])
    expect(rows[0]).toEqual({
      id: 'm1', memberId: 'm1', memberName: 'Alpha, A', grade: 'MSgt',
      jqsPct: 80, formalPct: 100, overdue: 2,
    })
    expect(rows[1]).toEqual({
      id: 'm2', memberId: 'm2', memberName: 'Bravo, B', grade: null,
      jqsPct: 0, formalPct: 50, overdue: 0,
    })
    expect(rows[2].memberName).toBe('Charlie, C')
    expect(rows[2].overdue).toBe(5)
  })

  it('returns [] for empty input', () => {
    expect(buildProgressRows([])).toEqual([])
  })
})

describe('buildTaskComplianceRows', () => {
  const cc = (over: Partial<ComplianceCounts>): ComplianceCounts => ({
    required: 10, complete: 7, dueSoon: 1, overdue: 2, pct: 70, ...over,
  })

  it('maps task + counts into report rows', () => {
    const tasks = [
      { id: 't1', name: 'Self-Inspection Program', freq: 'Monthly', counts: cc({ required: 10, complete: 7, pct: 70 }) },
      { id: 't2', name: 'OPSEC Awareness', freq: 'Annual', counts: cc({ required: 4, complete: 4, pct: 100 }) },
    ]
    const rows = buildTaskComplianceRows(tasks)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ id: 't1', name: 'Self-Inspection Program', freq: 'Monthly', current: 7, total: 10, pct: 70 })
    expect(rows[1]).toEqual({ id: 't2', name: 'OPSEC Awareness', freq: 'Annual', current: 4, total: 4, pct: 100 })
  })

  it('returns [] for empty input', () => {
    expect(buildTaskComplianceRows([])).toEqual([])
  })
})
