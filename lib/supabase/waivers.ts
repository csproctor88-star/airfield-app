import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import { resolveBaseId } from './resolve-base-id'
import type {
  WaiverStatus,
  WaiverClassification,
  WaiverHazardRating,
  WaiverActionRequested,
  WaiverCriteriaSource,
  WaiverAttachmentType,
  WaiverReviewRecommendation,
  WaiverCoordinationOffice,
  WaiverCoordinationStatus,
} from './types'

// ─── Row Types (re-export for convenience) ───────────────────

export type WaiverRow = {
  id: string
  base_id: string | null
  waiver_number: string
  classification: WaiverClassification
  status: WaiverStatus
  hazard_rating: WaiverHazardRating | null
  action_requested: WaiverActionRequested | null
  description: string
  justification: string | null
  risk_assessment_summary: string | null
  corrective_action: string | null
  criteria_impact: string | null
  proponent: string | null
  project_number: string | null
  program_fy: number | null
  estimated_cost: number | null
  project_status: string | null
  faa_case_number: string | null
  period_valid: string | null
  date_submitted: string | null
  date_approved: string | null
  expiration_date: string | null
  last_reviewed_date: string | null
  next_review_due: string | null
  location_description: string | null
  location_lat: number | null
  location_lng: number | null
  notes: string | null
  photo_count: number
  attachment_count: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type WaiverCriteriaRow = {
  id: string
  waiver_id: string
  criteria_source: WaiverCriteriaSource
  reference: string | null
  description: string | null
  sort_order: number
}

export type WaiverAttachmentRow = {
  id: string
  waiver_id: string
  file_path: string
  file_name: string
  file_type: WaiverAttachmentType
  file_size: number | null
  mime_type: string | null
  caption: string | null
  uploaded_by: string | null
  created_at: string
}

export type WaiverReviewRow = {
  id: string
  waiver_id: string
  review_year: number
  review_date: string | null
  reviewed_by: string | null
  recommendation: WaiverReviewRecommendation | null
  mitigation_verified: boolean
  project_status_update: string | null
  notes: string | null
  presented_to_facilities_board: boolean
  facilities_board_date: string | null
  created_at: string
}

export type WaiverCoordinationRow = {
  id: string
  waiver_id: string
  office: WaiverCoordinationOffice
  office_label: string | null
  coordinator_name: string | null
  coordinated_date: string | null
  status: WaiverCoordinationStatus
  comments: string | null
}

// ─── Core CRUD ───────────────────────────────────────────────

export async function fetchWaivers(baseId?: string | null): Promise<WaiverRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  let query = supabase
    .from('waivers')
    .select('*')
    .order('created_at', { ascending: false })

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch waivers:', error.message)
    return []
  }

  return data as WaiverRow[]
}

export async function fetchWaiver(id: string): Promise<WaiverRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('waivers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch waiver:', error.message)
    return null
  }

  return data as WaiverRow
}

