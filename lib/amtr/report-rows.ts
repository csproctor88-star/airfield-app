// ─────────────────────────────────────────────────────────────
// AMTR dashboard report rows — pure functions, unit-tested.
// Turn member + progress + catalog (+ inspection) data into the
// row shapes the Overdue / Due Soon / Inspection Status widgets render.
// ─────────────────────────────────────────────────────────────

import { dueStatus, ratApplies, parseDate, daysBetween, type DueStatus } from './status'

export type AmtrMemberLite = { id: string; full_name: string; grade: string | null; status: string }
export type Prog1098Row = { member_id: string; catalog_id: string; next_due: string | null; last_completed: string | null }
export type ProgRatRow = { member_id: string; catalog_id: string; due: string | null; completed: string | null }
export type Catalog1098Row = { id: string; task: string }
export type CatalogRatRow = { id: string; course: string }

export type DueItemRow = {
  id: string                  // stable unique row id
  memberId: string
  memberName: string
  grade: string | null
  itemName: string
  type: '1098' | 'RAT'
  dueDate: string | null
  status: DueStatus
  daysUntilDue: number | null // due − today; negative = overdue
}

/** Every recurring 1098 + RAT item for the unit, classified and labeled.
 *  RAT items are skipped for RAT-exempt members; rows with an unknown member
 *  are dropped. Callers filter by `status` for the Overdue / Due Soon widgets. */
export function buildDueItemRows(
  members: AmtrMemberLite[],
  p1098: Prog1098Row[],
  pRat: ProgRatRow[],
  cat1098: Catalog1098Row[],
  catRat: CatalogRatRow[],
  today: Date = new Date(),
): DueItemRow[] {
  const memberById = new Map(members.map(m => [m.id, m]))
  const taskById = new Map(cat1098.map(c => [c.id, c.task]))
  const courseById = new Map(catRat.map(c => [c.id, c.course]))
  const todayUtc = parseDate(today.toISOString().slice(0, 10))!
  const daysUntil = (d: string | null): number | null => {
    const due = parseDate(d)
    return due ? daysBetween(todayUtc, due) : null
  }
  const rows: DueItemRow[] = []

  for (const r of p1098) {
    const m = memberById.get(r.member_id)
    if (!m) continue
    rows.push({
      id: `1098:${r.member_id}:${r.catalog_id}`,
      memberId: r.member_id, memberName: m.full_name, grade: m.grade,
      itemName: taskById.get(r.catalog_id) ?? '—',
      type: '1098', dueDate: r.next_due,
      status: dueStatus({ dueDate: r.next_due, completedDate: r.last_completed }, today),
      daysUntilDue: daysUntil(r.next_due),
    })
  }

  for (const r of pRat) {
    const m = memberById.get(r.member_id)
    if (!m) continue
    if (!ratApplies(m.status)) continue
    rows.push({
      id: `RAT:${r.member_id}:${r.catalog_id}`,
      memberId: r.member_id, memberName: m.full_name, grade: m.grade,
      itemName: courseById.get(r.catalog_id) ?? '—',
      type: 'RAT', dueDate: r.due,
      status: dueStatus({ dueDate: r.due, completedDate: r.completed }, today),
      daysUntilDue: daysUntil(r.due),
    })
  }

  return rows
}

export type AmtrInspectionLite = {
  member_id: string
  inspection_date: string
  status: 'draft' | 'completed'
  no_count: number
  gap_count: number
  completed_by_name: string | null
}

export type InspectionRow = {
  id: string
  memberId: string
  memberName: string
  grade: string | null
  lastDate: string | null
  result: 'clean' | 'findings' | 'none'
  findings: number
  inspector: string | null
}

/** One row per member: their latest COMPLETED monthly self-inspection (drafts
 *  ignored). Members with no completed inspection are `result: 'none'`. */
export function latestInspectionPerMember(
  members: AmtrMemberLite[],
  inspections: AmtrInspectionLite[],
): InspectionRow[] {
  const latest = new Map<string, AmtrInspectionLite>()
  for (const i of inspections) {
    if (i.status !== 'completed') continue
    const cur = latest.get(i.member_id)
    // YYYY-MM-DD strings compare lexicographically by date.
    if (!cur || i.inspection_date > cur.inspection_date) latest.set(i.member_id, i)
  }
  return members.map(m => {
    const insp = latest.get(m.id)
    const findings = insp ? insp.gap_count : 0
    return {
      id: m.id, // one row per member — member ID is the stable row key
      memberId: m.id, memberName: m.full_name, grade: m.grade,
      lastDate: insp?.inspection_date ?? null,
      result: !insp ? 'none' : findings > 0 ? 'findings' : 'clean',
      findings,
      inspector: insp?.completed_by_name ?? null,
    }
  })
}
