// Records Export — period resolution.
// All math is UTC + date-portion only ('YYYY-MM-DD'), so it is deterministic
// and timezone-independent. ISO date strings sort lexicographically, which we
// rely on for range comparisons.

export type PeriodKind = 'all_time' | 'range'

export interface ExportPeriod {
  kind: PeriodKind
  /** inclusive 'YYYY-MM-DD' — required when kind === 'range' */
  from?: string
  /** inclusive 'YYYY-MM-DD' — required when kind === 'range' */
  to?: string
}

export type QuickPeriod = 'this_month' | 'last_month' | 'this_quarter' | 'this_fy'

function ymd(year: number, monthIndex0: number, day: number): string {
  const m = String(monthIndex0 + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

/** Last calendar day of a given (year, 0-based month). */
function lastDayOfMonth(year: number, monthIndex0: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

/** Resolve a quick-pick into an inclusive {from, to} date window. */
export function resolveQuickPeriod(kind: QuickPeriod, now: Date): { from: string; to: string } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() // 0-based
  const d = now.getUTCDate()
  const today = ymd(y, m, d)

  switch (kind) {
    case 'this_month':
      return { from: ymd(y, m, 1), to: ymd(y, m, lastDayOfMonth(y, m)) }

    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      return { from: ymd(ly, lm, 1), to: ymd(ly, lm, lastDayOfMonth(ly, lm)) }
    }

    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3 // 0,3,6,9
      const qEnd = qStart + 2
      return { from: ymd(y, qStart, 1), to: ymd(y, qEnd, lastDayOfMonth(y, qEnd)) }
    }

    case 'this_fy': {
      // Federal FY runs Oct 1 (month index 9) through Sep 30.
      const fyStartYear = m >= 9 ? y : y - 1
      return { from: ymd(fyStartYear, 9, 1), to: today }
    }
  }
}

/** True if a record's date falls within the period (all_time always true). */
export function isInRange(dateIso: string | null | undefined, period: ExportPeriod): boolean {
  if (period.kind === 'all_time') return true
  if (!dateIso) return false
  const day = dateIso.slice(0, 10) // 'YYYY-MM-DD'
  if (period.from && day < period.from) return false
  if (period.to && day > period.to) return false
  return true
}
