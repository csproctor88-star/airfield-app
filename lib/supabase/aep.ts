/**
 * Airport Emergency Plan (AEP) — CRUD layer
 *
 * Per 14 CFR §139.325 and AC 150/5200-31C, civilian Part 139 airports
 * maintain an Airport Emergency Plan covering:
 *   - a written plan reviewed annually by the airport operator
 *   - a roster of response agencies (ARFF / mutual-aid / EMS / ATC / etc.)
 *   - periodic comms checks against that roster
 *   - a drill program: triennial full-scale + annual tabletop / functional
 *
 * This module is the data layer for the five supporting tables:
 *
 *   aep_plans                  — versioned plan + AE annual review
 *   aep_response_agencies      — roster grouped by role
 *   aep_drills                 — §139.325(h/j) drill log
 *   aep_comms_checks           — per-cycle rollup
 *   aep_comms_check_results    — per-agency status snapshots
 *
 * Civilian Part 139 only (gated at module-config layer via
 * `appliesTo: ['faa_part139']`). USAF bases see SCN instead.
 *
 * Two pure functions (nextFullScaleDue + nextAnnualReviewDue) drive the
 * dashboard chips and the SMS SPI compute on the DB side; they are
 * tested in tests/aep.test.ts to cover the calendar-day truncation
 * edge cases that surfaced during Phase 3a's daysToExpiry lesson.
 */

import { createClient } from './client'
import { logActivity } from './activity'
import { friendlyError } from '@/lib/utils'
import { photoUrl } from './photos'

