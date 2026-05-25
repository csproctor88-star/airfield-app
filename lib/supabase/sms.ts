/**
 * SMS module — CRUD layer
 *
 * Civilian Part 139 only (gated at the module-config layer). The
 * four AC 150/5200-37A pillars map onto these collections:
 *
 *   Safety Policy          → SmsPolicy
 *   Safety Risk Management → SmsHazard + SmsRiskAssessment + SmsMitigation
 *   Safety Assurance       → SmsSpi + SmsSpiMeasurement + SmsAudit + SmsMoc
 *   Safety Promotion       → SmsSafetyReport + SmsCommunication
 *
 * All writes log to activity_log via logActivity(); failures wrap
 * through friendlyError() so RLS / constraint errors surface as
 * user-readable strings. Demo mode (no Supabase client) returns
 * empty arrays / nulls — the UI degrades gracefully.
 */

import { createClient } from './client'
import { logActivity } from './activity'
import { friendlyError } from '@/lib/utils'

function db() {
  return createClient()
}

// ────────────────────────────────────────────────────────────────
// Type aliases — these mirror the Database['public']['Tables'] rows
// but kept as plain types so callers don't have to import the
// generated Database type. Adjusting the DB schema means updating
// both lib/supabase/types.ts and these aliases.
// ────────────────────────────────────────────────────────────────

