/**
 * Pure date math for the annual-review digest cron
 * (/api/annual-review-digest). Kept out of lib/supabase/* so the
 * server route can import without dragging the browser-flavored
 * Supabase client into the API bundle.
 *
 * Mirrors the in-app helpers in lib/supabase/aep.ts (nextAnnualReviewDue)
 * and lib/supabase/whmp.ts (nextWhmpReviewDue). The contract is:
 *   - anchor = last_reviewed_at ?? effective_date|performed_at
 *   - due    = anchor + 1 year (UTC date math, day truncated)
 *   - status amber when daysOut <= 60, overdue when daysOut < 0
 */

export type AnnualReviewStatus = 'overdue' | 'amber' | 'current' | 'never'

export const REVIEW_WARNING_WINDOW_DAYS = 60

/** Compute next review-due date from an ISO anchor (1 year later). */
export function nextAnnualReviewDate(anchorIso: string | null): Date | null {
  if (!anchorIso) return null
  const anchor = new Date(anchorIso)
  if (isNaN(anchor.getTime())) return null
  return new Date(Date.UTC(anchor.getUTCFullYear() + 1, anchor.getUTCMonth(), anchor.getUTCDate()))
}

/** Whole-day delta in UTC (target - now), truncated to midnight. */
export function annualReviewDaysOut(target: Date, now: Date): number {
  const t = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((t - n) / 86_400_000)
}

/** Classify a due date relative to the warning window. */
export function classifyAnnualReview(
  dueDate: Date | null,
  now: Date = new Date(),
): { status: AnnualReviewStatus; daysOut: number | null } {
  if (!dueDate) return { status: 'never', daysOut: null }
  const daysOut = annualReviewDaysOut(dueDate, now)
  if (daysOut < 0) return { status: 'overdue', daysOut }
  if (daysOut <= REVIEW_WARNING_WINDOW_DAYS) return { status: 'amber', daysOut }
  return { status: 'current', daysOut }
}