function db() {
  return createClient()
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type AepPlan = {
  id: string
  base_id: string
  version: string
  effective_date: string                  // YYYY-MM-DD
  document_url: string | null
  storage_path: string | null
  approved_by_faa_at: string | null       // YYYY-MM-DD
  faa_acceptance_ref: string | null
  ae_user_id: string | null
  ae_signed_at: string | null             // ISO timestamp
  last_reviewed_at: string | null         // ISO timestamp
  reviewed_by_user_id: string | null
  review_notes: string | null
  replaced_by_id: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  updated_at: string
}

export type AepAgencyRole =
  | 'arff' | 'mutual_aid_fire' | 'ems' | 'police' | 'hospital'
  | 'atc'  | 'faa_ro' | 'ntsb' | 'fbi' | 'public_works' | 'utility' | 'other'

export type AepResponseAgency = {
  id: string
  base_id: string
  agency_name: string
  agency_role: AepAgencyRole
  primary_contact_name: string | null
  primary_contact_phone: string | null
  primary_contact_radio: string | null
  backup_contact_name: string | null
  backup_contact_phone: string | null
  notes: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AepDrillType =
  | 'full_scale' | 'tabletop' | 'functional' | 'orientation' | 'arff_familiarization'

export type AepDrillStatus = 'scheduled' | 'completed' | 'cancelled'

export type AepDrillParticipant = {
  agency_id: string | null
  agency_name: string
  role: AepAgencyRole | null
  attended?: boolean
}

export type AepDrill = {
  id: string
  base_id: string
  drill_date: string                      // YYYY-MM-DD
  drill_type: AepDrillType
  scenario: string
  status: AepDrillStatus
  participants: AepDrillParticipant[]
  after_action_notes: string | null
  findings: string | null
  evidence_url: string | null
  storage_path: string | null
  next_due_at_override: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  created_by: string | null
  updated_at: string
}

export type AepCommsCheckStatus = 'loud_clear' | 'no_response' | 'oos' | 'not_reached'
export type AepCommsCheckPeriod = 'monthly' | 'quarterly' | 'ad_hoc'

export type AepCommsCheck = {
  id: string
  base_id: string
  check_date: string                      // YYYY-MM-DD (Zulu)
  check_period: AepCommsCheckPeriod
  started_at: string
  completed_at: string | null
  completed_by: string | null
  completed_by_oi: string | null
  notes: string | null
  created_at: string
}

export type AepCommsCheckResult = {
  id: string
  check_id: string
  agency_id: string | null
  agency_name: string
  agency_role: AepAgencyRole | null
  status: AepCommsCheckStatus
  notes: string | null
  sort_order: number
  created_at: string
}

export type AepCommsCheckWithResults = AepCommsCheck & { results: AepCommsCheckResult[] }

export type AepCommsAgencyResultInput = {
  agency_id: string | null
  agency_name: string
  agency_role: AepAgencyRole | null
  status: AepCommsCheckStatus
  notes?: string | null
  sort_order: number
}

// ────────────────────────────────────────────────────────────────
// Labels + colors (single source of truth for UI rendering)
// ────────────────────────────────────────────────────────────────

export const AEP_AGENCY_ROLE_LABELS: Record<AepAgencyRole, string> = {
  arff:             'ARFF',
  mutual_aid_fire:  'Mutual-Aid Fire',
  ems:              'EMS',
  police:           'Police',
  hospital:         'Hospital',
  atc:              'ATC',
  faa_ro:           'FAA Regional Office',
  ntsb:             'NTSB',
  fbi:              'FBI',
  public_works:     'Public Works',
  utility:          'Utility',
  other:            'Other',
}

/** Ordering used when rendering grouped roster views. */
export const AEP_AGENCY_ROLE_ORDER: AepAgencyRole[] = [
  'arff', 'mutual_aid_fire', 'ems', 'police', 'hospital',
  'atc', 'faa_ro', 'ntsb', 'fbi', 'public_works', 'utility', 'other',
]

export const AEP_COMMS_STATUS_LABELS: Record<AepCommsCheckStatus, string> = {
  loud_clear:   'Loud & Clear',
  no_response:  'No Response',
  oos:          'Out of Service',
  not_reached:  'Not Reached',
}

export const AEP_COMMS_STATUS_COLORS: Record<AepCommsCheckStatus, string> = {
  loud_clear:   'var(--color-success)',
  no_response:  'var(--color-warning)',
  oos:          'var(--color-danger)',
  not_reached:  'var(--color-text-3)',
}

export const AEP_DRILL_TYPE_LABELS: Record<AepDrillType, string> = {
  full_scale:           'Full-Scale Exercise',
  tabletop:             'Tabletop',
  functional:           'Functional',
  orientation:          'Orientation',
  arff_familiarization: 'ARFF Familiarization',
}

// ────────────────────────────────────────────────────────────────
// Pure functions — shared by UI + dashboard chips + tests
// ────────────────────────────────────────────────────────────────

/** Zulu YYYY-MM-DD for today. AEP records use Zulu date to match SCN / activity log. */
export function todayZuluDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Whole calendar days between today and a target ISO date string,
 * ignoring time-of-day. Truncates both sides to midnight UTC so a
 * date stamped 2027-05-26 read at noon on 2027-04-26 returns exactly
 * 30, not 29.5. Same pattern as training-part139's daysToExpiry —
 * see Phase 3a lessons.
 */
export function daysBetween(target: string | Date, now: Date = new Date()): number {
  const t = typeof target === 'string' ? new Date(target) : target
  if (isNaN(t.getTime())) return NaN
  const nowMid = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const tMid   = Date.UTC(t.getUTCFullYear(),   t.getUTCMonth(),   t.getUTCDate())
  return Math.round((tMid - nowMid) / 86_400_000)
}

export type DueStatus = 'current' | 'due_soon' | 'overdue' | 'never'

/**
 * Next §139.325(h) full-scale drill due, computed off the most recent
 * completed full-scale drill. Triennial cadence (36 calendar months).
 *
 *   never:    no completed full-scale on record
 *   overdue:  past 36 months
 *   due_soon: within 180 days of the 36-month anniversary
 *   current:  more than 180 days out
 */
export function nextFullScaleDue(
  latestFullScale: Pick<AepDrill, 'drill_date'> | null,
  now: Date = new Date(),
): { date: Date | null; daysOut: number | null; status: DueStatus } {
  if (!latestFullScale) return { date: null, daysOut: null, status: 'never' }
  const last = new Date(latestFullScale.drill_date)
  if (isNaN(last.getTime())) return { date: null, daysOut: null, status: 'never' }
  const due = new Date(Date.UTC(last.getUTCFullYear() + 3, last.getUTCMonth(), last.getUTCDate()))
  const daysOut = daysBetween(due, now)
  let status: DueStatus = 'current'
  if (daysOut < 0)         status = 'overdue'
  else if (daysOut <= 180) status = 'due_soon'
  return { date: due, daysOut, status }
}

/**
 * §139.325(d) annual review: due 12 months after last_reviewed_at (or
 * the plan's effective_date if never reviewed). 60-day amber window.
 */
export function nextAnnualReviewDue(
  plan: Pick<AepPlan, 'effective_date' | 'last_reviewed_at'> | null,
  now: Date = new Date(),
): { date: Date | null; daysOut: number | null; status: DueStatus } {
  if (!plan) return { date: null, daysOut: null, status: 'never' }
  const anchor = plan.last_reviewed_at
    ? new Date(plan.last_reviewed_at)
    : new Date(plan.effective_date)
  if (isNaN(anchor.getTime())) return { date: null, daysOut: null, status: 'never' }
  const due = new Date(Date.UTC(anchor.getUTCFullYear() + 1, anchor.getUTCMonth(), anchor.getUTCDate()))
  const daysOut = daysBetween(due, now)
  let status: DueStatus = 'current'
  if (daysOut < 0)        status = 'overdue'
  else if (daysOut <= 60) status = 'due_soon'
  return { date: due, daysOut, status }
}

/**
 * Events Log summary for a completed comms check. Mirrors SCN's
 * summarizeCheck format so audit packets read consistently across
 * AEP and SCN bases.
 *
 *   "AEP comms check complete — all agencies loud & clear"
 *   "AEP comms check complete — all loud & clear except Engine 7 (Out of Service: radio in shop)"
 */
export function summarizeCommsCheck(check: AepCommsCheckWithResults): string {
  const exceptions = check.results.filter(r => r.status !== 'loud_clear')
  if (exceptions.length === 0) {
    return 'AEP comms check complete — all agencies loud & clear'
  }
  const parts = exceptions.map(r => {
    const head = `${r.agency_name} (${AEP_COMMS_STATUS_LABELS[r.status]}`
    const tail = r.notes ? `: ${r.notes}` : ''
    return `${head}${tail})`
  })
  return `AEP comms check complete — all loud & clear except ${parts.join(', ')}`
}

// ────────────────────────────────────────────────────────────────
// Plan CRUD
// ────────────────────────────────────────────────────────────────

/** Active plan = the only row with replaced_by_id IS NULL for this base. */
export async function fetchActivePlan(baseId: string): Promise<AepPlan | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase
    .from('aep_plans')
    .select('*')
    .eq('base_id', baseId)
    .is('replaced_by_id', null)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? (data as unknown as AepPlan) : null
}

export async function fetchPlanHistory(baseId: string): Promise<AepPlan[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('aep_plans')
    .select('*')
    .eq('base_id', baseId)
    .order('effective_date', { ascending: false })
  return ((data || []) as unknown as AepPlan[])
}

export async function fetchPlanById(id: string): Promise<AepPlan | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase.from('aep_plans').select('*').eq('id', id).single()
  return data ? (data as unknown as AepPlan) : null
}