export type SmsPolicyStatus = 'draft' | 'active' | 'superseded' | 'retired'
export type SmsPolicy = {
  id: string
  base_id: string
  version: number
  status: SmsPolicyStatus
  effective_date: string | null
  review_due_date: string | null
  document_url: string | null
  safety_objectives: SmsSafetyObjective[]
  employee_reporting_pledge: string | null
  accountable_executive_user_id: string | null
  signed_at: string | null
  signature_image_url: string | null
  replaced_by_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SmsSafetyObjective = {
  id: string
  title: string
  description?: string
}

export type SmsHazardStatus = 'open' | 'under_review' | 'controlled' | 'closed' | 'duplicate'
export type SmsHazardSourceType =
  | 'manual' | 'discrepancy' | 'inspection' | 'wildlife_strike'
  | 'safety_report' | 'audit' | 'moc' | 'reg_review' | 'other'

export type SmsRiskBand = 'low' | 'medium' | 'high' | null

export type SmsHazard = {
  id: string
  base_id: string
  hazard_code: string
  title: string
  description: string | null
  source_type: SmsHazardSourceType
  source_ref_id: string | null
  status: SmsHazardStatus
  closed_at: string | null
  closed_by: string | null
  closure_rationale: string | null
  risk_owner_user_id: string | null
  identified_by: string | null
  identified_at: string
  latest_assessment_id: string | null
  current_band: SmsRiskBand
  residual_band: SmsRiskBand
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SmsRiskAssessment = {
  id: string
  hazard_id: string
  base_id: string
  assessed_at: string
  assessed_by: string | null
  likelihood: number
  severity: number
  risk_index: number
  risk_band: 'low' | 'medium' | 'high'
  residual_likelihood: number | null
  residual_severity: number | null
  residual_risk_index: number
  residual_risk_band: SmsRiskBand
  likelihood_rationale: string | null
  severity_rationale: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SmsMitigationStatus = 'planned' | 'in_progress' | 'completed' | 'rejected' | 'superseded'
export type SmsMitigationControlType =
  | 'elimination' | 'substitution' | 'engineering'
  | 'administrative' | 'ppe' | 'training' | 'other'

export type SmsMitigation = {
  id: string
  hazard_id: string
  base_id: string
  title: string
  description: string | null
  control_type: SmsMitigationControlType
  owner_user_id: string | null
  due_date: string | null
  status: SmsMitigationStatus
  completed_at: string | null
  completed_by: string | null
  evidence_url: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SmsSpi = {
  id: string
  base_id: string
  code: string
  title: string
  description: string | null
  unit: string
  target_value: number | null
  target_direction: 'lower' | 'higher'
  alert_threshold: number | null
  computation_key: string | null
  measurement_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SmsSpiMeasurementStatus = 'on_target' | 'warning' | 'alert' | 'no_data'

export type SmsSpiMeasurement = {
  id: string
  spi_id: string
  base_id: string
  period_start: string
  period_end: string
  value: number
  status: SmsSpiMeasurementStatus
  computed_by: 'manual' | 'cron' | 'rpc'
  notes: string | null
  created_at: string
}

export type SmsAuditStatus = 'scheduled' | 'in_progress' | 'completed' | 'closed' | 'canceled'

export type SmsAuditFinding = {
  id: string
  text: string
  severity?: 'low' | 'medium' | 'high'
  status?: 'open' | 'closed'
  hazard_id?: string
}

export type SmsAudit = {
  id: string
  base_id: string
  audit_code: string
  title: string
  audit_type: 'internal' | 'external' | 'self_assessment'
  scope: string | null
  scheduled_date: string | null
  performed_date: string | null
  performed_by: string | null
  status: SmsAuditStatus
  findings: SmsAuditFinding[]
  findings_open: number
  findings_closed: number
  report_url: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SmsMocStatus =
  | 'proposed' | 'risk_analysis' | 'pending_approval'
  | 'approved' | 'rejected' | 'implemented' | 'closed'

export type SmsMoc = {
  id: string
  base_id: string
  moc_code: string
  title: string
  change_description: string
  change_category: 'operational' | 'organizational' | 'equipment'
    | 'procedural' | 'regulatory' | 'facility' | 'other'
  triggered_by: string | null
  proposed_by: string | null
  proposed_at: string
  effective_date: string | null
  status: SmsMocStatus
  linked_hazard_id: string | null
  risk_analysis_summary: string | null
  approved_by: string | null
  approved_at: string | null
  approval_notes: string | null
  rejection_reason: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type SmsSafetyReportCategory =
  | 'wildlife' | 'runway_incursion' | 'ground_vehicle' | 'aircraft'
  | 'fuel' | 'arff' | 'weather' | 'equipment' | 'procedure' | 'other'

export type SmsSafetyReportTriageStatus =
  | 'new' | 'reviewing' | 'promoted' | 'closed_no_action' | 'duplicate'

export type SmsSafetyReport = {
  id: string
  base_id: string
  report_code: string
  reporter_name: string | null
  reporter_email: string | null
  reporter_phone: string | null
  reporter_role: string | null
  is_anonymous: boolean
  category: SmsSafetyReportCategory
  occurred_at: string | null
  location_text: string | null
  description: string
  immediate_action: string | null
  source: 'public_form' | 'internal' | 'email' | 'phone' | 'walk_in'
  triage_status: SmsSafetyReportTriageStatus
  triaged_by: string | null
  triaged_at: string | null
  promoted_hazard_id: string | null
  triage_notes: string | null
  submitted_at: string
  created_at: string
  updated_at: string
}

export type SmsCommunication = {
  id: string
  base_id: string
  title: string
  body: string
  channel: 'bulletin' | 'newsletter' | 'training' | 'briefing' | 'email' | 'other'
  audience: string | null
  published_at: string | null
  attachment_url: string | null
  related_hazard_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// ────────────────────────────────────────────────────────────────
// Risk band utilities (mirrors _sms_risk_band in 2026052700)
// ────────────────────────────────────────────────────────────────

/** Likelihood label per AC 150/5200-37A Figure 6-2. */
export const LIKELIHOOD_LABELS: Record<number, string> = {
  5: 'Frequent',
  4: 'Probable',
  3: 'Remote',
  2: 'Extremely Remote',
  1: 'Extremely Improbable',
}

/** Severity label per AC 150/5200-37A Figure 6-2. */
export const SEVERITY_LABELS: Record<number, string> = {
  5: 'Catastrophic',
  4: 'Hazardous',
  3: 'Major',
  2: 'Minor',
  1: 'Negligible',
}

/** Risk-band classification mirrors the SQL helper. */
export function classifyRiskBand(likelihood: number, severity: number): 'low' | 'medium' | 'high' {
  const idx = likelihood * severity
  if (idx >= 15) return 'high'
  if (idx >= 7) return 'medium'
  return 'low'
}

/** Band color tokens — used by the matrix UI + chips. */
export const BAND_COLORS: Record<'low' | 'medium' | 'high', { bg: string; border: string; text: string; label: string }> = {
  low:    { bg: 'rgba(34, 197, 94, 0.10)',  border: 'rgba(34, 197, 94, 0.55)',  text: 'rgb(21, 128, 61)',   label: 'Low' },
  medium: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.55)', text: 'rgb(180, 83, 9)',    label: 'Medium' },
  high:   { bg: 'rgba(239, 68, 68, 0.12)',  border: 'rgba(239, 68, 68, 0.65)',  text: 'rgb(185, 28, 28)',   label: 'High' },
}

// ────────────────────────────────────────────────────────────────
// Policy CRUD
// ────────────────────────────────────────────────────────────────

export async function fetchActivePolicy(baseId: string): Promise<SmsPolicy | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase
    .from('sms_policies')
    .select('*')
    .eq('base_id', baseId)
    .eq('status', 'active')
    .maybeSingle()
  return data ? (data as unknown as SmsPolicy) : null
}

export async function fetchPolicyHistory(baseId: string): Promise<SmsPolicy[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('sms_policies')
    .select('*')
    .eq('base_id', baseId)
    .order('version', { ascending: false })
  return ((data || []) as unknown as SmsPolicy[])
}

/**
 * Create a draft policy. New drafts auto-bump version off the
 * highest existing row for the base. Activation happens via
 * sign_sms_policy() RPC — keeps the "active" transition atomic.
 */
export async function createDraftPolicy(input: {
  base_id: string
  document_url?: string | null
  safety_objectives?: SmsSafetyObjective[]
  employee_reporting_pledge?: string | null
  review_due_date?: string | null
}): Promise<{ ok: boolean; policy?: SmsPolicy; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: prior } = await supabase
    .from('sms_policies')
    .select('version')
    .eq('base_id', input.base_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = ((prior as { version?: number } | null)?.version ?? 0) + 1

  const { data, error } = await supabase
    .from('sms_policies')
    .insert({
      base_id: input.base_id,
      version: nextVersion,
      status: 'draft',
      document_url: input.document_url ?? null,
      safety_objectives: (input.safety_objectives ?? []) as unknown as never,
      employee_reporting_pledge: input.employee_reporting_pledge ?? null,
      review_due_date: input.review_due_date ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const policy = data as unknown as SmsPolicy
  logActivity('created', 'sms_policy', policy.id, `Safety Policy v${policy.version}`, { details: 'DRAFT' }, input.base_id)
  return { ok: true, policy }
}

export async function updateDraftPolicy(
  id: string,
  baseId: string,
  updates: Partial<Pick<SmsPolicy,
    | 'document_url' | 'safety_objectives' | 'employee_reporting_pledge'
    | 'review_due_date'
  >>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()

  const patch: Record<string, unknown> = { ...updates, updated_by: user?.id, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('sms_policies').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_policy', id, 'Safety Policy draft', undefined, baseId)
  return { ok: true }
}

/**
 * Sign + activate a draft policy. Calls the SECURITY DEFINER RPC
 * so the AE-only enforcement and the supersede-prior-active step
 * land atomically. Caller must hold sms:sign_policy.
 */
export async function signPolicy(input: {
  policyId: string
  baseId: string
  effectiveDate: string
  signatureImageUrl?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('sign_sms_policy', {
    p_policy_id: input.policyId,
    p_effective_date: input.effectiveDate,
    p_signature_image_url: input.signatureImageUrl ?? null,
  })
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_policy', input.policyId, 'Safety Policy ACTIVATED', { details: 'Signed by AE' }, input.baseId)
  return { ok: true }
}

// ────────────────────────────────────────────────────────────────
// Hazard CRUD
// ────────────────────────────────────────────────────────────────

export async function fetchHazards(baseId: string, opts?: { status?: SmsHazardStatus }): Promise<SmsHazard[]> {
  const supabase = db()
  if (!supabase) return []
  let q = supabase.from('sms_hazards').select('*').eq('base_id', baseId)
  if (opts?.status) q = q.eq('status', opts.status)
  const { data } = await q.order('identified_at', { ascending: false })
  return ((data || []) as unknown as SmsHazard[])
}

export async function fetchHazard(hazardId: string): Promise<SmsHazard | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase.from('sms_hazards').select('*').eq('id', hazardId).single()
  return data ? (data as unknown as SmsHazard) : null
}

export async function createHazard(input: {
  base_id: string
  title: string
  description?: string | null
  source_type?: SmsHazardSourceType
  source_ref_id?: string | null
  risk_owner_user_id?: string | null
}): Promise<{ ok: boolean; hazard?: SmsHazard; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  // Mint hazard_code via RPC (serializes the COUNT-based numbering)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: codeData, error: codeErr } = await (supabase as any).rpc('_sms_next_code', {
    p_base_id: input.base_id,
    p_prefix: 'HZ',
    p_table: 'sms_hazards',
  })
  if (codeErr || !codeData) return { ok: false, error: codeErr ? friendlyError(codeErr.message) : 'Code mint failed' }

  const { data, error } = await supabase
    .from('sms_hazards')
    .insert({
      base_id: input.base_id,
      hazard_code: codeData as unknown as string,
      title: input.title,
      description: input.description ?? null,
      source_type: input.source_type ?? 'manual',
      source_ref_id: input.source_ref_id ?? null,
      risk_owner_user_id: input.risk_owner_user_id ?? null,
      identified_by: user.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const hazard = data as unknown as SmsHazard
  // Ensure default SPIs exist (idempotent — first-hazard side effect)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('_sms_seed_default_spis', { p_base_id: input.base_id })

  logActivity('created', 'sms_hazard', hazard.id, hazard.hazard_code, { details: hazard.title }, input.base_id)
  return { ok: true, hazard }
}

export async function updateHazard(
  id: string,
  baseId: string,
  updates: Partial<Pick<SmsHazard,
    | 'title' | 'description' | 'status' | 'risk_owner_user_id'
    | 'closure_rationale' | 'closed_at' | 'closed_by'
  >>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()

  const patch: Record<string, unknown> = {
    ...updates,
    updated_by: user?.id,
    updated_at: new Date().toISOString(),
  }
  // Auto-stamp closure when status flips to closed
  if (updates.status === 'closed' && !updates.closed_at) {
    patch.closed_at = new Date().toISOString()
    patch.closed_by = user?.id
  }
  const { error } = await supabase.from('sms_hazards').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_hazard', id, 'Hazard', undefined, baseId)
  return { ok: true }
}

export async function deleteHazard(id: string, hazardCode: string, baseId: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false
  const { error } = await supabase.from('sms_hazards').delete().eq('id', id)
  if (!error) logActivity('deleted', 'sms_hazard', id, hazardCode, undefined, baseId)
  return !error
}

// ────────────────────────────────────────────────────────────────
// Risk assessments (the 5×5 matrix snapshots)
// ────────────────────────────────────────────────────────────────

export async function fetchAssessments(hazardId: string): Promise<SmsRiskAssessment[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('sms_risk_assessments')
    .select('*')
    .eq('hazard_id', hazardId)
    .order('assessed_at', { ascending: false })
  return ((data || []) as unknown as SmsRiskAssessment[])
}

export async function createAssessment(input: {
  hazard_id: string
  base_id: string
  likelihood: number
  severity: number
  residual_likelihood?: number | null
  residual_severity?: number | null
  likelihood_rationale?: string | null
  severity_rationale?: string | null
  notes?: string | null
}): Promise<{ ok: boolean; assessment?: SmsRiskAssessment; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  if (input.likelihood < 1 || input.likelihood > 5 || input.severity < 1 || input.severity > 5) {
    return { ok: false, error: 'Likelihood and severity must be between 1 and 5' }
  }

  const { data, error } = await supabase
    .from('sms_risk_assessments')
    .insert({
      hazard_id: input.hazard_id,
      base_id: input.base_id,
      likelihood: input.likelihood,
      severity: input.severity,
      residual_likelihood: input.residual_likelihood ?? null,
      residual_severity: input.residual_severity ?? null,
      likelihood_rationale: input.likelihood_rationale ?? null,
      severity_rationale: input.severity_rationale ?? null,
      notes: input.notes ?? null,
      assessed_by: user.id,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const assessment = data as unknown as SmsRiskAssessment
  logActivity(
    'updated', 'sms_hazard', input.hazard_id,
    `Risk assessed L${input.likelihood} × S${input.severity}`,
    { details: `Risk band: ${assessment.risk_band.toUpperCase()}` },
    input.base_id,
  )
  return { ok: true, assessment }
}

// ────────────────────────────────────────────────────────────────
// Mitigations
// ────────────────────────────────────────────────────────────────

export async function fetchMitigations(hazardId: string): Promise<SmsMitigation[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('sms_mitigations')
    .select('*')
    .eq('hazard_id', hazardId)
    .order('due_date', { ascending: true, nullsFirst: false })
  return ((data || []) as unknown as SmsMitigation[])
}

export async function fetchOpenMitigations(baseId: string): Promise<SmsMitigation[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('sms_mitigations')
    .select('*')
    .eq('base_id', baseId)
    .in('status', ['planned', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false })
  return ((data || []) as unknown as SmsMitigation[])
}

export async function createMitigation(input: {
  hazard_id: string
  base_id: string
  title: string
  description?: string | null
  control_type?: SmsMitigationControlType
  owner_user_id?: string | null
  due_date?: string | null
}): Promise<{ ok: boolean; mitigation?: SmsMitigation; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('sms_mitigations')
    .insert({
      hazard_id: input.hazard_id,
      base_id: input.base_id,
      title: input.title,
      description: input.description ?? null,
      control_type: input.control_type ?? 'administrative',
      owner_user_id: input.owner_user_id ?? null,
      due_date: input.due_date ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const mitigation = data as unknown as SmsMitigation
  logActivity('created', 'sms_mitigation', mitigation.id, mitigation.title, undefined, input.base_id)
  return { ok: true, mitigation }
}

export async function updateMitigation(
  id: string,
  baseId: string,
  updates: Partial<Pick<SmsMitigation,
    | 'title' | 'description' | 'control_type' | 'owner_user_id'
    | 'due_date' | 'status' | 'evidence_url' | 'notes'
  >>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()

  const patch: Record<string, unknown> = {
    ...updates,
    updated_by: user?.id,
    updated_at: new Date().toISOString(),
  }
  if (updates.status === 'completed') {
    patch.completed_at = new Date().toISOString()
    patch.completed_by = user?.id
  }
  const { error } = await supabase.from('sms_mitigations').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_mitigation', id, 'Mitigation', undefined, baseId)
  return { ok: true }
}

export async function deleteMitigation(id: string, baseId: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false
  const { error } = await supabase.from('sms_mitigations').delete().eq('id', id)
  if (!error) logActivity('deleted', 'sms_mitigation', id, 'Mitigation', undefined, baseId)
  return !error
}

// ────────────────────────────────────────────────────────────────
// SPIs + measurements
// ────────────────────────────────────────────────────────────────

export async function fetchSpis(baseId: string): Promise<SmsSpi[]> {
  const supabase = db()
  if (!supabase) return []
  // Seed defaults idempotently on first fetch so the dashboard always
  // has cards to render even if the base has zero hazards yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('_sms_seed_default_spis', { p_base_id: baseId })
  const { data } = await supabase
    .from('sms_spis')
    .select('*')
    .eq('base_id', baseId)
    .order('code', { ascending: true })
  return ((data || []) as unknown as SmsSpi[])
}

export async function fetchSpiMeasurements(
  spiId: string,
  opts?: { months?: number },
): Promise<SmsSpiMeasurement[]> {
  const supabase = db()
  if (!supabase) return []
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - (opts?.months ?? 12))
  const { data } = await supabase
    .from('sms_spi_measurements')
    .select('*')
    .eq('spi_id', spiId)
    .gte('period_start', cutoff.toISOString().slice(0, 10))
    .order('period_start', { ascending: true })
  return ((data || []) as unknown as SmsSpiMeasurement[])
}

export async function fetchLatestMeasurements(baseId: string): Promise<Map<string, SmsSpiMeasurement>> {
  const supabase = db()
  const out = new Map<string, SmsSpiMeasurement>()
  if (!supabase) return out
  const { data } = await supabase
    .from('sms_spi_measurements')
    .select('*')
    .eq('base_id', baseId)
    .order('period_start', { ascending: false })
  for (const row of ((data || []) as unknown as SmsSpiMeasurement[])) {
    if (!out.has(row.spi_id)) out.set(row.spi_id, row)
  }
  return out
}

/** Trigger the nightly compute path on demand (admin / manual refresh). */
export async function recomputeSpisNow(baseId: string): Promise<{ ok: boolean; computed?: number; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  // The RPC iterates every active civilian base — caller intent is "refresh
  // mine" but the RPC is global; still cheap at small fleet scale.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('_sms_compute_spi_measurements', {
    p_target_date: new Date().toISOString().slice(0, 10),
  })
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_spis', baseId, 'SPIs recomputed', { details: `${data} measurement(s) written` }, baseId)
  return { ok: true, computed: (data as number) ?? 0 }
}

// ────────────────────────────────────────────────────────────────
// Audits + MoC
// ────────────────────────────────────────────────────────────────

export async function fetchAudits(baseId: string): Promise<SmsAudit[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('sms_audits')
    .select('*')
    .eq('base_id', baseId)
    .order('scheduled_date', { ascending: false, nullsFirst: false })
  return ((data || []) as unknown as SmsAudit[])
}

export async function createAudit(input: {
  base_id: string
  title: string
  audit_type?: 'internal' | 'external' | 'self_assessment'
  scope?: string | null
  scheduled_date?: string | null
}): Promise<{ ok: boolean; audit?: SmsAudit; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: codeData, error: codeErr } = await (supabase as any).rpc('_sms_next_code', {
    p_base_id: input.base_id,
    p_prefix: 'AUDIT',
    p_table: 'sms_audits',
  })
  if (codeErr || !codeData) return { ok: false, error: codeErr ? friendlyError(codeErr.message) : 'Code mint failed' }

  const { data, error } = await supabase
    .from('sms_audits')
    .insert({
      base_id: input.base_id,
      audit_code: codeData as unknown as string,
      title: input.title,
      audit_type: input.audit_type ?? 'internal',
      scope: input.scope ?? null,
      scheduled_date: input.scheduled_date ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }
  const audit = data as unknown as SmsAudit
  logActivity('created', 'sms_audit', audit.id, audit.audit_code, { details: audit.title }, input.base_id)
  return { ok: true, audit }
}

export async function updateAudit(
  id: string,
  baseId: string,
  updates: Partial<SmsAudit>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const patch: Record<string, unknown> = {
    ...updates,
    updated_by: user?.id,
    updated_at: new Date().toISOString(),
  }
  // Recompute findings open/closed counts from JSONB if present
  if (updates.findings) {
    patch.findings_open = updates.findings.filter(f => f.status !== 'closed').length
    patch.findings_closed = updates.findings.filter(f => f.status === 'closed').length
  }
  const { error } = await supabase.from('sms_audits').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_audit', id, 'Audit', undefined, baseId)
  return { ok: true }
}

// ── MoC ────────────────────────────────────────────────────────

export async function fetchMocs(baseId: string): Promise<SmsMoc[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('sms_management_of_change')
    .select('*')
    .eq('base_id', baseId)
    .order('proposed_at', { ascending: false })
  return ((data || []) as unknown as SmsMoc[])
}

export async function createMoc(input: {
  base_id: string
  title: string
  change_description: string
  change_category?: SmsMoc['change_category']
  effective_date?: string | null
  triggered_by?: string | null
  linked_hazard_id?: string | null
}): Promise<{ ok: boolean; moc?: SmsMoc; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: codeData, error: codeErr } = await (supabase as any).rpc('_sms_next_code', {
    p_base_id: input.base_id,
    p_prefix: 'MOC',
    p_table: 'sms_management_of_change',
  })
  if (codeErr || !codeData) return { ok: false, error: codeErr ? friendlyError(codeErr.message) : 'Code mint failed' }

  const { data, error } = await supabase
    .from('sms_management_of_change')
    .insert({
      base_id: input.base_id,
      moc_code: codeData as unknown as string,
      title: input.title,
      change_description: input.change_description,
      change_category: input.change_category ?? 'operational',
      effective_date: input.effective_date ?? null,
      triggered_by: input.triggered_by ?? null,
      linked_hazard_id: input.linked_hazard_id ?? null,
      proposed_by: user.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }
  const moc = data as unknown as SmsMoc
  logActivity('created', 'sms_moc', moc.id, moc.moc_code, { details: moc.title }, input.base_id)
  return { ok: true, moc }
}

export async function updateMoc(
  id: string,
  baseId: string,
  updates: Partial<Pick<SmsMoc,
    | 'title' | 'change_description' | 'change_category' | 'effective_date'
    | 'triggered_by' | 'linked_hazard_id' | 'risk_analysis_summary' | 'status'
  >>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const patch: Record<string, unknown> = {
    ...updates,
    updated_by: user?.id,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('sms_management_of_change').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_moc', id, 'MoC', undefined, baseId)
  return { ok: true }
}

export async function approveMoc(input: {
  mocId: string
  baseId: string
  notes?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('approve_sms_moc', {
    p_moc_id: input.mocId,
    p_approval_notes: input.notes ?? null,
  })
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_moc', input.mocId, 'MoC APPROVED', { details: 'AE approval' }, input.baseId)
  return { ok: true }
}

export async function rejectMoc(input: {
  mocId: string
  baseId: string
  reason: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('reject_sms_moc', {
    p_moc_id: input.mocId,
    p_rejection_reason: input.reason,
  })
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_moc', input.mocId, 'MoC REJECTED', { details: `Reason: ${input.reason}` }, input.baseId)
  return { ok: true }
}

// ────────────────────────────────────────────────────────────────
// Safety Reports
// ────────────────────────────────────────────────────────────────

export async function fetchSafetyReports(
  baseId: string,
  opts?: { triageStatus?: SmsSafetyReportTriageStatus },
): Promise<SmsSafetyReport[]> {
  const supabase = db()
  if (!supabase) return []
  let q = supabase.from('sms_safety_reports').select('*').eq('base_id', baseId)
  if (opts?.triageStatus) q = q.eq('triage_status', opts.triageStatus)
  const { data } = await q.order('submitted_at', { ascending: false })
  return ((data || []) as unknown as SmsSafetyReport[])
}

export async function fetchSafetyReport(id: string): Promise<SmsSafetyReport | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase.from('sms_safety_reports').select('*').eq('id', id).single()
  return data ? (data as unknown as SmsSafetyReport) : null
}

export async function updateSafetyReportTriage(input: {
  reportId: string
  baseId: string
  triage_status: SmsSafetyReportTriageStatus
  triage_notes?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('sms_safety_reports')
    .update({
      triage_status: input.triage_status,
      triage_notes: input.triage_notes ?? null,
      triaged_by: user?.id ?? null,
      triaged_at: new Date().toISOString(),
    } as never)
    .eq('id', input.reportId)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'sms_safety_report', input.reportId, `Triage ${input.triage_status.toUpperCase()}`, undefined, input.baseId)
  return { ok: true }
}

/** Promote a safety report to a hazard via the SECURITY DEFINER RPC. */
export async function promoteSafetyReportToHazard(input: {
  reportId: string
  baseId: string
  title?: string | null
  description?: string | null
  triageNotes?: string | null
}): Promise<{ ok: boolean; hazardId?: string; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('promote_safety_report_to_hazard', {
    p_report_id: input.reportId,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_triage_notes: input.triageNotes ?? null,
  })
  if (error) return { ok: false, error: friendlyError(error.message) }
  const hazardId = (data as { hazard_id?: string } | null)?.hazard_id
  logActivity('updated', 'sms_safety_report', input.reportId, 'Promoted to Hazard', { details: hazardId ? `Hazard ${hazardId}` : undefined }, input.baseId)
  return { ok: true, hazardId }
}

// ────────────────────────────────────────────────────────────────
// Communications
// ────────────────────────────────────────────────────────────────

export async function fetchCommunications(baseId: string): Promise<SmsCommunication[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('sms_communications')
    .select('*')
    .eq('base_id', baseId)
    .order('published_at', { ascending: false, nullsFirst: true })
  return ((data || []) as unknown as SmsCommunication[])
}

export async function createCommunication(input: {
  base_id: string
  title: string
  body: string
  channel?: SmsCommunication['channel']
  audience?: string | null
  published_at?: string | null
  related_hazard_id?: string | null
}): Promise<{ ok: boolean; communication?: SmsCommunication; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('sms_communications')
    .insert({
      base_id: input.base_id,
      title: input.title,
      body: input.body,
      channel: input.channel ?? 'bulletin',
      audience: input.audience ?? null,
      published_at: input.published_at ?? null,
      related_hazard_id: input.related_hazard_id ?? null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }
  const c = data as unknown as SmsCommunication
  logActivity('created', 'sms_communication', c.id, c.title, undefined, input.base_id)
  return { ok: true, communication: c }
}

// ────────────────────────────────────────────────────────────────
// AE dashboard summary — one query for the four-card hero
// ────────────────────────────────────────────────────────────────

export type SmsAeSummary = {
  policyCurrent: boolean
  policyEffectiveDate: string | null
  policyReviewDueDate: string | null
  hazardsByBand: { low: number; medium: number; high: number; unassessed: number }
  hazardsTotal: number
  spisInAlert: number
  spisInWarning: number
  spisTotal: number
  openMocs: number
  pendingMocApproval: number
  openSafetyReports: number
}

export async function fetchAeSummary(baseId: string): Promise<SmsAeSummary> {
  const supabase = db()
  const empty: SmsAeSummary = {
    policyCurrent: false,
    policyEffectiveDate: null,
    policyReviewDueDate: null,
    hazardsByBand: { low: 0, medium: 0, high: 0, unassessed: 0 },
    hazardsTotal: 0,
    spisInAlert: 0,
    spisInWarning: 0,
    spisTotal: 0,
    openMocs: 0,
    pendingMocApproval: 0,
    openSafetyReports: 0,
  }
  if (!supabase) return empty

  const [policy, hazards, spis, mocs, reports, latestMeas] = await Promise.all([
    fetchActivePolicy(baseId),
    fetchHazards(baseId),
    fetchSpis(baseId),
    fetchMocs(baseId),
    fetchSafetyReports(baseId),
    fetchLatestMeasurements(baseId),
  ])

  const bandCounts = hazards.reduce(
    (acc, h) => {
      const band = (h.residual_band || h.current_band) as 'low' | 'medium' | 'high' | null
      if (!band) acc.unassessed += 1
      else acc[band] += 1
      return acc
    },
    { low: 0, medium: 0, high: 0, unassessed: 0 },
  )

  let spisInAlert = 0
  let spisInWarning = 0
  for (const spi of spis) {
    const m = latestMeas.get(spi.id)
    if (m?.status === 'alert') spisInAlert += 1
    else if (m?.status === 'warning') spisInWarning += 1
  }

  const openMocs = mocs.filter(m =>
    !['approved', 'rejected', 'implemented', 'closed'].includes(m.status),
  ).length
  const pendingMocApproval = mocs.filter(m => m.status === 'pending_approval').length

  const openReports = reports.filter(r => r.triage_status === 'new' || r.triage_status === 'reviewing').length

  return {
    policyCurrent: Boolean(policy),
    policyEffectiveDate: policy?.effective_date ?? null,
    policyReviewDueDate: policy?.review_due_date ?? null,
    hazardsByBand: bandCounts,
    hazardsTotal: hazards.length,
    spisInAlert,
    spisInWarning,
    spisTotal: spis.length,
    openMocs,
    pendingMocApproval,
    openSafetyReports: openReports,
  }
}
