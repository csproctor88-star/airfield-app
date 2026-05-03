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
 */
export async function fetchAllReviewsForBase(
  baseId: string,
  since: Date,
): Promise<QrcMonthlyReviewWithUser[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('qrc_monthly_reviews')
    .select(`
      id, base_id, template_id, user_id, reviewed_at,
      template_updated_at_at_review, notes, created_at,
      profiles:user_id ( name, rank, operating_initials )
    `)
    .eq('base_id', baseId)
    .gte('reviewed_at', since.toISOString())
    .order('reviewed_at', { ascending: false })

  if (error || !data) return []

  type Joined = QrcMonthlyReview & {
    profiles: { name: string | null; rank: string | null; operating_initials: string | null } | null
  }

  return (data as Joined[]).map(row => ({
    id: row.id,
    base_id: row.base_id,
    template_id: row.template_id,
    user_id: row.user_id,
    reviewed_at: row.reviewed_at,
    template_updated_at_at_review: row.template_updated_at_at_review,
    notes: row.notes,
    created_at: row.created_at,
    reviewer_name: row.profiles?.name ?? null,
    reviewer_rank: row.profiles?.rank ?? null,
    reviewer_initials: row.profiles?.operating_initials ?? null,
    reviewer_role: null,  // role lives on base_members; fetched separately by fetchEligibleReviewers
  }))
}

/**
 * Operational personnel at this base who are expected to complete monthly QRC
 * reviews (airfield_manager, namo, amops). Joins base_members → profiles.
 */
export async function fetchEligibleReviewers(baseId: string): Promise<EligibleReviewer[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('base_members')
    .select(`
      user_id, role,
      profiles:user_id ( name, rank, operating_initials )
    `)
    .eq('base_id', baseId)
    .in('role', ['airfield_manager', 'namo', 'amops'])

  if (error || !data) return []

  type Joined = {
    user_id: string
    role: string
    profiles: { name: string | null; rank: string | null; operating_initials: string | null } | null
  }

  return (data as Joined[]).map(row => ({
    user_id: row.user_id,
    name: row.profiles?.name ?? '(unknown)',
    rank: row.profiles?.rank ?? null,
    operating_initials: row.profiles?.operating_initials ?? null,
    role: row.role,
  })).sort((a, b) => a.name.localeCompare(b.name))
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