/**
 * Create a new plan row. Caller can pass `id` (pre-generated UUID) when
 * the storage-path needs to be computed before the row inserts (the
 * uploadPlanDocument helper requires a known plan_id to build the path).
 */
export async function createPlan(input: {
  id?: string
  base_id: string
  version: string
  effective_date: string
  document_url?: string | null
  storage_path?: string | null
  approved_by_faa_at?: string | null
  faa_acceptance_ref?: string | null
  notes?: string | null
}): Promise<{ ok: boolean; plan?: AepPlan; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const row: Record<string, unknown> = {
    base_id: input.base_id,
    version: input.version,
    effective_date: input.effective_date,
    document_url: input.document_url ?? null,
    storage_path: input.storage_path ?? null,
    approved_by_faa_at: input.approved_by_faa_at ?? null,
    faa_acceptance_ref: input.faa_acceptance_ref ?? null,
    notes: input.notes ?? null,
    created_by: user.id,
  }
  if (input.id) row.id = input.id

  const { data, error } = await supabase
    .from('aep_plans')
    .insert(row as never)
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const plan = data as unknown as AepPlan
  logActivity('created', 'aep_plan', plan.id, `AEP plan ${plan.version} effective ${plan.effective_date}`, undefined, input.base_id)
  return { ok: true, plan }
}

