/**
 * §139.303 Training module — CRUD layer
 *
 * Per 14 CFR Part 139 §139.303(e), the airport must train personnel
 * with movement-area duties on 13 topics and retain records for 24
 * months past the most recent completion. This module is the data
 * layer for the four supporting tables:
 *
 *   training_topics       — system seed (base_id NULL) + base-custom
 *   training_records      — append-only completion log with stored expiry
 *   training_renewals     — explicit supersession chains
 *   training_certificates — AAAE / ACE professional credentials
 *
 * Civilian Part 139 only (gated at module-config layer via
 * appliesTo: ['faa_part139']). A USAF base can opt in by flipping a
 * topic row's applies_to array but AMTR remains the canonical
 * 1C7X1 record.
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

export type TrainingTopic = {
  id: string
  base_id: string | null            // NULL = system seed row
  code: string                       // e.g. '139.303(e)(5)'
  title: string
  description: string | null
  source: string
  applies_to: string[]
  initial_required: boolean
  recurrent_frequency_months: number
  retention_months: number
  material_url: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type TrainingType = 'initial' | 'recurrent' | 'remedial'

export type TrainingRecord = {
  id: string
  base_id: string
  user_id: string
  topic_id: string
  completed_at: string              // YYYY-MM-DD
  training_type: TrainingType
  instructor_user_id: string | null
  instructor_name_external: string | null
  evidence_url: string | null
  expires_at: string | null         // set by trigger from topic frequency
  notes: string | null
  created_at: string
  created_by: string | null
  updated_at: string
}

export type TrainingRenewal = {
  id: string
  base_id: string
  previous_record_id: string
  renewed_record_id: string
  renewed_at: string
}

export type TrainingCredential = 'AAAE-CM' | 'ACE-Ops' | 'ACE-Comm' | 'ACE-Sec' | 'ACE-WHC'

export type TrainingCertificate = {
  id: string
  base_id: string
  user_id: string
  credential: TrainingCredential
  issued_at: string
  expires_at: string | null         // NULL = lifetime credential
  certificate_url: string | null
  notes: string | null
  created_at: string
  created_by: string | null
  updated_at: string
}

export type TrainingStatus = 'current' | 'expiring' | 'expired' | 'not_started'

// ────────────────────────────────────────────────────────────────
// Status classifier — pure function shared by roster, compliance
// matrix, sidebar badge, and the digest cron.
//
// Thresholds (per plan §"Architectural decisions"):
//   > 90 d to expiry → 'current'   (green)
//   30-90 d          → 'expiring'  (amber)
//   < 30 d OR past   → 'expired'   (red)
//   no record        → 'not_started' (grey)
//
// A record with expires_at == null means the topic has no recurrent
// cadence (one-time training) → still 'current' as long as the
// record exists. The trigger normally always sets expires_at, but
// this guard keeps the classifier honest if a topic later sets
// recurrent_frequency_months = 0.
// ────────────────────────────────────────────────────────────────

export function classifyTrainingStatus(
  latestRecord: { expires_at: string | null } | null,
  now: Date = new Date(),
): TrainingStatus {
  if (!latestRecord) return 'not_started'
  if (!latestRecord.expires_at) return 'current'
  const days = daysToExpiry(latestRecord.expires_at, now)
  if (Number.isNaN(days)) return 'current'  // invalid date string
  if (days < 30) return 'expired'
  if (days < 90) return 'expiring'
  return 'current'
}

/**
 * Whole calendar days between today and expiresAt, ignoring time-of-day.
 * Truncates both sides to midnight UTC so a record expiring at
 * 2027-05-26 read at noon on 2027-04-26 returns exactly 30, not 29.5.
 */
export function daysToExpiry(expiresAt: string | Date, now: Date = new Date()): number {
  const exp = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  if (isNaN(exp.getTime())) return NaN
  const nowMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const expMidnightUtc = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate())
  return Math.round((expMidnightUtc - nowMidnightUtc) / 86_400_000)
}

// ────────────────────────────────────────────────────────────────
// Topic CRUD
// ────────────────────────────────────────────────────────────────

/**
 * Fetch system topics (base_id NULL) plus this base's custom topics
 * and overrides, in display order. Filter to active rows only.
 */
export async function fetchTrainingTopics(baseId: string): Promise<TrainingTopic[]> {
  const supabase = db()
  if (!supabase) return []
  const { data } = await supabase
    .from('training_topics')
    .select('*')
    .or(`base_id.is.null,base_id.eq.${baseId}`)
    .eq('active', true)
    .order('sort_order', { ascending: true })
  return ((data || []) as unknown as TrainingTopic[])
}

