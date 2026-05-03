import type { QrcTemplate, QrcMonthlyReview } from '@/lib/supabase/types'

export const MONTHLY_REVIEW_DAYS = 30

export type MonthlyReviewState = 'never' | 'overdue' | 'updated' | 'current'

export interface MonthlyReviewStatus {
  state: MonthlyReviewState
  reviewedAt: string | null
  templateUpdatedSince: boolean
  /** Days since last review, or null if never reviewed. Useful for tooltips. */
  daysSinceReview: number | null
}

/**
 * Compute per-user monthly review status for a QRC template.
 *
 *   never     — user has never marked this QRC reviewed
 *   overdue   — last review > MONTHLY_REVIEW_DAYS ago
 *   updated   — template.updated_at > user's last review (template changed since)
 *   current   — reviewed within window AND no template changes since
 *
 * "updated" wins over "overdue" — if the template changed, that's the more
 * actionable signal regardless of staleness.
 */
export function getMonthlyReviewStatus(
  template: Pick<QrcTemplate, 'updated_at'>,
  latestReview: QrcMonthlyReview | null | undefined,
): MonthlyReviewStatus {
  if (!latestReview) {
    return { state: 'never', reviewedAt: null, templateUpdatedSince: false, daysSinceReview: null }
  }

  const reviewedAt = latestReview.reviewed_at
  const reviewedMs = new Date(reviewedAt).getTime()
  const daysSinceReview = Math.floor((Date.now() - reviewedMs) / 86400000)

  // Template edited since this user last reviewed?
  const templateUpdatedAt = template.updated_at ? new Date(template.updated_at).getTime() : 0
  const templateUpdatedSince = templateUpdatedAt > reviewedMs

  if (templateUpdatedSince) {
    return { state: 'updated', reviewedAt, templateUpdatedSince: true, daysSinceReview }
  }
  if (daysSinceReview > MONTHLY_REVIEW_DAYS) {
    return { state: 'overdue', reviewedAt, templateUpdatedSince: false, daysSinceReview }
  }
  return { state: 'current', reviewedAt, templateUpdatedSince: false, daysSinceReview }
}

/** Map state → on-screen label (matches PILL kinds in qrc/page.tsx). */
export const STATE_LABEL: Record<MonthlyReviewState, string> = {
  never: 'Never reviewed',
  overdue: 'Overdue',
  updated: 'Updated since review',
  current: 'Current',
}
