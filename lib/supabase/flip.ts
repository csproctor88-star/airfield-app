// lib/supabase/flip.ts
import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FlipRole, FlipSignSlot } from '@/lib/flip/roles'

function db(): SupabaseClient | null {
  return createClient() as unknown as SupabaseClient | null
}

// ===== Types =====
export type FlipSectionKey =
  | 'acct_info' | 'appt_letter' | 'ordering' | 'responsibilities' | 'change_directions'

export type FlipTextSection = { id: string; base_id: string; section_key: FlipSectionKey; content: string; updated_at: string; updated_by: string | null }
export type FlipListItem = { id: string; base_id: string; title: string; sort_order: number; created_at: string }
export type FlipReference = { id: string; base_id: string; title: string; file_type: 'pdf'|'docx'|'pptx'|'xlsx'|'other'; storage_path: string; uploaded_by: string | null; uploaded_at: string }
export type FlipStage = 'coordination' | 'submitted' | 'completed'
export type FlipChange = {
  id: string; base_id: string; flip_title: string; notam: string | null; details: string | null
  reference_doc_page: string | null
  additions: string | null; deletions: string | null; revisions_from: string | null; revisions_to: string | null
  submitted_by_name: string; submitted_by_user: string | null
  stage: FlipStage; rejected: boolean
  afm_approved_by: string | null; afm_approved_at: string | null
  creation_date: string | null; processed_date: string | null; published_date: string | null
  posted_initials: string | null; posted_date: string | null
  pdf_filename: string | null; pdf_storage_path: string | null
  coordinated_at: string; updated_at: string
}
export type FlipReview = { id: string; base_id: string; cycle: string; review_date: string; created_by: string | null; created_at: string }
export type FlipReviewItem = {
  id: string; review_id: string; base_id: string; flip_title: string; effective_date: string | null
  discrepancy: boolean; discrepancy_note: string | null; corrective_action: string | null
  date_corrected: string | null; sort_order: number
}
export type FlipSignoff = {
  id: string; review_id: string; base_id: string
  custodian_signed_by: string | null; custodian_signed_at: string | null
  namo_signed_by: string | null; namo_signed_at: string | null
  afm_signed_by: string | null; afm_signed_at: string | null
}
export type FlipRoleAssignment = { id: string; base_id: string; user_id: string; role: FlipRole; created_at: string }
export type FlipChangeEventType = 'coordinated' | 'afm_approved' | 'processed' | 'published' | 'rejected'
export type FlipChangeEvent = {
  id: string; change_id: string; base_id: string; event_type: FlipChangeEventType
  actor_user_id: string | null; actor_name: string | null; remarks: string | null; created_at: string
}
export type FlipCustodian = { name: string; role: 'primary' | 'alternate' }
export type FlipAppointment = {
  id: string; base_id: string; file_path: string | null; file_name: string | null
  custodians: FlipCustodian[]; notes: string | null; updated_at: string; updated_by: string | null
}

// ===== Text sections =====
export async function fetchFlipTextSections(baseId: string): Promise<FlipTextSection[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_text_sections').select('*').eq('base_id', baseId)
  if (error) { console.error('fetchFlipTextSections:', error.message); return [] }
  return (data ?? []) as FlipTextSection[]
}
export async function saveFlipTextSection(baseId: string, key: FlipSectionKey, content: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_text_sections')
    .upsert({ base_id: baseId, section_key: key, content, updated_at: new Date().toISOString() } as never,
      { onConflict: 'base_id,section_key' })
  return { error: error ? friendlyError(error.message) : null }
}

