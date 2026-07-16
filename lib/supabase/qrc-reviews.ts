import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import { fetchQrcTemplates } from './qrc'
import { getMonthlyReviewStatus } from '@/lib/qrc/monthly-review-status'
import type { QrcMonthlyReview } from './types'

// ─────────────────────────────────────────────────────────────
// Per-user monthly QRC review CRUD.
// Annual (template-level) review remains in lib/supabase/qrc.ts.
//
// `qrc_monthly_reviews` was added in migration 2026050300 and is not yet
// reflected in the auto-generated Database type. We cast the supabase
// client to `any` for these calls — same pattern used elsewhere in
// lib/supabase/* when the typed `.from()` overload is too narrow.
// ─────────────────────────────────────────────────────────────

export interface QrcMonthlyReviewWithUser extends QrcMonthlyReview {
  reviewer_name: string | null
  reviewer_rank: string | null
  reviewer_initials: string | null
  reviewer_role: string | null
}

export interface EligibleReviewer {
  user_id: string
  name: string
  rank: string | null
  operating_initials: string | null
  role: string
}

/**
 * Latest review per template_id for the signed-in user at this base.
 * Used by the Reviews tab to compute per-row Due / Updated / Current state.
 */
export async function fetchUserReviews(baseId: string | null | undefined): Promise<QrcMonthlyReview[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('qrc_monthly_reviews')
    .select('*')
    .eq('base_id', baseId)
    .eq('user_id', user.id)
    .order('reviewed_at', { ascending: false })

  if (error || !data) return []

  // Collapse to latest per template_id (rows are already DESC-sorted).
  const latest = new Map<string, QrcMonthlyReview>()
  for (const row of data as QrcMonthlyReview[]) {
    if (!latest.has(row.template_id)) latest.set(row.template_id, row)
  }
  return Array.from(latest.values())
}

/**
 * Every review at a base since `since` (inclusive), with reviewer profile
 * fields joined. Powers the consolidated PDF compliance report.
 *
 * Two-step query — review rows then a separate profiles lookup keyed by
 * the user_ids we found. The PostgREST embed-join syntax silently fails
 * when the schema cache hasn't refreshed after a migration; the explicit
 * round-trip is more robust and matches the daily-reviews pattern in
 * lib/supabase/daily-reviews.ts:219-227.
 */
