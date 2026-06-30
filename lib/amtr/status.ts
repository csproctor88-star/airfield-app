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

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** Calendar month 1–12 parsed from a task label, or null when none present. */
export function parseTaskMonth(task: string | null | undefined): number | null {
  if (!task) return null
  const lower = task.toLowerCase()
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (new RegExp(`\\b${MONTH_NAMES[i]}\\b`).test(lower)) return i + 1
  }
  return null
}

/** Last calendar day of {year}-{month} (1-based) as YYYY-MM-DD. */
function monthEndIso(year: number, month: number): string {
  // Date.UTC month is 0-based; day 0 → last day of the prior 0-based month,
  // which is the last day of the 1-based `month`.
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

const YEAR_RECURRENCES = new Set(['Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'Triennial'])

/**
 * Whether a recurring catalog item's period has fully elapsed as of `today`
 * (YYYY-MM-DD) — i.e. we now *expect* a documented record. Monthly items use
 * their named month within `year_label`; other recognized recurrences use the
 * year. Items whose period can't be derived (renamed monthly rows, unknown /
 * As Required frequency) return true so the scan keeps a strict presence check.
 */
export function recurringPeriodElapsed(
  item: { task?: string | null; frequency?: string | null; year_label?: string | null },
  today: string,
): boolean {
  const year = Number(String(item.year_label ?? '').slice(0, 4)) || Number(today.slice(0, 4))
  const freq = item.frequency ?? ''
  if (freq === 'Monthly') {
    const month = parseTaskMonth(item.task)
    if (month == null) return true            // renamed row → strict fallback
    return monthEndIso(year, month) < today   // month fully elapsed
  }
  if (YEAR_RECURRENCES.has(freq)) {
    return `${year}-12-31` < today
  }
  return true                                 // unknown / As Required → strict
}

/**
 * Status of a tracked item.
 * - complete: has a completion date and is not past its due date
 * - overdue: due date is before today
 * - due_soon: due within DUE_SOON_DAYS and not yet completed for this cycle
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
    if (completed) return 'complete'   // current cycle satisfied; next due is in the future
    if (delta <= DUE_SOON_DAYS) return 'due_soon'
    return 'upcoming'
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