export async function createWaiver(input: {
  classification: WaiverClassification
  description: string
  waiver_number?: string
  status?: WaiverStatus
  hazard_rating?: WaiverHazardRating | null
  action_requested?: WaiverActionRequested | null
  justification?: string
  risk_assessment_summary?: string
  corrective_action?: string
  criteria_impact?: string
  proponent?: string
  project_number?: string
  program_fy?: number | null
  estimated_cost?: number | null
  project_status?: string
  faa_case_number?: string
  period_valid?: string
  date_submitted?: string | null
  date_approved?: string | null
  expiration_date?: string | null
  location_description?: string
  location_lat?: number | null
  location_lng?: number | null
  notes?: string
  base_id?: string | null
  installation_code?: string | null
}): Promise<{ data: WaiverRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let created_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) created_by = user.id
  } catch {
    // No authenticated user
  }

  // Generate waiver_number: P-CODE-YY-## format
  let waiver_number = input.waiver_number
  if (!waiver_number) {
    const prefix = input.classification === 'permanent' ? 'P'
      : input.classification === 'temporary' ? 'T'
      : input.classification === 'construction' ? 'C'
      : input.classification === 'event' ? 'E'
      : input.classification === 'extension' ? 'X'
      : 'A'
    const code = input.installation_code || 'XXXX'
    const yy = new Date().getFullYear().toString().slice(-2)
    const ts = Date.now().toString(36).slice(-4).toUpperCase()
    waiver_number = `${prefix}-${code}-${yy}-${ts}`
  }

  const row: Record<string, unknown> = {
    waiver_number,
    classification: input.classification,
    status: input.status || 'draft',
    description: input.description,
    hazard_rating: input.hazard_rating || null,
    action_requested: input.action_requested || null,
    justification: input.justification || null,
    risk_assessment_summary: input.risk_assessment_summary || null,
    corrective_action: input.corrective_action || null,
    criteria_impact: input.criteria_impact || null,
    proponent: input.proponent || null,
    project_number: input.project_number || null,
    program_fy: input.program_fy ?? null,
    estimated_cost: input.estimated_cost ?? null,
    project_status: input.project_status || null,
    faa_case_number: input.faa_case_number || null,
    period_valid: input.period_valid || null,
    date_submitted: input.date_submitted || null,
    date_approved: input.date_approved || null,
    expiration_date: input.expiration_date || null,
    location_description: input.location_description || null,
    location_lat: input.location_lat ?? null,
    location_lng: input.location_lng ?? null,
    notes: input.notes || null,
  }
  if (created_by) row.created_by = created_by
  row.base_id = await resolveBaseId(supabase, input.base_id, created_by)

  const { data, error } = await supabase
    .from('waivers')
    .insert(row as never)
    .select()
    .single()

  if (error) {
    console.error('Failed to create waiver:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }

  const created = data as WaiverRow

  return { data: created, error: null }
}

export async function updateWaiver(
  id: string,
  fields: Partial<Omit<WaiverRow, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'photo_count' | 'attachment_count'>>
): Promise<{ data: WaiverRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let updated_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) updated_by = user.id
  } catch {
    // No authenticated user
  }

  const { data, error } = await supabase
    .from('waivers')
    .update({ ...fields, updated_at: new Date().toISOString(), ...(updated_by ? { updated_by } : {}) })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update waiver:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }

  const updated = data as WaiverRow

  return { data: updated, error: null }
}

export async function updateWaiverStatus(
  id: string,
  newStatus: WaiverStatus,
  extra?: { date_approved?: string; expiration_date?: string; date_submitted?: string }
): Promise<{ data: WaiverRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const updateFields: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'pending') {
    updateFields.date_submitted = extra?.date_submitted || new Date().toISOString().split('T')[0]
  }

  if (newStatus === 'approved') {
    updateFields.date_approved = extra?.date_approved || new Date().toISOString().split('T')[0]
    if (extra?.expiration_date) updateFields.expiration_date = extra.expiration_date
  }

  let updated_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      updated_by = user.id
      updateFields.updated_by = user.id
    }
  } catch {
    // No authenticated user
  }

  const { data, error } = await supabase
    .from('waivers')
    .update(updateFields as never)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update waiver status:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }

  const updated = data as WaiverRow

  return { data: updated, error: null }
}

export async function deleteWaiver(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: existing } = await supabase.from('waivers').select('waiver_number, base_id').eq('id', id).single()

  const { error } = await supabase.from('waivers').delete().eq('id', id)

  if (error) {
    console.error('Delete waiver failed:', error.message)
    return { error: friendlyError(error.message) }
  }

  return { error: null }
}

// ─── Criteria ────────────────────────────────────────────────

export async function fetchWaiverCriteria(waiverId: string): Promise<WaiverCriteriaRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_criteria')
    .select('*')
    .eq('waiver_id', waiverId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to fetch waiver criteria:', error.message)
    return []
  }

  return data as WaiverCriteriaRow[]
}