export async function fetchAllReviewsForBase(
  baseId: string,
  since: Date,
): Promise<QrcMonthlyReviewWithUser[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data: rows, error } = await supabase
    .from('qrc_monthly_reviews')
    .select('*')
    .eq('base_id', baseId)
    .gte('reviewed_at', since.toISOString())
    .order('reviewed_at', { ascending: false })

  if (error || !rows) return []
  const reviewRows = rows as QrcMonthlyReview[]
  if (reviewRows.length === 0) return []

  const userIds = Array.from(new Set(reviewRows.map(r => r.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, rank, operating_initials')
    .in('id', userIds)

  type ProfileRow = { id: string; name: string | null; rank: string | null; operating_initials: string | null }
  const byId = new Map<string, ProfileRow>()
  for (const p of (profiles ?? []) as unknown as ProfileRow[]) byId.set(p.id, p)

  return reviewRows.map(row => {
    const p = byId.get(row.user_id)
    return {
      ...row,
      reviewer_name: p?.name ?? null,
      reviewer_rank: p?.rank ?? null,
      reviewer_initials: p?.operating_initials ?? null,
      reviewer_role: null,  // role lives on base_members; fetched separately by fetchEligibleReviewers
    }
  })
}

/**
 * Personnel at this base who are expected to complete (or audit) monthly QRC
 * reviews. Includes the operational roles (airfield_manager, namo, amops)
 * plus admin roles (base_admin, sys_admin) — at small ANG units the same
 * person often wears multiple hats and the sys_admin actively does reviews.
 *
 * Note: anyone outside this role set who actually has a review row gets
 * folded in by the consolidated PDF preparation step (defensive — catches
 * edge cases like a `safety` user who happened to review).
 *
 * Two-step query for the same PostgREST embed-cache reason as
 * fetchAllReviewsForBase above.
 */
export const REVIEWER_ROLES = [
  'airfield_manager', 'namo', 'amops', 'base_admin', 'sys_admin',
] as const

export async function fetchEligibleReviewers(baseId: string): Promise<EligibleReviewer[]> {
  const supabase = createClient()
  if (!supabase) return []

  // base_members tells us WHO belongs to the base. The role itself comes from
  // profiles.role — the authoritative role the permission matrix
  // (user_has_permission) reads and that User Management edits. base_members.role
  // is a legacy per-base column that has drifted (often stale 'read_only'); using
  // it here silently dropped real reviewers from the report.
  const { data: members, error } = await supabase
    .from('base_members')
    .select('user_id')
    .eq('base_id', baseId)

  if (error || !members) return []
  const userIds = (members as { user_id: string }[]).map(m => m.user_id)
  if (userIds.length === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, rank, operating_initials, role')
    .in('id', userIds)

  type ProfileRow = { id: string; name: string | null; rank: string | null; operating_initials: string | null; role: string | null }
  const reviewerRoles = REVIEWER_ROLES as readonly string[]

  return ((profiles ?? []) as unknown as ProfileRow[])
    .filter(p => p.role != null && reviewerRoles.includes(p.role))
    .map(p => ({
      user_id: p.id,
      name: p.name ?? '(unknown)',
      rank: p.rank ?? null,
      operating_initials: p.operating_initials ?? null,
      role: p.role as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Insert a new review row for the signed-in user. Snapshots the template's
 * current updated_at so the per-review record proves which version the
 * operator was looking at when they marked reviewed.
 */
export async function markReviewed(
  templateId: string,
  baseId: string,
  note?: string,
): Promise<{ data: QrcMonthlyReview | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not signed in' }

  // Snapshot the template's current updated_at so the per-review record proves
  // which version the operator was looking at when they marked reviewed.
  const { data: tmpl } = await supabase
    .from('qrc_templates')
    .select('updated_at')
    .eq('id', templateId)
    .single()

  const { data, error } = await supabase
    .from('qrc_monthly_reviews')
    .insert({
      base_id: baseId,
      template_id: templateId,
      user_id: user.id,
      template_updated_at_at_review: (tmpl as { updated_at?: string } | null)?.updated_at || null,
      notes: note?.trim() || null,
    })
    .select()
    .single()

  if (error) return { data: null, error: friendlyError(error.message) }
  return { data: data as QrcMonthlyReview, error: null }
}

// ─────────────────────────────────────────────────────────────
// Revised-since-review signal (mid-cycle QRC revisions).
//
// Counts active templates the current user has reviewed before but whose
// template.updated_at is newer than that review — i.e. getMonthlyReviewStatus
// === 'updated'. This is interval-independent (the 'updated' branch fires
// before the overdue check), so the count is the same monthly or quarterly.
// Drives the amber /qrc sidebar dot.
// ─────────────────────────────────────────────────────────────

/** Pure: how many active templates are revised-since-the-user's-review. */
export function countRevised(
  templates: { id: string; updated_at: string | null; is_active: boolean }[],
  latestReviewByTemplate: Map<string, QrcMonthlyReview>,
): number {
  let n = 0
  for (const t of templates) {
    if (!t.is_active) continue
    const review = latestReviewByTemplate.get(t.id) ?? null
    // '' is treated as "no update" by getMonthlyReviewStatus (falsy → epoch 0).
    if (getMonthlyReviewStatus({ updated_at: t.updated_at ?? '' }, review).state === 'updated') n += 1
  }
  return n
}

/** Count of active QRCs revised since the signed-in user last reviewed them. */
export async function fetchRevisedQrcCount(baseId: string | null | undefined): Promise<number> {
  if (!baseId) return 0
  const [templates, reviews] = await Promise.all([
    fetchQrcTemplates(baseId),
    fetchUserReviews(baseId),
  ])
  const byTemplate = new Map<string, QrcMonthlyReview>(reviews.map(r => [r.template_id, r]))
  return countRevised(templates, byTemplate)
}