export async function fetchTopicById(id: string): Promise<TrainingTopic | null> {
  const supabase = db()
  if (!supabase) return null
  const { data } = await supabase.from('training_topics').select('*').eq('id', id).single()
  return data ? (data as unknown as TrainingTopic) : null
}

export async function createCustomTopic(input: {
  base_id: string
  code: string
  title: string
  description?: string | null
  recurrent_frequency_months?: number
  retention_months?: number
  material_url?: string | null
  sort_order?: number
}): Promise<{ ok: boolean; topic?: TrainingTopic; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('training_topics')
    .insert({
      base_id: input.base_id,
      code: input.code,
      title: input.title,
      description: input.description ?? null,
      source: 'Base-specific',
      recurrent_frequency_months: input.recurrent_frequency_months ?? 12,
      retention_months: input.retention_months ?? 24,
      material_url: input.material_url ?? null,
      sort_order: input.sort_order ?? 200,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const topic = data as unknown as TrainingTopic
  logActivity('created', 'training_topic', topic.id, `Training topic ${topic.code} — ${topic.title}`, undefined, input.base_id)
  return { ok: true, topic }
}

/**
 * Override a system topic for this base by cloning it as a base row.
 * The caller passes the system topic id + the overrides; the new row
 * inherits everything else. The system row is unchanged and remains
 * visible to other bases.
 */
export async function createTopicOverride(
  systemTopicId: string,
  baseId: string,
  overrides: Partial<Pick<TrainingTopic,
    | 'recurrent_frequency_months' | 'retention_months' | 'material_url'
    | 'description' | 'sort_order'
  >>,
): Promise<{ ok: boolean; topic?: TrainingTopic; error?: string }> {
  const system = await fetchTopicById(systemTopicId)
  if (!system) return { ok: false, error: 'Source topic not found' }
  if (system.base_id !== null) return { ok: false, error: 'Source is not a system topic' }

  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('training_topics')
    .insert({
      base_id: baseId,
      code: system.code,
      title: system.title,
      description: overrides.description ?? system.description,
      source: system.source,
      applies_to: system.applies_to,
      initial_required: system.initial_required,
      recurrent_frequency_months: overrides.recurrent_frequency_months ?? system.recurrent_frequency_months,
      retention_months: overrides.retention_months ?? system.retention_months,
      material_url: overrides.material_url ?? system.material_url,
      sort_order: overrides.sort_order ?? system.sort_order,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Override failed' }

  const topic = data as unknown as TrainingTopic
  logActivity('created', 'training_topic', topic.id, `Override ${topic.code} for base`, undefined, baseId)
  return { ok: true, topic }
}

export async function updateTopic(
  id: string,
  baseId: string,
  updates: Partial<Pick<TrainingTopic,
    | 'title' | 'description' | 'recurrent_frequency_months' | 'retention_months'
    | 'material_url' | 'sort_order' | 'active'
  >>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('training_topics').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'training_topic', id, 'Updated training topic', undefined, baseId)
  return { ok: true }
}

// ────────────────────────────────────────────────────────────────
// Record CRUD + renewals
// ────────────────────────────────────────────────────────────────

export async function fetchTrainingRecords(opts: {
  base_id: string
  user_id?: string
  topic_id?: string
}): Promise<TrainingRecord[]> {
  const supabase = db()
  if (!supabase) return []
  let q = supabase.from('training_records').select('*').eq('base_id', opts.base_id)
  if (opts.user_id) q = q.eq('user_id', opts.user_id)
  if (opts.topic_id) q = q.eq('topic_id', opts.topic_id)
  const { data } = await q.order('completed_at', { ascending: false })
  return ((data || []) as unknown as TrainingRecord[])
}

/**
 * Log a training completion. If the user has a prior current record
 * for the same topic AND training_type is 'recurrent', the caller
 * should pass `renewPriorRecordId` so a chain link is inserted.
 * (UI auto-detects this; the function itself does not look up the
 * prior — passing it explicitly keeps the writes deterministic.)
 *
 * Caller can optionally pass `id` (pre-generated UUID) when they
 * need it known before the insert — useful when the evidence upload
 * path is built from the record id.
 */
export async function createTrainingRecord(input: {
  id?: string
  base_id: string
  user_id: string
  topic_id: string
  completed_at: string  // YYYY-MM-DD
  training_type: TrainingType
  instructor_user_id?: string | null
  instructor_name_external?: string | null
  evidence_url?: string | null
  notes?: string | null
  renewPriorRecordId?: string | null
}): Promise<{ ok: boolean; record?: TrainingRecord; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const insertRow: Record<string, unknown> = {
    base_id: input.base_id,
    user_id: input.user_id,
    topic_id: input.topic_id,
    completed_at: input.completed_at,
    training_type: input.training_type,
    instructor_user_id: input.instructor_user_id ?? null,
    instructor_name_external: input.instructor_name_external ?? null,
    evidence_url: input.evidence_url ?? null,
    notes: input.notes ?? null,
    created_by: user.id,
  }
  if (input.id) insertRow.id = input.id

  const { data, error } = await supabase
    .from('training_records')
    .insert(insertRow as never)
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const record = data as unknown as TrainingRecord

  // Renewal chain link (best-effort — log but don't fail the insert)
  if (input.renewPriorRecordId && input.training_type === 'recurrent') {
    await supabase.from('training_renewals').insert({
      base_id: input.base_id,
      previous_record_id: input.renewPriorRecordId,
      renewed_record_id: record.id,
    })
  }

  logActivity('created', 'training_record', record.id,
    `Training logged (${input.training_type})`,
    { details: `topic=${input.topic_id.slice(0, 8)}…` },
    input.base_id)
  return { ok: true, record }
}

/**
 * Upload a training-evidence file to the photos bucket under
 *   training-evidence/<base_id>/<user_id>/<record_id>/<filename>
 *
 * Caller pre-generates the record_id (uuid) so the path is stable
 * before the record itself is inserted. Returns a public URL the
 * caller stores on training_records.evidence_url.
 *
 * If the parent record insert fails after a successful upload, the
 * storage file is orphan. Cleanup is a future maintenance sweep.
 */
export async function uploadTrainingEvidence(input: {
  file: File
  base_id: string
  user_id: string
  record_id: string
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const lastDot = input.file.name.lastIndexOf('.')
  const ext = lastDot > 0 ? input.file.name.slice(lastDot + 1).toLowerCase() : 'bin'
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'bin'
  const path = `training-evidence/${input.base_id}/${input.user_id}/${input.record_id}/evidence-${Date.now()}.${safeExt}`
  const { error: upErr } = await supabase.storage.from('photos').upload(path, input.file, { upsert: false, contentType: input.file.type || undefined })
  if (upErr) return { ok: false, error: friendlyError(upErr.message) }
  return { ok: true, url: photoUrl(path) }
}

export async function deleteTrainingRecord(id: string, baseId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { error } = await supabase.from('training_records').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('deleted', 'training_record', id, 'Training record deleted', undefined, baseId)
  return { ok: true }
}

// ────────────────────────────────────────────────────────────────
// Certificate CRUD
// ────────────────────────────────────────────────────────────────

export async function fetchTrainingCertificates(opts: {
  base_id: string
  user_id?: string
}): Promise<TrainingCertificate[]> {
  const supabase = db()
  if (!supabase) return []
  let q = supabase.from('training_certificates').select('*').eq('base_id', opts.base_id)
  if (opts.user_id) q = q.eq('user_id', opts.user_id)
  const { data } = await q.order('issued_at', { ascending: false })
  return ((data || []) as unknown as TrainingCertificate[])
}

export async function createCertificate(input: {
  base_id: string
  user_id: string
  credential: TrainingCredential
  issued_at: string
  expires_at?: string | null
  certificate_url?: string | null
  notes?: string | null
}): Promise<{ ok: boolean; cert?: TrainingCertificate; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('training_certificates')
    .insert({
      base_id: input.base_id,
      user_id: input.user_id,
      credential: input.credential,
      issued_at: input.issued_at,
      expires_at: input.expires_at ?? null,
      certificate_url: input.certificate_url ?? null,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single()
  if (error || !data) return { ok: false, error: error ? friendlyError(error.message) : 'Insert failed' }

  const cert = data as unknown as TrainingCertificate
  logActivity('created', 'training_certificate', cert.id,
    `${cert.credential} certificate logged`, undefined, input.base_id)
  return { ok: true, cert }
}

export async function updateCertificate(
  id: string, baseId: string,
  updates: Partial<Pick<TrainingCertificate, 'issued_at' | 'expires_at' | 'certificate_url' | 'notes'>>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('training_certificates').update(patch as never).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('updated', 'training_certificate', id, 'Certificate updated', undefined, baseId)
  return { ok: true }
}

export async function deleteCertificate(id: string, baseId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { error } = await supabase.from('training_certificates').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('deleted', 'training_certificate', id, 'Certificate deleted', undefined, baseId)
  return { ok: true }
}