// ===== FLIP list =====
export async function fetchFlipList(baseId: string): Promise<FlipListItem[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_list').select('*').eq('base_id', baseId).order('sort_order')
  if (error) { console.error('fetchFlipList:', error.message); return [] }
  return (data ?? []) as FlipListItem[]
}
export async function addFlipListItem(baseId: string, title: string, sortOrder: number): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_list').insert({ base_id: baseId, title, sort_order: sortOrder } as never)
  return { error: error ? friendlyError(error.message) : null }
}
export async function removeFlipListItem(id: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_list').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

// ===== References =====
export async function fetchFlipReferences(baseId: string): Promise<FlipReference[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_references').select('*').eq('base_id', baseId).order('uploaded_at', { ascending: false })
  if (error) { console.error('fetchFlipReferences:', error.message); return [] }
  return (data ?? []) as FlipReference[]
}
export async function addFlipReference(input: { baseId: string; title: string; fileType: FlipReference['file_type']; storagePath: string }): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_references')
    .insert({ base_id: input.baseId, title: input.title, file_type: input.fileType, storage_path: input.storagePath } as never)
  return { error: error ? friendlyError(error.message) : null }
}
export async function removeFlipReference(id: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_references').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

// ===== Appointment letter =====
export async function fetchFlipAppointment(baseId: string): Promise<FlipAppointment | null> {
  const supabase = db(); if (!supabase) return null
  const { data, error } = await supabase.from('flip_appointment').select('*').eq('base_id', baseId).maybeSingle()
  if (error) { console.error('fetchFlipAppointment:', error.message); return null }
  return (data as FlipAppointment) ?? null
}
export async function saveFlipAppointment(baseId: string, input: { filePath: string | null; fileName: string | null; custodians: FlipCustodian[]; notes: string | null }): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('flip_appointment').upsert({
    base_id: baseId, file_path: input.filePath, file_name: input.fileName,
    custodians: input.custodians, notes: input.notes,
    updated_at: new Date().toISOString(), updated_by: user?.id ?? null,
  } as never, { onConflict: 'base_id' })
  return { error: error ? friendlyError(error.message) : null }
}

// ===== Changes =====
export async function fetchFlipChanges(baseId: string): Promise<FlipChange[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_changes').select('*').eq('base_id', baseId).order('coordinated_at', { ascending: false })
  if (error) { console.error('fetchFlipChanges:', error.message); return [] }
  return (data ?? []) as FlipChange[]
}
export async function createFlipChange(input: {
  baseId: string; flipTitle: string; notam: string; name: string; details?: string; remarks?: string
  referenceDocPage?: string | null; additions?: string | null; deletions?: string | null
  revisionsFrom?: string | null; revisionsTo?: string | null
}): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { data: row, error } = await supabase.from('flip_changes').insert({
    base_id: input.baseId, flip_title: input.flipTitle, notam: input.notam || null,
    details: input.details || null, submitted_by_name: input.name, submitted_by_user: user?.id ?? null,
    reference_doc_page: input.referenceDocPage || null,
    additions: input.additions || null, deletions: input.deletions || null,
    revisions_from: input.revisionsFrom || null, revisions_to: input.revisionsTo || null,
  } as never).select('id').single()
  if (error || !row) return { error: friendlyError(error?.message ?? 'Failed to coordinate change') }
  // Seed the coordination history with the create event + its remark. The
  // timeline without its create entry (and the operator's remark) is silently
  // wrong — roll the change back on failure so a retry starts clean.
  const { error: seedError } = await supabase.from('flip_change_events').insert({
    change_id: (row as { id: string }).id, base_id: input.baseId, event_type: 'coordinated',
    actor_user_id: user?.id ?? null, actor_name: input.name, remarks: input.remarks?.trim() || null,
  } as never)
  if (seedError) {
    console.error('createFlipChange: seeding coordination history failed:', seedError.message)
    await supabase.from('flip_changes').delete().eq('id', (row as { id: string }).id)
    return { error: friendlyError(seedError.message) }
  }
  return { error: null }
}
export async function updateFlipChange(id: string, patch: Partial<FlipChange>): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_changes').update({ ...patch, updated_at: new Date().toISOString() } as never).eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
export async function approveFlipChange(id: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('flip_changes').update({
    stage: 'submitted', afm_approved_by: user?.id ?? null, afm_approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  } as never).eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

// ===== Change history (coordination timeline) =====
/** Resolve the current user's display name (rank + name) for history snapshots. */
async function resolveActorName(supabase: SupabaseClient, userId: string | undefined): Promise<string | null> {
  if (!userId) return null
  const { data } = await supabase.from('profiles').select('name, rank').eq('id', userId).single()
  const p = data as { name?: string; rank?: string } | null
  const nm = p?.name?.trim() || ''
  const rk = p?.rank?.trim() || ''
  return rk && nm ? `${rk} ${nm}` : (nm || null)
}
export async function fetchFlipChangeEvents(baseId: string): Promise<FlipChangeEvent[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_change_events').select('*').eq('base_id', baseId).order('created_at', { ascending: true })
  if (error) { console.error('fetchFlipChangeEvents:', error.message); return [] }
  return (data ?? []) as FlipChangeEvent[]
}
export async function logFlipChangeEvent(input: { changeId: string; baseId: string; eventType: FlipChangeEventType; remarks?: string | null }): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const actorName = await resolveActorName(supabase, user?.id)
  const { error } = await supabase.from('flip_change_events').insert({
    change_id: input.changeId, base_id: input.baseId, event_type: input.eventType,
    actor_user_id: user?.id ?? null, actor_name: actorName, remarks: input.remarks?.trim() || null,
  } as never)
  return { error: error ? friendlyError(error.message) : null }
}

