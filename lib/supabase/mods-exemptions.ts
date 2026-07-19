import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import type {
  ModsExemptionRecordType,
  ModsExemptionStatus,
  ModsExemptionAttachmentKind,
  ApprovalAuthority,
  ReviewRecommendation,
} from '@/lib/mods-exemptions/constants'
import { nextAnnualReviewDate } from '@/lib/mods-exemptions/constants'

const BUCKET = 'mods-exemptions'
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

// ── Row types ───────────────────────────────────────────────

export type ModsExemptionRow = {
  id: string
  base_id: string
  record_type: ModsExemptionRecordType
  title: string
  status: ModsExemptionStatus
  standard_reference: string
  baseline_summary: string | null
  relief_summary: string | null
  justification: string | null
  public_interest: string | null
  safety_justification: string | null
  mos_category: string | null
  mos_subcategory: string | null
  approval_authority: ApprovalAuthority | null
  agis_tracking: string | null
  docket_number: string | null
  arff_small_airport: boolean
  date_submitted: string | null
  date_decided: string | null
  effective_date: string | null
  expiration_date: string | null
  decision_summary: string | null
  decision_conditions: string | null
  last_reviewed_date: string | null
  next_review_due: string | null
  deviation_date: string | null
  notified_date: string | null
  written_notice_requested: boolean
  written_notice_provided: boolean
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type ModsExemptionReviewRow = {
  id: string
  base_id: string
  record_id: string
  review_date: string
  reviewed_by: string | null
  justification_still_valid: boolean
  recommendation: ReviewRecommendation | null
  notes: string | null
  created_at: string
}

export type ModsExemptionAttachmentRow = {
  id: string
  base_id: string
  record_id: string
  file_path: string
  file_name: string
  file_size_bytes: number | null
  mime_type: string | null
  kind: ModsExemptionAttachmentKind
  caption: string | null
  uploaded_by: string | null
  created_at: string
}

// Editable fields — everything the form writes. created_by / base_id are
// deliberately absent from the update path (the driving-checks lesson:
// an edit must never reassign creator attribution or move a record
// between bases).
export type ModsExemptionInput = {
  record_type: ModsExemptionRecordType
  title: string
  status: ModsExemptionStatus
  standard_reference: string
  baseline_summary?: string | null
  relief_summary?: string | null
  justification?: string | null
  public_interest?: string | null
  safety_justification?: string | null
  mos_category?: string | null
  mos_subcategory?: string | null
  approval_authority?: ApprovalAuthority | null
  agis_tracking?: string | null
  docket_number?: string | null
  arff_small_airport?: boolean
  date_submitted?: string | null
  date_decided?: string | null
  effective_date?: string | null
  expiration_date?: string | null
  decision_summary?: string | null
  decision_conditions?: string | null
  next_review_due?: string | null
  deviation_date?: string | null
  notified_date?: string | null
  written_notice_requested?: boolean
  written_notice_provided?: boolean
  notes?: string | null
}

// ── Reads ───────────────────────────────────────────────────

export async function fetchModsExemptions(baseId: string): Promise<ModsExemptionRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('mods_exemptions')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Failed to fetch mods/exemptions:', error.message)
    return []
  }
  return (data ?? []) as ModsExemptionRow[]
}

/** All reviews at the base in one query (the list page joins client-side). */
export async function fetchModsExemptionReviews(baseId: string): Promise<ModsExemptionReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('mods_exemption_reviews')
    .select('*')
    .eq('base_id', baseId)
    .order('review_date', { ascending: false })
  if (error) {
    console.error('Failed to fetch mods/exemption reviews:', error.message)
    return []
  }
  return (data ?? []) as ModsExemptionReviewRow[]
}

export async function fetchModsExemptionAttachments(baseId: string): Promise<ModsExemptionAttachmentRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('mods_exemption_attachments')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Failed to fetch mods/exemption attachments:', error.message)
    return []
  }
  return (data ?? []) as ModsExemptionAttachmentRow[]
}

export async function getModsExemptionAttachmentUrl(
  storagePath: string,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { url: null, error: 'Supabase not configured' }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 5)
  const url = data?.signedUrl ?? null
  if (url) return { url, error: null }
  return { url: null, error: error?.message ?? 'Could not generate a download link' }
}

// ── Writes ──────────────────────────────────────────────────

