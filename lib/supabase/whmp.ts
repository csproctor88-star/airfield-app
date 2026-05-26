/**
 * Wildlife Hazard Management Plan (WHMP) — CRUD layer
 *
 * Per 14 CFR §139.337, Part 139 airports with significant wildlife
 * hazards maintain a written, FAA-accepted WHMP reviewed annually by
 * the airport operator. AC 150/5200-33C (Attractants) and AC
 * 150/5200-32B (Strike Reporting) are the implementing guidance.
 *
 * One row per (base, assessment_year). In-year revisions supersede
 * via replaced_by_id (mirrors aep_plans / sms_policies pattern).
 *
 * Civilian Part 139 only at the module-config gate; the table itself
 * is mode-agnostic.
 */

import { createClient } from './client'
import { logActivity } from './activity'
import { friendlyError } from '@/lib/utils'
import { daysBetween } from './aep'

function db() {
  return createClient()
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type WhmpHazardLevel = 'low' | 'medium' | 'high' | 'severe'

export const WHMP_HAZARD_LEVEL_LABELS: Record<WhmpHazardLevel, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  severe: 'Severe',
}

export const WHMP_HAZARD_LEVEL_COLORS: Record<WhmpHazardLevel, string> = {
  low:    'var(--color-success)',
  medium: 'var(--color-warning)',
  high:   'var(--color-warning)',
  severe: 'var(--color-danger)',
}

export type WhmpHazardousSpecies = {
  id: string                       // client-generated UUID for stable React keys
  species: string                  // e.g. 'Canada Goose'
  hazard_level: WhmpHazardLevel
  attractants: string[]            // e.g. ['standing water near rwy 13']
  mitigations: string[]            // e.g. ['weekly mowing', 'pyrotechnic dispersal']
}

export type WhmpFindingCategory =
  | 'habitat'
  | 'population'
  | 'reporting'
  | 'training'
  | 'infrastructure'
  | 'other'

export const WHMP_FINDING_CATEGORY_LABELS: Record<WhmpFindingCategory, string> = {
  habitat:        'Habitat',
  population:     'Population',
  reporting:      'Reporting',
  training:       'Training',
  infrastructure: 'Infrastructure',
  other:          'Other',
}

export type WhmpFinding = {
  id: string
  finding: string                  // narrative
  category: WhmpFindingCategory
  recommended_action: string
  sms_hazard_id: string | null     // back-fill when promoted to SMS register
}

export type WildlifeHazardAssessment = {
  id: string
  base_id: string
  assessment_year: number
  performed_by_user_id: string | null
  performed_by_external: string | null
  performed_at: string                              // YYYY-MM-DD
  report_url: string | null
  storage_path: string | null
  faa_accepted_at: string | null
  faa_acceptance_ref: string | null
  ae_user_id: string | null
  ae_signed_at: string | null
  last_reviewed_at: string | null
  reviewed_by_user_id: string | null
  review_notes: string | null
  hazardous_species: WhmpHazardousSpecies[]
  mitigation_summary: string | null
  findings: WhmpFinding[]
  notes: string | null
  replaced_by_id: string | null
  created_at: string
  created_by: string | null
  updated_at: string
}

// ────────────────────────────────────────────────────────────────
// Pure functions — testable; shared with the UI dashboard chips
// ────────────────────────────────────────────────────────────────

export type DueStatus = 'current' | 'due_soon' | 'overdue' | 'never'

/**
 * §139.337(c) annual review timer: due 12 months after last_reviewed_at
 * (or performed_at if never reviewed). 60-day amber window.
 *
 * Reuses lib/supabase/aep.ts daysBetween for midnight-UTC truncation.
 */
export function nextWhmpReviewDue(
  whmp: Pick<WildlifeHazardAssessment, 'performed_at' | 'last_reviewed_at'> | null,
  now: Date = new Date(),
): { date: Date | null; daysOut: number | null; status: DueStatus } {
  if (!whmp) return { date: null, daysOut: null, status: 'never' }
  const anchor = whmp.last_reviewed_at
    ? new Date(whmp.last_reviewed_at)
    : new Date(whmp.performed_at)
  if (isNaN(anchor.getTime())) return { date: null, daysOut: null, status: 'never' }
  const due = new Date(Date.UTC(anchor.getUTCFullYear() + 1, anchor.getUTCMonth(), anchor.getUTCDate()))
  const daysOut = daysBetween(due, now)
  let status: DueStatus = 'current'
  if (daysOut < 0)        status = 'overdue'
  else if (daysOut <= 60) status = 'due_soon'
  return { date: due, daysOut, status }
}