// ===== Reviews =====
export async function fetchFlipReviews(baseId: string): Promise<FlipReview[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_reviews').select('*').eq('base_id', baseId).order('review_date', { ascending: false })
  if (error) { console.error('fetchFlipReviews:', error.message); return [] }
  return (data ?? []) as FlipReview[]
}
export async function fetchFlipReviewItems(reviewId: string): Promise<FlipReviewItem[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_review_items').select('*').eq('review_id', reviewId).order('sort_order')
  if (error) { console.error('fetchFlipReviewItems:', error.message); return [] }
  return (data ?? []) as FlipReviewItem[]
}
export async function fetchFlipSignoffs(baseId: string): Promise<FlipSignoff[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_review_signoffs').select('*').eq('base_id', baseId)
  if (error) { console.error('fetchFlipSignoffs:', error.message); return [] }
  return (data ?? []) as FlipSignoff[]
}
export type NewReviewItem = { flip_title: string; effective_date: string | null; discrepancy: boolean; discrepancy_note: string | null; corrective_action: string | null; date_corrected: string | null }
export async function createFlipReview(input: { baseId: string; cycle: string; reviewDate: string; items: NewReviewItem[] }): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  const { data: review, error: rErr } = await supabase.from('flip_reviews')
    .insert({ base_id: input.baseId, cycle: input.cycle, review_date: input.reviewDate, created_by: user?.id ?? null } as never)
    .select().single()
  if (rErr || !review) return { error: friendlyError(rErr?.message ?? 'Failed to create review') }
  const rid = (review as FlipReview).id
  const rows = input.items.map((it, i) => ({ review_id: rid, base_id: input.baseId, sort_order: i, ...it }))
  const { error: iErr } = await supabase.from('flip_review_items').insert(rows as never)
  if (iErr) return { error: friendlyError(iErr.message) }
  return { error: null }
}

// ===== Sign (RPC; called via the offline queue handler 'flip_review_sign') =====
export async function signFlipReviewDirect(reviewId: string, slot: FlipSignSlot): Promise<{ data: FlipSignoff | null; error: string | null }> {
  const supabase = db(); if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data, error } = await supabase.rpc('flip_sign_review', { p_review_id: reviewId, p_slot: slot } as never)
  if (error) { console.error('flip_sign_review:', error.message); return { data: null, error: friendlyError(error.message) } }
  return { data: (data as FlipSignoff) ?? null, error: null }
}

// ===== Role assignments (Layer B) =====
export async function fetchFlipRoleAssignments(baseId: string): Promise<FlipRoleAssignment[]> {
  const supabase = db(); if (!supabase) return []
  const { data, error } = await supabase.from('flip_role_assignments').select('*').eq('base_id', baseId)
  if (error) { console.error('fetchFlipRoleAssignments:', error.message); return [] }
  return (data ?? []) as FlipRoleAssignment[]
}
export async function addFlipRole(baseId: string, userId: string, role: FlipRole): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_role_assignments').insert({ base_id: baseId, user_id: userId, role } as never)
  if (error && !error.message.includes('duplicate')) return { error: friendlyError(error.message) }
  return { error: null }
}
export async function removeFlipRole(id: string): Promise<{ error: string | null }> {
  const supabase = db(); if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('flip_role_assignments').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