export async function createModsExemption(
  baseId: string,
  input: ModsExemptionInput,
): Promise<{ data: ModsExemptionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('mods_exemptions')
    .insert({
      base_id: baseId,
      ...input,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) return { data: null, error: friendlyError(error.message) }
  // Return assembled from the insert response — no re-fetch window.
  return { data: data as ModsExemptionRow, error: null }
}

export async function updateModsExemption(
  id: string,
  input: Partial<ModsExemptionInput>,
): Promise<{ data: ModsExemptionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('mods_exemptions')
    .update({
      ...input,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return { data: null, error: friendlyError(error.message) }
  return { data: data as ModsExemptionRow, error: null }
}

/** Deletes the record row; storage objects are purged best-effort first. */
export async function deleteModsExemption(
  record: ModsExemptionRow,
  attachments: ModsExemptionAttachmentRow[],
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const paths = attachments.filter((a) => a.record_id === record.id).map((a) => a.file_path)
  if (paths.length > 0) {
    // Best-effort: an orphaned object is invisible (private bucket) and
    // harmless; the row delete below CASCADEs the metadata rows.
    await supabase.storage.from(BUCKET).remove(paths)
  }
  const { error } = await supabase.from('mods_exemptions').delete().eq('id', record.id)
  if (error) return { error: friendlyError(error.message) }
  return { error: null }
}

/**
 * Log an annual currency review (5280.5D §2.12.2) and roll the parent's
 * review dates forward. The review row is the durable record; if the
 * parent-date update fails after the insert, surface the error — the next
 * successful review save repairs the dates.
 */
export async function addModsExemptionReview(
  record: ModsExemptionRow,
  input: {
    review_date: string
    justification_still_valid: boolean
    recommendation?: ReviewRecommendation | null
    notes?: string | null
  },
): Promise<{ data: ModsExemptionReviewRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('mods_exemption_reviews')
    .insert({
      base_id: record.base_id,
      record_id: record.id,
      review_date: input.review_date,
      reviewed_by: user?.id ?? null,
      justification_still_valid: input.justification_still_valid,
      recommendation: input.recommendation ?? null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()
  if (error) return { data: null, error: friendlyError(error.message) }

  const { error: parentError } = await supabase
    .from('mods_exemptions')
    .update({
      last_reviewed_date: input.review_date,
      next_review_due: nextAnnualReviewDate(input.review_date),
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', record.id)
  if (parentError) {
    return {
      data: data as ModsExemptionReviewRow,
      error: `Review saved, but the record's review dates were not updated: ${friendlyError(parentError.message)}`,
    }
  }
  return { data: data as ModsExemptionReviewRow, error: null }
}

function storageKey(baseId: string, recordId: string, file: File): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${baseId}/${recordId}/${Date.now()}-${safeName}`
}

/** PDF-only + 25 MB (owner ruling, open question 4 — local-regs parity). */
function validatePdfUpload(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) return 'Only PDF files are accepted.'
  if (file.size > MAX_FILE_SIZE_BYTES) return 'File exceeds the 25 MB limit.'
  return null
}

export async function addModsExemptionAttachment(
  record: ModsExemptionRow,
  file: File,
  kind: ModsExemptionAttachmentKind,
  caption?: string,
): Promise<{ data: ModsExemptionAttachmentRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const validationError = validatePdfUpload(file)
  if (validationError) return { data: null, error: validationError }

  const { data: { user } } = await supabase.auth.getUser()
  const path = storageKey(record.base_id, record.id, file)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/pdf',
    upsert: false,
  })
  if (upErr) return { data: null, error: friendlyError(upErr.message) }

  const { data, error } = await supabase
    .from('mods_exemption_attachments')
    .insert({
      base_id: record.base_id,
      record_id: record.id,
      file_path: path,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || 'application/pdf',
      kind,
      caption: caption?.trim() || null,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) {
    // Row insert failed after the object landed — remove the orphan so a
    // retry doesn't leave a dangling file with no metadata row.
    await supabase.storage.from(BUCKET).remove([path])
    return { data: null, error: friendlyError(error.message) }
  }
  return { data: data as ModsExemptionAttachmentRow, error: null }
}

export async function deleteModsExemptionAttachment(
  row: ModsExemptionAttachmentRow,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('mods_exemption_attachments').delete().eq('id', row.id)
  if (error) return { error: friendlyError(error.message) }
  // Object removal after the row is gone — an orphaned object is invisible
  // and harmless; a dangling row pointing at nothing is not.
  await supabase.storage.from(BUCKET).remove([row.file_path])
  return { error: null }
}