/**
 * Builds the deep-link URL for "Promote to SMS Hazard" — opens the
 * SMS hazard create page with title + source + source-ref pre-filled
 * via query params. Operator completes the risk assessment and saves
 * the hazard; back-filling sms_hazard_id on the WHMP finding is a
 * separate manual step (UI button labeled "Mark Linked").
 */
export function buildSmsHazardPromoteUrl(input: {
  finding: WhmpFinding
  assessmentId: string
}): string {
  const params = new URLSearchParams({
    prefill_title: input.finding.finding,
    prefill_description: input.finding.recommended_action || '',
    prefill_source: 'whmp',
    prefill_source_ref_id: input.assessmentId,
  })
  return `/sms/hazards/new?${params.toString()}`
}

// ────────────────────────────────────────────────────────────────
// Fetch
// ────────────────────────────────────────────────────────────────

/**
 * Active assessment for the current calendar year (or the most recent
 * year if no current-year row exists). Active = replaced_by_id IS NULL.
 */
export async function fetchActiveWhmp(baseId: string): Promise<WildlifeHazardAssessment | null> {
  const supabase = db()
  if (!supabase) return null

  const { data } = await supabase
    .from('wildlife_hazard_assessments')
    .select('*')
    .eq('base_id', baseId)
    .is('replaced_by_id', null)
    .order('assessment_year', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? (data as unknown as WildlifeHazardAssessment) : null
}

export async function fetchWhmpHistory(baseId: string): Promise<WildlifeHazardAssessment[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('wildlife_hazard_assessments')
    .select('*')
    .eq('base_id', baseId)
    .order('assessment_year', { ascending: false })
    .order('created_at', { ascending: false })
  return ((data || []) as unknown as WildlifeHazardAssessment[])
}

export async function fetchWhmpById(id: string): Promise<WildlifeHazardAssessment | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase
    .from('wildlife_hazard_assessments').select('*').eq('id', id).single()
  return data ? (data as unknown as WildlifeHazardAssessment) : null
}

// ────────────────────────────────────────────────────────────────
// Create / update / supersede
// ────────────────────────────────────────────────────────────────

export type CreateWhmpInput = {
  id?: string                                       // pre-generated UUID for stable upload path
  base_id: string
  assessment_year: number
  performed_by_user_id?: string | null
  performed_by_external?: string | null
  performed_at: string
  report_url?: string | null
  storage_path?: string | null
  faa_accepted_at?: string | null
  faa_acceptance_ref?: string | null
  hazardous_species?: WhmpHazardousSpecies[]
  mitigation_summary?: string | null
  findings?: WhmpFinding[]
  notes?: string | null
}

export async function createWhmp(input: CreateWhmpInput): Promise<{
  ok: boolean
  whmp?: WildlifeHazardAssessment
  error?: string
}> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const row: Record<string, unknown> = {
    base_id: input.base_id,
    assessment_year: input.assessment_year,
    performed_by_user_id: input.performed_by_user_id ?? null,
    performed_by_external: input.performed_by_external ?? null,
    performed_at: input.performed_at,
    report_url: input.report_url ?? null,
    storage_path: input.storage_path ?? null,
    faa_accepted_at: input.faa_accepted_at ?? null,
    faa_acceptance_ref: input.faa_acceptance_ref ?? null,
    hazardous_species: (input.hazardous_species ?? []) as unknown,
    mitigation_summary: input.mitigation_summary ?? null,
    findings: (input.findings ?? []) as unknown,
    notes: input.notes ?? null,
    created_by: user.id,
  }
  if (input.id) row.id = input.id

  const { data, error } = await supabase
    .from('wildlife_hazard_assessments')
    .insert(row as never)
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const whmp = data as unknown as WildlifeHazardAssessment
  const performer = input.performed_by_external?.trim() || 'internal staff'
  logActivity('created', 'whmp', whmp.id,
    `WHMP year ${whmp.assessment_year} assessment filed`,
    { details: `Performed by ${performer} on ${whmp.performed_at} · ${whmp.hazardous_species.length} hazardous species · ${whmp.findings.length} findings` },
    input.base_id)
  return { ok: true, whmp }
}

