import type { LocalRegulationRow, LocalRegReviewRow, LocalRegReviewer } from '@/lib/supabase/local-regulations'

// ─────────────────────────────────────────────────────────────
// Local Regulations (Base Regs) — pure review-status helpers.
//
// Generalized from lib/qrc/monthly-review-status.ts (per-user recurring
// review state) crossed with lib/supabase/read-files.ts's version-bump
// semantics (computeUnacknowledged / partitionReviewers). All inputs are
// Pick<>-narrowed row shapes so these helpers unit-test without any DB
// round-trip or generated Database types (the local_regulations* tables
// are staged-only migrations, not yet in lib/supabase/types.ts).
//
// Day-based windows (30/90), not calendar month/quarter — exact QRC
// parity by design (spec: "Day-based windows vs calendar month/quarter").
// If the owner wants calendar-period semantics instead, this is the one
// place to change it.
// ─────────────────────────────────────────────────────────────

export const INTERVAL_DAYS = { monthly: 30, quarterly: 90 } as const
export type RegReviewInterval = keyof typeof INTERVAL_DAYS
export type RegReviewState = 'never' | 'overdue' | 'updated' | 'current'

export interface RegReviewStatus {
  state: RegReviewState
  reviewedAt: string | null
  /** Days since last review, or null if never reviewed. Useful for tooltips. */
  daysSinceReview: number | null
}

/**
 * Compute one user's review status for one local regulation.
 *
 *   never   — no review row from this user for this document.
 *   updated — the document's live `version` is newer than the version the
 *             user reviewed (a manager replaced the PDF since). Re-upload
 *             resets the cycle — this wins over overdue even if the user
 *             reviewed yesterday.
 *   overdue — daysSinceReview > INTERVAL_DAYS[review_interval] (30 / 90,
 *             day-based — strict `>`, so exactly 30/90 days is `current`
 *             and 31/91 is `overdue`, matching QRC).
 *   current — otherwise.
 */
export function getRegReviewStatus(
  reg: Pick<LocalRegulationRow, 'version' | 'review_interval'>,
  latestReview: Pick<LocalRegReviewRow, 'reviewed_at' | 'version_at_review'> | null | undefined,
  now: Date = new Date(),
): RegReviewStatus {
  if (!latestReview) {
    return { state: 'never', reviewedAt: null, daysSinceReview: null }
  }

  const reviewedAt = latestReview.reviewed_at
  const reviewedMs = new Date(reviewedAt).getTime()
  const daysSinceReview = Math.floor((now.getTime() - reviewedMs) / 86400000)

  // Doc replaced since this user's last review? Wins over overdue.
  if (reg.version > latestReview.version_at_review) {
    return { state: 'updated', reviewedAt, daysSinceReview }
  }
  if (daysSinceReview > INTERVAL_DAYS[reg.review_interval]) {
    return { state: 'overdue', reviewedAt, daysSinceReview }
  }
  return { state: 'current', reviewedAt, daysSinceReview }
}

/** Latest row per grouping key, by `reviewed_at` (robust to unsorted input). */
function latestByKey<T extends { reviewed_at: string }>(
  rows: T[],
  keyOf: (row: T) => string,
): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    const existing = map.get(key)
    if (!existing || new Date(row.reviewed_at).getTime() > new Date(existing.reviewed_at).getTime()) {
      map.set(key, row)
    }
  }
  return map
}

/**
 * IDs of active (non-archived) regs whose status for this user is
 * never | updated | overdue. Drives the badge + the Base Regs tab count.
 *
 * `myReviews` is the user's full review history (all regs, all versions,
 * not pre-reduced) — this function reduces to the latest review per reg
 * itself, so callers don't have to.
 */
export function computeDueRegIds(
  regs: Pick<LocalRegulationRow, 'id' | 'version' | 'review_interval' | 'is_archived'>[],
  myReviews: Pick<LocalRegReviewRow, 'regulation_id' | 'reviewed_at' | 'version_at_review'>[],
  now: Date = new Date(),
): string[] {
  const latestByReg = latestByKey(myReviews, (r) => r.regulation_id)
  const due: string[] = []
  for (const reg of regs) {
    if (reg.is_archived) continue
    const latest = latestByReg.get(reg.id) ?? null
    const { state } = getRegReviewStatus(reg, latest, now)
    if (state !== 'current') due.push(reg.id)
  }
  return due
}

export interface CompliancePartition {
  /** user_id -> { reviewed_at, initials } for the current cycle. */
  reviewed: Map<string, { reviewed_at: string; initials: string | null }>
  /** user_ids from the roster with no current-cycle review. */
  outstanding: string[]
}

/**
 * Roster partition for one reg's current cycle — powers the per-doc
 * "Reviewed X/Y this cycle" chip, the Compliance expandable, and the PDF.
 *
 * A roster member whose latest review is stale (old version, or past the
 * interval window) counts as outstanding, even though they reviewed at
 * some point — the review just isn't current anymore.
 *
 * A reviewer NOT in the roster (e.g. holds local_regs:view via a per-user
 * permission override) folds into `reviewed` defensively — the same
 * "don't lose the data, but don't let it drive the denominator" pattern
 * the Read File compliance report uses — and never appears in
 * `outstanding` or inflates the roster.
 */
export function partitionCompliance(
  reg: Pick<LocalRegulationRow, 'version' | 'review_interval'>,
  roster: Pick<LocalRegReviewer, 'user_id'>[],
  reviewsForReg: Pick<LocalRegReviewRow, 'user_id' | 'reviewed_at' | 'version_at_review' | 'initials_snapshot'>[],
  now: Date = new Date(),
): CompliancePartition {
  const latestByUser = latestByKey(reviewsForReg, (r) => r.user_id)
  const rosterIds = new Set(roster.map((r) => r.user_id))

  const reviewed = new Map<string, { reviewed_at: string; initials: string | null }>()
  const outstanding: string[] = []

  for (const userId of rosterIds) {
    const latest = latestByUser.get(userId) ?? null
    const { state } = getRegReviewStatus(reg, latest, now)
    if (state === 'current' && latest) {
      reviewed.set(userId, { reviewed_at: latest.reviewed_at, initials: latest.initials_snapshot ?? null })
    } else {
      outstanding.push(userId)
    }
  }

  for (const [userId, latest] of Array.from(latestByUser.entries())) {
    if (rosterIds.has(userId)) continue
    reviewed.set(userId, { reviewed_at: latest.reviewed_at, initials: latest.initials_snapshot ?? null })
  }

  return { reviewed, outstanding }
}