export async function upsertWaiverCriteria(
  waiverId: string,
  criteria: { criteria_source: WaiverCriteriaSource; reference?: string; description?: string; sort_order?: number }[]
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // Delete existing + re-insert (batch upsert). A silently failed delete
  // followed by a successful insert would duplicate every row — stop here.
  const { error: deleteError } = await supabase.from('waiver_criteria').delete().eq('waiver_id', waiverId)
  if (deleteError) {
    console.error('upsertWaiverCriteria: clearing existing criteria failed:', deleteError.message)
    return { error: friendlyError(deleteError.message) }
  }

  if (criteria.length === 0) return { error: null }

  const rows = criteria.map((c, i) => ({
    waiver_id: waiverId,
    criteria_source: c.criteria_source,
    reference: c.reference || null,
    description: c.description || null,
    sort_order: c.sort_order ?? i,
  }))

  const { error } = await supabase.from('waiver_criteria').insert(rows)

  if (error) {
    console.error('Failed to upsert waiver criteria:', error.message)
    return { error: friendlyError(error.message) }
  }

  return { error: null }
}

export async function fetchAllWaiverCriteria(baseId: string): Promise<WaiverCriteriaRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_criteria')
    .select('*, waivers!inner(base_id)')
    .eq('waivers.base_id', baseId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to fetch all waiver criteria:', error.message)
    return []
  }

  return data as WaiverCriteriaRow[]
}

export async function fetchAllWaiverReviews(baseId: string): Promise<WaiverReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_reviews')
    .select('*, waivers!inner(base_id)')
    .eq('waivers.base_id', baseId)
    .order('review_year', { ascending: false })

  if (error) {
    console.error('Failed to fetch all waiver reviews:', error.message)
    return []
  }

  return data as WaiverReviewRow[]
}

/** All coordination rows for a base — used by the records export (avoids N+1). */
export async function fetchAllWaiverCoordination(baseId: string): Promise<WaiverCoordinationRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_coordination')
    .select('*, waivers!inner(base_id)')
    .eq('waivers.base_id', baseId)
    .order('office', { ascending: true })

  if (error) {
    console.error('Failed to fetch all waiver coordination:', error.message)
    return []
  }

  return data as WaiverCoordinationRow[]
}

/** All attachment rows for a base — used by the records export (avoids N+1). */
export async function fetchAllWaiverAttachments(baseId: string): Promise<WaiverAttachmentRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_attachments')
    .select('*, waivers!inner(base_id)')
    .eq('waivers.base_id', baseId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch all waiver attachments:', error.message)
    return []
  }

  return data as WaiverAttachmentRow[]
}

// ─── Attachments ─────────────────────────────────────────────

export async function fetchWaiverAttachments(waiverId: string): Promise<WaiverAttachmentRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_attachments')
    .select('*')
    .eq('waiver_id', waiverId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch waiver attachments:', error.message)
    return []
  }

  return data as WaiverAttachmentRow[]
}

