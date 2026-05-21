// ─────────────────────────────────────────────────────────────
// AMTR currency / due-date engine — pure functions, unit-tested.
// Shared by the 1098, RAT, reports roll-up, and notification
// reconciliation. No I/O.
// ─────────────────────────────────────────────────────────────

export type DueStatus = 'complete' | 'due_soon' | 'overdue' | 'upcoming'

export type AmtrFrequency =
  | 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual'
  | 'Biennial' | 'Triennial' | 'As Required' | string

/** Days within which an item counts as "due soon". */
export const DUE_SOON_DAYS = 30

/** Statuses exempt from RAT requirements. */
export const RAT_EXEMPT_STATUSES = new Set(['Civilian', 'Contractor', 'Separated'])

/** Parse a YYYY-MM-DD (or ISO) date as a UTC calendar date, or null. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Whole days from `from` to `to` (positive if `to` is in the future). */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / 86_400_000)
}

/** Add a recurrence interval to a date, returning the next-due date. */
export function computeNextDue(
  lastCompleted: string | null | undefined,
  frequency: AmtrFrequency,
): string | null {
  const base = parseDate(lastCompleted)
  if (!base) return null
  const d = new Date(base)
  switch (frequency) {
    case 'Monthly':     d.setUTCMonth(d.getUTCMonth() + 1); break
    case 'Quarterly':   d.setUTCMonth(d.getUTCMonth() + 3); break
    case 'Semi-Annual': d.setUTCMonth(d.getUTCMonth() + 6); break
    case 'Annual':      d.setUTCFullYear(d.getUTCFullYear() + 1); break
    case 'Biennial':    d.setUTCFullYear(d.getUTCFullYear() + 2); break
    case 'Triennial':   d.setUTCFullYear(d.getUTCFullYear() + 3); break
    default: return null // 'As Required' / unknown — no computed due date
  }
  return d.toISOString().slice(0, 10)
}

/**
 * Status of a tracked item.
 * - complete: has a completion date and is not past its due date
 * - overdue: due date is before today
 * - due_soon: due within DUE_SOON_DAYS
 * - upcoming: due further out, or no due date
 */
export function dueStatus(
  opts: { dueDate?: string | null; completedDate?: string | null },
  today: Date = new Date(),
): DueStatus {
  const due = parseDate(opts.dueDate)
  const completed = parseDate(opts.completedDate)
  const todayUtc = parseDate(today.toISOString().slice(0, 10))!

  if (due) {
    const delta = daysBetween(todayUtc, due)
    if (delta < 0) {
      // Due date has passed. Satisfied only if the completion is on/after the
      // due date (a late completion that met the deadline). For recurring tasks
      // next_due = lastCompleted + interval, so lastCompleted is always before
      // next_due → such an item is correctly overdue once the date passes.
      return completed && daysBetween(due, completed) >= 0 ? 'complete' : 'overdue'
    }
    if (delta <= DUE_SOON_DAYS) return 'due_soon'
    return completed ? 'complete' : 'upcoming'
  }
  return completed ? 'complete' : 'upcoming'
}

export type StatusTone = 'ok' | 'warn' | 'bad' | 'neutral'

/** Map a due status to a Glidepath status tone for pill/progress coloring. */
export function statusTone(status: DueStatus): StatusTone {
  switch (status) {
    case 'complete': return 'ok'
    case 'due_soon': return 'warn'
    case 'overdue':  return 'bad'
    default:         return 'neutral'
  }
}

/** Compliance tone for an aggregate (overdue dominates due-soon dominates ok). */
export function complianceTone(overdue: number, dueSoon: number): StatusTone {
  if (overdue > 0) return 'bad'
  if (dueSoon > 0) return 'warn'
  return 'ok'
}

/** Whether RAT applies to a member of the given status. */
export function ratApplies(memberStatus: string): boolean {
  return !RAT_EXEMPT_STATUSES.has(memberStatus)
}
