// ─────────────────────────────────────────────────────────────
// AMTR reports roll-up aggregation — pure functions, unit-tested.
// Turns per-member progress into unit KPIs and per-member summaries.
// ─────────────────────────────────────────────────────────────

import { dueStatus, ratApplies, type DueStatus } from './status'

export type MemberRollup = {
  memberId: string
  name: string
  grade: string | null
  status: string
  jqsRequired: number
  jqsDone: number
  jqsPct: number
  formalRequired: number
  formalDone: number
  formalPct: number
  overdueCount: number
  dueSoonCount: number
  lastUpdated: string | null
}

export type UnitKpis = {
  members: number
  requiredTasks: number
  complete: number
  dueSoon: number
  overdue: number
}

export function pct(done: number, required: number): number {
  if (required <= 0) return 0
  return Math.round((done / required) * 100)
}

/** Build a member roll-up from already-fetched counts. */
export function buildMemberRollup(input: {
  memberId: string
  name: string
  grade: string | null
  status: string
  jqsRequired: number
  jqsDone: number
  formalRequired: number
  formalDone: number
  overdueCount: number
  dueSoonCount: number
  lastUpdated: string | null
}): MemberRollup {
  return {
    ...input,
    jqsPct: pct(input.jqsDone, input.jqsRequired),
    formalPct: pct(input.formalDone, input.formalRequired),
  }
}

/** Count due statuses across a set of recurring/RAT items for a member. */
export function countDueStatuses(
  items: { dueDate?: string | null; completedDate?: string | null }[],
  today: Date = new Date(),
): Record<DueStatus, number> {
  const counts: Record<DueStatus, number> = { complete: 0, due_soon: 0, overdue: 0, upcoming: 0 }
  for (const it of items) counts[dueStatus(it, today)] += 1
  return counts
}

export type ComplianceCounts = { required: number; complete: number; dueSoon: number; overdue: number; pct: number }

/**
 * Compliance counts for one recurring task across the unit: `required` is the
 * number of applicable members; each member's item (or absence of one) is
 * classified. Members with no progress row count toward required but not complete.
 */
export function complianceCounts(
  items: { dueDate?: string | null; completedDate?: string | null }[],
  required: number,
  today: Date = new Date(),
): ComplianceCounts {
  let complete = 0, dueSoon = 0, overdue = 0
  for (const it of items) {
    const s = dueStatus(it, today)
    if (s === 'complete') complete += 1
    else if (s === 'due_soon') dueSoon += 1
    else if (s === 'overdue') overdue += 1
  }
  return { required, complete, dueSoon, overdue, pct: required > 0 ? Math.round((complete / required) * 100) : 0 }
}

/** Roll member rollups + recurring-item statuses into unit KPIs. */
export function buildUnitKpis(
  members: { status: string }[],
  recurringItems: {
    memberStatus: string
    isRat: boolean
    dueDate?: string | null
    completedDate?: string | null
  }[],
  today: Date = new Date(),
): UnitKpis {
  let requiredTasks = 0, complete = 0, dueSoon = 0, overdue = 0
  for (const it of recurringItems) {
    // RAT items don't count for exempt members.
    if (it.isRat && !ratApplies(it.memberStatus)) continue
    requiredTasks += 1
    const s = dueStatus({ dueDate: it.dueDate, completedDate: it.completedDate }, today)
    if (s === 'complete') complete += 1
    else if (s === 'due_soon') dueSoon += 1
    else if (s === 'overdue') overdue += 1
  }
  return { members: members.length, requiredTasks, complete, dueSoon, overdue }
}