export async function uploadWaiverAttachment(input: {
  waiver_id: string
  file: File
  file_type: WaiverAttachmentType
  caption?: string
}): Promise<{ data: WaiverAttachmentRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let uploaded_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) uploaded_by = user.id
  } catch {
    // No authenticated user
  }

  let { file } = input
  if (file.type.startsWith('image/')) {
    const { resizeImageForUpload } = await import('@/lib/utils')
    file = await resizeImageForUpload(file)
  }

  const ext = file.name.split('.').pop() || 'bin'
  const ts = Date.now()
  const storagePath = `waiver-attachments/${input.waiver_id}/${ts}.${ext}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('waiver-attachments')
    .upload(storagePath, file)

  if (uploadError) {
    console.error('Failed to upload waiver attachment:', uploadError.message)
    return { data: null, error: uploadError.message }
  }

  const row: Record<string, unknown> = {
    waiver_id: input.waiver_id,
    file_path: storagePath,
    file_name: file.name,
    file_type: input.file_type,
    file_size: file.size,
    mime_type: file.type,
    caption: input.caption || null,
  }
  if (uploaded_by) row.uploaded_by = uploaded_by

  const { data, error } = await supabase
    .from('waiver_attachments')
    .insert(row as never)
    .select()
    .single()

  if (error) {
    console.error('Failed to save waiver attachment record:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }

  await recountWaiverAttachments(supabase, input.waiver_id)

  return { data: data as WaiverAttachmentRow, error: null }
}

/** Recompute the denormalized waivers.attachment_count from an exact count.
 * The attachment write itself already succeeded/failed loudly — drift here is
 * display-only, so failures log rather than failing the caller.
 * (The old inline version read `data` from a head:true query — always null —
 * so the counter was never updated at all; this also gives deletes the
 * decrement they never had.) */
async function recountWaiverAttachments(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  waiverId: string,
): Promise<void> {
  const { count, error: countError } = await supabase
    .from('waiver_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('waiver_id', waiverId)
  if (countError || count === null) {
    console.error('recountWaiverAttachments: count query failed:', countError?.message)
    return
  }
  const { error } = await supabase.from('waivers').update({ attachment_count: count }).eq('id', waiverId)
  if (error) console.error('recountWaiverAttachments: attachment_count update failed:', error.message)
}

export async function deleteWaiverAttachment(id: string, waiverId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // Get file path for storage deletion
  const { data: existing } = await supabase.from('waiver_attachments').select('file_path').eq('id', id).single()

  if (existing?.file_path) {
    await supabase.storage.from('waiver-attachments').remove([existing.file_path])
  }

  const { error } = await supabase.from('waiver_attachments').delete().eq('id', id)

  if (error) {
    console.error('Failed to delete waiver attachment:', error.message)
    return { error: friendlyError(error.message) }
  }

  await recountWaiverAttachments(supabase, waiverId)

  return { error: null }
}

// ─── Reviews ─────────────────────────────────────────────────

export async function fetchWaiverReviews(waiverId: string): Promise<WaiverReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_reviews')
    .select('*')
    .eq('waiver_id', waiverId)
    .order('review_year', { ascending: false })

  if (error) {
    console.error('Failed to fetch waiver reviews:', error.message)
    return []
  }

  return data as WaiverReviewRow[]
}

export async function fetchReviewsByYear(baseId: string, year: number): Promise<WaiverReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_reviews')
    .select('*')
    .eq('review_year', year)

  if (error) {
    console.error('Failed to fetch reviews by year:', error.message)
    return []
  }

  return data as WaiverReviewRow[]
}

export async function createWaiverReview(input: {
  waiver_id: string
  review_year: number
  review_date?: string
  recommendation?: WaiverReviewRecommendation
  mitigation_verified?: boolean
  project_status_update?: string
  notes?: string
  presented_to_facilities_board?: boolean
  facilities_board_date?: string
}): Promise<{ data: WaiverReviewRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let reviewed_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) reviewed_by = user.id
  } catch {
    // No authenticated user
  }

  const row: Record<string, unknown> = {
    waiver_id: input.waiver_id,
    review_year: input.review_year,
    review_date: input.review_date || new Date().toISOString().split('T')[0],
    recommendation: input.recommendation || null,
    mitigation_verified: input.mitigation_verified ?? false,
    project_status_update: input.project_status_update || null,
    notes: input.notes || null,
    presented_to_facilities_board: input.presented_to_facilities_board ?? false,
    facilities_board_date: input.facilities_board_date || null,
  }
  if (reviewed_by) row.reviewed_by = reviewed_by

  const { data, error } = await supabase
    .from('waiver_reviews')
    .insert(row as never)
    .select()
    .single()

  if (error) {
    console.error('Failed to create waiver review:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }

  // Update waiver's last_reviewed_date and next_review_due. These dates drive
  // the review-overdue surfacing, so a silent failure here leaves the waiver
  // flagged overdue despite the recorded review. Roll the review row back on
  // failure so a retry can't create duplicates.
  const nextReviewDue = `${input.review_year + 1}-02-01`
  const { error: stampError } = await supabase.from('waivers').update({
    last_reviewed_date: row.review_date as string | null,
    next_review_due: nextReviewDue,
    updated_at: new Date().toISOString(),
  }).eq('id', input.waiver_id)
  if (stampError) {
    console.error('createWaiverReview: waiver review-date update failed:', stampError.message)
    await supabase.from('waiver_reviews').delete().eq('id', (data as WaiverReviewRow).id)
    return { data: null, error: friendlyError(stampError.message) }
  }

  return { data: data as WaiverReviewRow, error: null }
}

export async function deleteWaiverReview(
  id: string,
  waiverId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase
    .from('waiver_reviews')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete waiver review:', error.message)
    return { error: friendlyError(error.message) }
  }

  // Clear last_reviewed_date and next_review_due on the waiver. The review row
  // is already gone (can't roll a delete back), so surface the stale dates.
  const { error: clearError } = await supabase
    .from('waivers')
    .update({ last_reviewed_date: null, next_review_due: null })
    .eq('id', waiverId)
  if (clearError) {
    console.error('deleteWaiverReview: clearing waiver review dates failed:', clearError.message)
    return { error: friendlyError(clearError.message) }
  }

  return { error: null }
}

// ─── Coordination ────────────────────────────────────────────

export async function fetchWaiverCoordination(waiverId: string): Promise<WaiverCoordinationRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('waiver_coordination')
    .select('*')
    .eq('waiver_id', waiverId)
    .order('office', { ascending: true })

  if (error) {
    console.error('Failed to fetch waiver coordination:', error.message)
    return []
  }

  return data as WaiverCoordinationRow[]
}

export async function upsertWaiverCoordination(
  waiverId: string,
  entries: {
    office: WaiverCoordinationOffice
    office_label?: string
    coordinator_name?: string
    coordinated_date?: string
    status?: WaiverCoordinationStatus
    comments?: string
  }[]
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // Delete existing + re-insert. Same duplicate-rows risk as
  // upsertWaiverCriteria — a failed delete must stop the rebuild.
  const { error: deleteError } = await supabase.from('waiver_coordination').delete().eq('waiver_id', waiverId)
  if (deleteError) {
    console.error('upsertWaiverCoordination: clearing existing coordination failed:', deleteError.message)
    return { error: friendlyError(deleteError.message) }
  }

  if (entries.length === 0) return { error: null }

  const rows = entries.map(e => ({
    waiver_id: waiverId,
    office: e.office,
    office_label: e.office_label || null,
    coordinator_name: e.coordinator_name || null,
    coordinated_date: e.coordinated_date || null,
    status: e.status || 'pending',
    comments: e.comments || null,
  }))

  const { error } = await supabase.from('waiver_coordination').insert(rows)

  if (error) {
    console.error('Failed to upsert waiver coordination:', error.message)
    return { error: friendlyError(error.message) }
  }

  return { error: null }
}

export async function updateWaiverCoordination(
  id: string,
  fields: Partial<Omit<WaiverCoordinationRow, 'id' | 'waiver_id'>>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase
    .from('waiver_coordination')
    .update(fields)
    .eq('id', id)

  if (error) {
    console.error('Failed to update waiver coordination:', error.message)
    return { error: friendlyError(error.message) }
  }

  return { error: null }
}

export async function deleteWaiverCoordination(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase
    .from('waiver_coordination')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete waiver coordination:', error.message)
    return { error: friendlyError(error.message) }
  }

  return { error: null }
}