/**
 * Supersede an existing assessment with a revised version. Inserts a
 * new row (typically same year) and back-fills replaced_by_id on the
 * prior. Two-step write (not transactional) — idempotent retry safe.
 */
export async function supersedeWhmp(
  priorId: string,
  input: CreateWhmpInput,
): Promise<{ ok: boolean; whmp?: WildlifeHazardAssessment; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const created = await createWhmp(input)
  if (!created.ok || !created.whmp) return created

  const { error } = await supabase
    .from('wildlife_hazard_assessments')
    .update({ replaced_by_id: created.whmp.id, updated_at: new Date().toISOString() } as never)
    .eq('id', priorId)
  if (error) return { ok: false, error: friendlyError(error.message) }

  logActivity('updated', 'whmp', priorId,
    `WHMP year ${created.whmp.assessment_year} amended`,
    { details: `Superseded by new revision dated ${created.whmp.performed_at}` },
    input.base_id)
  return { ok: true, whmp: created.whmp }
}

export async function updateWhmpFindings(
  id: string,
  baseId: string,
  findings: WhmpFinding[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { error } = await supabase
    .from('wildlife_hazard_assessments')
    .update({ findings: findings as unknown, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'whmp', id, 'WHMP findings updated', undefined, baseId)
  return { ok: true }
}

/**
 * Stamp the annual review (§139.337(c)). If the assessment hasn't
 * been AE-signed yet, also stamp the initial sign-off — mirrors
 * lib/supabase/aep.ts recordAnnualReview pattern.
 */
export async function recordWhmpAnnualReview(input: {
  whmpId: string
  baseId: string
  notes?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const now = new Date().toISOString()
  const prior = await fetchWhmpById(input.whmpId)
  if (!prior) return { ok: false, error: 'WHMP not found' }

  const patch: Record<string, unknown> = {
    last_reviewed_at: now,
    reviewed_by_user_id: user.id,
    review_notes: input.notes ?? prior.review_notes ?? null,
    updated_at: now,
  }
  if (!prior.ae_signed_at) {
    patch.ae_signed_at = now
    patch.ae_user_id = user.id
  }

  const { error } = await supabase
    .from('wildlife_hazard_assessments').update(patch as never).eq('id', input.whmpId)
  if (error) return { ok: false, error: friendlyError(error.message) }

  const label = prior.ae_signed_at ? 'WHMP annual review recorded' : 'WHMP signed + reviewed'
  logActivity('updated', 'whmp', input.whmpId, label,
    { details: input.notes ? `Notes: ${input.notes}` : undefined },
    input.baseId)
  return { ok: true }
}

/**
 * Upload a WHMP document to the photos bucket under:
 *   whmp/<base_id>/<assessment_id>/<filename>
 *
 * Storage RLS (2026061000) requires wildlife:write + base access
 * derived from path segment 2. Caller pre-generates the assessment id
 * so the path is stable before the row inserts.
 */
export async function uploadWhmpDocument(input: {
  file: File
  base_id: string
  assessment_id: string
}): Promise<{ ok: boolean; url?: string; storage_path?: string; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const lastDot = input.file.name.lastIndexOf('.')
  const ext = lastDot > 0 ? input.file.name.slice(lastDot + 1).toLowerCase() : 'pdf'
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'pdf'
  const path = `whmp/${input.base_id}/${input.assessment_id}/whmp-${Date.now()}.${safeExt}`

  const { error: upErr } = await supabase.storage.from('photos').upload(path, input.file, {
    upsert: false,
    contentType: input.file.type || 'application/pdf',
  })
  if (upErr) return { ok: false, error: friendlyError(upErr.message) }

  const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
  return { ok: true, url: urlData.publicUrl, storage_path: path }
}
