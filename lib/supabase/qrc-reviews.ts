import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: rows, error } = await sb
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
 * Operational personnel at this base who are expected to complete monthly QRC
 * reviews (airfield_manager, namo, amops). Two-step query for the same
 * reason as fetchAllReviewsForBase above.
 */
export async function fetchEligibleReviewers(baseId: string): Promise<EligibleReviewer[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: members, error } = await sb
    .from('base_members')
    .select('user_id, role')
    .eq('base_id', baseId)
    .in('role', ['airfield_manager', 'namo', 'amops'])

  if (error || !members) return []
  const memberRows = members as { user_id: string; role: string }[]
  if (memberRows.length === 0) return []

  const userIds = memberRows.map(m => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, rank, operating_initials')
    .in('id', userIds)

  type ProfileRow = { id: string; name: string | null; rank: string | null; operating_initials: string | null }
  const byId = new Map<string, ProfileRow>()
  for (const p of (profiles ?? []) as unknown as ProfileRow[]) byId.set(p.id, p)

  return memberRows.map(m => {
    const p = byId.get(m.user_id)
    return {
      user_id: m.user_id,
      name: p?.name ?? '(unknown)',
      rank: p?.rank ?? null,
      operating_initials: p?.operating_initials ?? null,
      role: m.role,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
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
