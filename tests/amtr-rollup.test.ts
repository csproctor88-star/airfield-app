import { describe, it, expect } from 'vitest'
import { pct, buildMemberRollup, buildUnitKpis } from '@/lib/amtr/rollup'

describe('AMTR roll-up aggregation', () => {
  it('pct rounds and guards divide-by-zero', () => {
    expect(pct(3, 4)).toBe(75)
    expect(pct(0, 0)).toBe(0)
    expect(pct(1, 3)).toBe(33)
  })

  it('buildMemberRollup computes percentages', () => {
    const r = buildMemberRollup({
      memberId: 'm1', name: 'Doe, John', grade: 'SrA', status: 'Active',
      jqsRequired: 10, jqsDone: 5, formalRequired: 4, formalDone: 1,
      overdueCount: 2, dueSoonCount: 1, lastUpdated: '2026-05-01',
    })
    expect(r.jqsPct).toBe(50)
    expect(r.formalPct).toBe(25)
  })

  it('buildUnitKpis excludes RAT items for exempt members', () => {
    const today = new Date('2026-05-20T00:00:00Z')
    const members = [{ status: 'Active' }, { status: 'Contractor' }]
    const recurring = [
      { memberStatus: 'Active', isRat: false, dueDate: '2026-05-10' },        // overdue
      { memberStatus: 'Active', isRat: true, dueDate: '2026-06-10' },          // due_soon
      { memberStatus: 'Contractor', isRat: true, dueDate: '2026-05-10' },      // excluded (RAT exempt)
      { memberStatus: 'Active', isRat: false, completedDate: '2026-05-01' },   // complete
    ]
    const k = buildUnitKpis(members, recurring, today)
    expect(k.members).toBe(2)
    expect(k.requiredTasks).toBe(3) // contractor RAT excluded
    expect(k.overdue).toBe(1)
    expect(k.dueSoon).toBe(1)
    expect(k.complete).toBe(1)
  })
})