/**
 * Supersede the active plan with a new version. Calls the
 * supersede_aep_plan SECURITY DEFINER RPC so the INSERT (new row)
 * and UPDATE (prior row's replaced_by_id pointer) commit
 * atomically — eliminates the transient two-active-rows window the
 * old two-write implementation had if the client crashed mid-flow.
 *
 * The `base_id` field on `input` is ignored — the RPC derives it
 * from the prior plan and rejects cross-base writes. Kept on the
 * type for callsite stability.
 */
export async function supersedePlan(
  priorPlanId: string,
  input: {
    base_id: string
    version: string
    effective_date: string
    document_url?: string | null
    storage_path?: string | null
    approved_by_faa_at?: string | null
    faa_acceptance_ref?: string | null
    notes?: string | null
  },
): Promise<{ ok: boolean; plan?: AepPlan; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data, error } = await supabase.rpc('supersede_aep_plan', {
    p_prior_plan_id: priorPlanId,
    p_version: input.version,
    p_effective_date: input.effective_date,
    p_document_url: input.document_url ?? undefined,
    p_storage_path: input.storage_path ?? undefined,
    p_approved_by_faa_at: input.approved_by_faa_at ?? undefined,
    p_faa_acceptance_ref: input.faa_acceptance_ref ?? undefined,
    p_notes: input.notes ?? undefined,
  })
  if (error) return { ok: false, error: friendlyError(error.message) }

  const plan = (data as { ok?: boolean; plan?: AepPlan } | null)?.plan
  if (!plan) return { ok: false, error: 'Supersede returned no plan row' }

  logActivity('updated', 'aep_plan', priorPlanId,
    `AEP plan superseded by ${plan.version}`,
    { details: `New plan ${plan.version} effective ${plan.effective_date}` },
    input.base_id)
  return { ok: true, plan }
}

/**
 * Record an AE annual review (also stamps the initial AE sign-off if
 * `ae_signed_at` is still null). UI gates the button on `aep:sign`;
 * the RLS only requires `aep:write` so the action is callable by any
 * write-permitted user — soft enforcement, matched to AEP's lighter
 * review cadence vs. SMS's policy chain.
 */
export async function recordAnnualReview(input: {
  planId: string
  baseId: string
  notes?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const now = new Date().toISOString()
  const prior = await fetchPlanById(input.planId)
  if (!prior) return { ok: false, error: 'Plan not found' }

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

  const { error } = await supabase.from('aep_plans').update(patch as never).eq('id', input.planId)
  if (error) return { ok: false, error: friendlyError(error.message) }

  const label = prior.ae_signed_at ? 'AEP annual review recorded' : 'AEP plan signed + reviewed'
  logActivity('updated', 'aep_plan', input.planId, label,
    { details: input.notes ? `Notes: ${input.notes}` : undefined },
    input.baseId)
  return { ok: true }
}

/**
 * Upload an AEP plan document to the photos bucket under:
 *   aep-plans/<base_id>/<plan_id>/plan-<ts>.<ext>
 *
 * Storage RLS (2026060705) requires `aep:write` + base access derived
 * from path segment 2. Caller pre-generates the plan id so the path is
 * stable before the row inserts — same shape as
 * training-part139.uploadTrainingEvidence.
 */
export async function uploadPlanDocument(input: {
  file: File
  base_id: string
  plan_id: string
}): Promise<{ ok: boolean; url?: string; storage_path?: string; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const lastDot = input.file.name.lastIndexOf('.')
  const ext = lastDot > 0 ? input.file.name.slice(lastDot + 1).toLowerCase() : 'pdf'
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'pdf'
  const path = `aep-plans/${input.base_id}/${input.plan_id}/plan-${Date.now()}.${safeExt}`

  const { error: upErr } = await supabase.storage.from('photos').upload(path, input.file, {
    upsert: false,
    contentType: input.file.type || 'application/pdf',
  })
  if (upErr) return { ok: false, error: friendlyError(upErr.message) }

  return { ok: true, url: photoUrl(path), storage_path: path }
}

// ────────────────────────────────────────────────────────────────
// Response Agency CRUD (mirrors lib/supabase/scn-agencies.ts)
// ────────────────────────────────────────────────────────────────

export async function fetchResponseAgencies(
  baseId: string,
  onlyActive = false,
): Promise<AepResponseAgency[]> {
  const supabase = db()
  if (!supabase) return []
  let q = supabase
    .from('aep_response_agencies')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })
    .order('agency_name', { ascending: true })
  if (onlyActive) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) {
    console.error('fetchResponseAgencies failed:', error.message)
    return []
  }
  return ((data || []) as unknown as AepResponseAgency[])
}

export async function createResponseAgency(
  baseId: string,
  input: {
    agency_name: string
    agency_role: AepAgencyRole
    primary_contact_name?: string | null
    primary_contact_phone?: string | null
    primary_contact_radio?: string | null
    backup_contact_name?: string | null
    backup_contact_phone?: string | null
    notes?: string | null
  },
): Promise<{ ok: boolean; agency?: AepResponseAgency; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const trimmed = input.agency_name.trim()
  if (!trimmed) return { ok: false, error: 'Agency name is required' }

  // Append to end by default
  const { data: existing } = await supabase
    .from('aep_response_agencies')
    .select('sort_order')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = (existing && existing.length > 0
    ? (existing[0] as { sort_order: number }).sort_order
    : 0) + 10

  const { data, error } = await supabase
    .from('aep_response_agencies')
    .insert({
      base_id: baseId,
      agency_name: trimmed,
      agency_role: input.agency_role,
      primary_contact_name: input.primary_contact_name ?? null,
      primary_contact_phone: input.primary_contact_phone ?? null,
      primary_contact_radio: input.primary_contact_radio ?? null,
      backup_contact_name: input.backup_contact_name ?? null,
      backup_contact_phone: input.backup_contact_phone ?? null,
      notes: input.notes ?? null,
      sort_order: nextOrder,
    })
    .select('*')
    .single()

  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }
  const agency = data as unknown as AepResponseAgency
  logActivity('created', 'aep_response_agency', agency.id,
    `AEP agency added (${AEP_AGENCY_ROLE_LABELS[agency.agency_role]}): ${agency.agency_name}`,
    undefined, baseId)
  return { ok: true, agency }
}

export async function updateResponseAgency(
  id: string,
  baseId: string,
  updates: Partial<Pick<AepResponseAgency,
    | 'agency_name' | 'agency_role'
    | 'primary_contact_name' | 'primary_contact_phone' | 'primary_contact_radio'
    | 'backup_contact_name' | 'backup_contact_phone'
    | 'notes' | 'sort_order' | 'is_active'
  >>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(updates)) {
    patch[k] = typeof v === 'string' ? v.trim() : v
  }

  const { error } = await supabase.from('aep_response_agencies').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'aep_response_agency', id, 'AEP agency updated', undefined, baseId)
  return { ok: true }
}

export async function deleteResponseAgency(
  id: string,
  baseId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { error } = await supabase.from('aep_response_agencies').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('deleted', 'aep_response_agency', id, 'AEP agency removed', undefined, baseId)
  return { ok: true }
}

export async function reorderResponseAgencies(
  baseId: string,
  ordered: { id: string; sort_order: number }[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  for (const entry of ordered) {
    const { error } = await supabase
      .from('aep_response_agencies')
      .update({ sort_order: entry.sort_order } as never)
      .eq('id', entry.id)
    if (error) return { ok: false, error: friendlyError(error.message) }
  }
  logActivity('updated', 'aep_response_agency', baseId, 'AEP roster reordered', undefined, baseId)
  return { ok: true }
}

// ────────────────────────────────────────────────────────────────
// Drill CRUD
// ────────────────────────────────────────────────────────────────

export async function fetchDrills(opts: {
  base_id: string
  drill_type?: AepDrillType
  start_date?: string
  end_date?: string
}): Promise<AepDrill[]> {
  const supabase = db()
  if (!supabase) return []
  let q = supabase.from('aep_drills').select('*').eq('base_id', opts.base_id)
  if (opts.drill_type) q = q.eq('drill_type', opts.drill_type)
  if (opts.start_date) q = q.gte('drill_date', opts.start_date)
  if (opts.end_date)   q = q.lte('drill_date', opts.end_date)
  const { data } = await q.order('drill_date', { ascending: false })
  return ((data || []) as unknown as AepDrill[])
}

export async function fetchLatestFullScale(baseId: string): Promise<AepDrill | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase
    .from('aep_drills')
    .select('*')
    .eq('base_id', baseId)
    .eq('drill_type', 'full_scale')
    .eq('status', 'completed')
    .order('drill_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? (data as unknown as AepDrill) : null
}

export async function createDrill(input: {
  id?: string
  base_id: string
  drill_date: string
  drill_type: AepDrillType
  scenario: string
  participants?: AepDrillParticipant[]
  status?: AepDrillStatus
}): Promise<{ ok: boolean; drill?: AepDrill; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const row: Record<string, unknown> = {
    base_id: input.base_id,
    drill_date: input.drill_date,
    drill_type: input.drill_type,
    scenario: input.scenario.trim(),
    participants: (input.participants ?? []) as unknown,
    status: input.status ?? 'scheduled',
    created_by: user.id,
  }
  if (input.id) row.id = input.id

  const { data, error } = await supabase
    .from('aep_drills')
    .insert(row as never)
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const drill = data as unknown as AepDrill
  logActivity('created', 'aep_drill', drill.id,
    `AEP drill scheduled — ${AEP_DRILL_TYPE_LABELS[drill.drill_type]} on ${drill.drill_date}`,
    undefined, input.base_id)
  return { ok: true, drill }
}

export async function completeDrill(
  id: string,
  baseId: string,
  input: {
    participants: AepDrillParticipant[]
    after_action_notes?: string | null
    findings?: string | null
    evidence_url?: string | null
    storage_path?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: 'completed',
    participants: input.participants as unknown,
    after_action_notes: input.after_action_notes ?? null,
    findings: input.findings ?? null,
    evidence_url: input.evidence_url ?? null,
    storage_path: input.storage_path ?? null,
    completed_at: now,
    completed_by: user.id,
    updated_at: now,
  }
  const { error } = await supabase.from('aep_drills').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('completed', 'aep_drill', id,
    'AEP drill completed',
    { details: `Participants: ${input.participants.filter(p => p.attended).length} of ${input.participants.length}` },
    baseId)
  return { ok: true }
}

export async function deleteDrill(id: string, baseId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { error } = await supabase.from('aep_drills').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('deleted', 'aep_drill', id, 'AEP drill deleted', undefined, baseId)
  return { ok: true }
}

/** Upload an after-action report to `aep-drills/<base>/<drill>/aar-<ts>.<ext>`. */
export async function uploadDrillAfterAction(input: {
  file: File
  base_id: string
  drill_id: string
}): Promise<{ ok: boolean; url?: string; storage_path?: string; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const lastDot = input.file.name.lastIndexOf('.')
  const ext = lastDot > 0 ? input.file.name.slice(lastDot + 1).toLowerCase() : 'pdf'
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'pdf'
  const path = `aep-drills/${input.base_id}/${input.drill_id}/aar-${Date.now()}.${safeExt}`

  const { error: upErr } = await supabase.storage.from('photos').upload(path, input.file, {
    upsert: false,
    contentType: input.file.type || 'application/pdf',
  })
  if (upErr) return { ok: false, error: friendlyError(upErr.message) }

  return { ok: true, url: photoUrl(path), storage_path: path }
}

// ────────────────────────────────────────────────────────────────
// Comms Check CRUD (mirrors lib/supabase/scn.ts saveCheck pattern)
// ────────────────────────────────────────────────────────────────

/** First-of-month YYYY-MM-DD in Zulu for the calendar month containing `at`. */
export function monthStart(at: Date = new Date()): string {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

/**
 * Most recent check in the current calendar month (any check_period).
 * Returns the latest by check_date so the dashboard "this month's check"
 * card reflects the operator's actual cadence.
 */
export async function fetchCurrentMonthCheck(baseId: string): Promise<AepCommsCheckWithResults | null> {
  const supabase = db()
  if (!supabase) return null
  const start = monthStart()
  const { data: checks } = await supabase
    .from('aep_comms_checks')
    .select('*')
    .eq('base_id', baseId)
    .gte('check_date', start)
    .order('check_date', { ascending: false })
    .limit(1)
  if (!checks || checks.length === 0) return null
  const check = checks[0] as AepCommsCheck
  return fetchCheckById(check.id)
}

export async function fetchCheckById(id: string): Promise<AepCommsCheckWithResults | null> {
  const supabase = db()
  if (!supabase) return null
  const { data: check } = await supabase
    .from('aep_comms_checks').select('*').eq('id', id).single()
  if (!check) return null
  const { data: results } = await supabase
    .from('aep_comms_check_results')
    .select('*')
    .eq('check_id', id)
    .order('sort_order', { ascending: true })
  return { ...(check as AepCommsCheck), results: (results || []) as AepCommsCheckResult[] }
}

export async function fetchChecksInRange(
  baseId: string,
  startDate: string,
  endDate: string,
): Promise<AepCommsCheckWithResults[]> {
  const supabase = db()
  if (!supabase) return []
  const { data: checks } = await supabase
    .from('aep_comms_checks')
    .select('*')
    .eq('base_id', baseId)
    .gte('check_date', startDate)
    .lte('check_date', endDate)
    .order('check_date', { ascending: false })
  if (!checks || checks.length === 0) return []
  const ids = (checks as AepCommsCheck[]).map(c => c.id)
  const { data: results } = await supabase
    .from('aep_comms_check_results')
    .select('*')
    .in('check_id', ids)
    .order('sort_order', { ascending: true })
  const byCheck = new Map<string, AepCommsCheckResult[]>()
  for (const r of (results || []) as AepCommsCheckResult[]) {
    const arr = byCheck.get(r.check_id) ?? []
    arr.push(r)
    byCheck.set(r.check_id, arr)
  }
  return (checks as AepCommsCheck[]).map(c => ({ ...c, results: byCheck.get(c.id) ?? [] }))
}

/**
 * Save a comms check by (base_id, check_date, check_period). Upsert
 * pattern: re-runs the same day overwrite the prior results so the
 * UI's "edit this check" path doesn't accumulate duplicates.
 */
export async function saveCommsCheck(input: {
  baseId: string
  checkDate: string                       // YYYY-MM-DD
  checkPeriod: AepCommsCheckPeriod
  operatingInitials?: string | null
  notes?: string | null
  agencies: AepCommsAgencyResultInput[]
}): Promise<{ data: AepCommsCheckWithResults | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let userId: string | null = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* unauthenticated — skip attribution */ }

  // Upsert by (base_id, check_date, check_period)
  const { data: existing } = await supabase
    .from('aep_comms_checks')
    .select('id')
    .eq('base_id', input.baseId)
    .eq('check_date', input.checkDate)
    .eq('check_period', input.checkPeriod)
    .maybeSingle()

  const completedAt = new Date().toISOString()
  const checkPayload: Record<string, unknown> = {
    base_id: input.baseId,
    check_date: input.checkDate,
    check_period: input.checkPeriod,
    completed_at: completedAt,
    completed_by: userId,
    completed_by_oi: input.operatingInitials || null,
    notes: input.notes || null,
  }

  let checkId: string
  if (existing?.id) {
    checkId = existing.id
    const { error } = await supabase
      .from('aep_comms_checks').update(checkPayload as never).eq('id', checkId)
    if (error) return { data: null, error: friendlyError(error.message) }
    await supabase.from('aep_comms_check_results').delete().eq('check_id', checkId)
  } else {
    const { data: inserted, error } = await supabase
      .from('aep_comms_checks')
      .insert(checkPayload as never)
      .select('id')
      .single()
    if (error || !inserted) {
      return { data: null, error: friendlyError(error?.message || 'Failed to save check') }
    }
    checkId = (inserted as { id: string }).id
  }

  if (input.agencies.length > 0) {
    const resultRows = input.agencies.map(a => ({
      check_id: checkId,
      agency_id: a.agency_id,
      agency_name: a.agency_name,
      agency_role: a.agency_role,
      status: a.status,
      notes: a.notes || null,
      sort_order: a.sort_order,
    }))
    const { error: rErr } = await supabase.from('aep_comms_check_results').insert(resultRows as never)
    if (rErr) return { data: null, error: friendlyError(rErr.message) }
  }

  const full = await fetchCheckById(checkId)
  if (!full) return { data: null, error: 'Saved but could not re-fetch check' }

  // Events Log summary
  try {
    const summary = summarizeCommsCheck(full)
    await logActivity(
      'completed',
      'aep_comms',
      full.id,
      undefined,
      { details: summary.toUpperCase() },
      input.baseId,
    )
  } catch (e) {
    console.error('AEP comms summary activity insert failed:', e)
  }

  return { data: full, error: null }
}

export async function deleteCommsCheck(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('aep_comms_checks').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
