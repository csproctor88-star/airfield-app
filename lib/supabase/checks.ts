import { createClient } from './client'
import { logActivity } from './activity'
import type { CheckType } from './types'
import type { CheckDraft } from '@/lib/check-draft'

export type CheckPhotoRow = {
  id: string
  check_id: string | null
  storage_path: string
  thumbnail_path: string | null
  file_name: string
  file_size: number | null
  mime_type: string
  issue_index: number | null
  captured_at: string
  created_at: string
}

export type CheckRow = {
  id: string
  display_id: string
  base_id: string | null
  check_type: CheckType
  areas: string[]
  data: Record<string, unknown>
  completed_by: string | null
  completed_at: string | null
  latitude: number | null
  longitude: number | null
  photo_count: number
  status: 'draft' | 'completed'
  draft_data: CheckDraft | null
  saved_by_name: string | null
  saved_by_id: string | null
  saved_at: string | null
  created_at: string
  updated_at: string
}

export type CheckCommentRow = {
  id: string
  check_id: string
  comment: string
  user_name: string
  created_at: string
}

export async function createCheck(input: {
  check_type: CheckType
  areas: string[]
  data: Record<string, unknown>
  completed_by: string
  comments: { comment: string; user_name: string; created_at: string }[]
  latitude?: number | null
  longitude?: number | null
  base_id?: string | null
}): Promise<{ data: CheckRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const now = new Date()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `AC-${ts}`

  const row: Record<string, unknown> = {
    display_id,
    check_type: input.check_type,
    areas: input.areas,
    data: input.data,
    completed_by: input.completed_by,
    completed_at: now.toISOString(),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  }
  if (input.base_id) row.base_id = input.base_id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('airfield_checks')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Failed to create check:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as CheckRow

  // Save comments
  if (input.comments.length > 0) {
    const commentRows = input.comments.map((c) => {
      const cr: Record<string, unknown> = {
        check_id: created.id,
        comment: c.comment,
        user_name: c.user_name,
      }
      if (input.base_id) cr.base_id = input.base_id
      return cr
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: commentError } = await (supabase as any)
      .from('check_comments')
      .insert(commentRows)
    if (commentError) {
      console.error('Failed to save comments:', commentError.message)
    }
  }

  logActivity('completed', 'check', created.id, created.display_id, { check_type: input.check_type, areas: input.areas }, input.base_id)

  return { data: created, error: null }
}

export async function fetchChecks(baseId?: string | null): Promise<{ data: CheckRow[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('airfield_checks')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch checks:', error.message)
    return { data: [], error: error.message }
  }

  return { data: data as CheckRow[], error: null }
}

export async function fetchRecentChecks(baseId?: string | null, limit = 5): Promise<CheckRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('airfield_checks')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to fetch recent checks:', error.message)
    return []
  }
  return data as CheckRow[]
}

export async function fetchCheck(id: string): Promise<CheckRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('airfield_checks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch check:', error.message)
    return null
  }

  return data as CheckRow
}

export async function fetchCheckComments(checkId: string): Promise<CheckCommentRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('check_comments')
    .select('*')
    .eq('check_id', checkId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch check comments:', error.message)
    return []
  }

  return data as CheckCommentRow[]
}

export async function addCheckComment(
  checkId: string,
  comment: string,
  userName: string,
  baseId?: string | null
): Promise<{ data: CheckCommentRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const row: Record<string, unknown> = { check_id: checkId, comment, user_name: userName }
  if (baseId) row.base_id = baseId

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('check_comments')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Failed to add comment:', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as CheckCommentRow, error: null }
}

export async function deleteCheck(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any).from('airfield_checks').select('display_id, check_type, base_id').eq('id', id).single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('check_comments').delete().eq('check_id', id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('photos').delete().eq('check_id', id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('airfield_checks').delete().eq('id', id)

  if (error) {
    console.error('Delete check failed:', error.message)
    return { error: error.message }
  }

  logActivity('deleted', 'check', id, existing?.display_id, { check_type: existing?.check_type }, existing?.base_id)

  return { error: null }
}

export async function updateCheckNotes(id: string, notes: string | null): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any).from('airfield_checks').select('display_id, data, base_id').eq('id', id).single()
  const currentData = (existing?.data as Record<string, unknown>) || {}
  const updatedData = { ...currentData, notes }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('airfield_checks')
    .update({ data: updatedData })
    .eq('id', id)

  if (error) {
    console.error('Update check notes failed:', error.message)
    return { error: error.message }
  }

  logActivity('updated', 'check', id, existing?.display_id, { field: 'notes' }, existing?.base_id)

  return { error: null }
}

export async function uploadCheckPhoto(
  checkId: string,
  file: File,
  baseId?: string | null,
  issueIndex?: number | null
): Promise<{ data: CheckPhotoRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `check-photos/${checkId}/${Date.now()}.${ext}`

  let storageUrl = storagePath
  let usedStorage = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: uploadError } = await (supabase as any).storage
      .from('photos')
      .upload(storagePath, file, { contentType: file.type || 'image/jpeg' })

    if (!uploadError) {
      usedStorage = true
    } else {
      console.warn('Storage upload failed, storing as data URL:', uploadError.message)
    }
  } catch {
    console.warn('Storage not available, storing as data URL')
  }

  if (!usedStorage) {
    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      storageUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`
    } catch (e) {
      console.error('Failed to convert file to data URL:', e)
      return { data: null, error: 'Failed to process photo' }
    }
  }

  let uploaded_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) uploaded_by = user.id
  } catch {
    // No authenticated user
  }

  const photoRow: Record<string, unknown> = {
    check_id: checkId,
    storage_path: storageUrl,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'image/jpeg',
  }
  if (uploaded_by) photoRow.uploaded_by = uploaded_by
  if (baseId) photoRow.base_id = baseId
  if (issueIndex != null) photoRow.issue_index = issueIndex

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('photos')
    .insert(photoRow)
    .select()
    .single()

  if (error) {
    console.error('Photo record insert failed:', error.message)
    return { data: null, error: error.message }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chk } = await (supabase as any)
    .from('airfield_checks')
    .select('photo_count')
    .eq('id', checkId)
    .single()
  if (chk) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('airfield_checks')
      .update({ photo_count: (chk.photo_count || 0) + 1 })
      .eq('id', checkId)
  }

  return { data: data as CheckPhotoRow, error: null }
}

// ── Draft persistence ──

/** Save (upsert) a check draft to the database.
 *  If `id` is provided, updates the existing row; otherwise inserts a new row. */
export async function saveCheckDraftToDb(input: {
  id?: string | null
  draft_data: CheckDraft
  base_id?: string | null
}): Promise<{ data: CheckRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let userId: string | undefined
  let savedByName: string | null = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      userId = user.id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('name, rank')
        .eq('id', user.id)
        .single()
      if (profile) {
        savedByName = profile.rank ? `${profile.rank} ${profile.name}` : profile.name
      } else {
        savedByName = user.email || null
      }
    }
  } catch {
    // No authenticated user
  }

  const now = new Date()

  if (input.id) {
    // Update existing draft row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('airfield_checks')
      .update({
        draft_data: input.draft_data,
        saved_by_name: savedByName,
        saved_by_id: userId || null,
        saved_at: now.toISOString(),
      })
      .eq('id', input.id)
      .eq('status', 'draft')
      .select()
      .single()

    if (error) {
      console.error('Failed to update check draft:', error.message)
      return { data: null, error: error.message }
    }

    const updated = data as CheckRow
    logActivity('saved', 'check', updated.id, updated.display_id, { check_type: input.draft_data.checkType || 'draft' }, input.base_id)
    return { data: updated, error: null }
  }

  // Insert new draft row
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `DC-${ts}`

  const row: Record<string, unknown> = {
    display_id,
    check_type: input.draft_data.checkType || 'fod',
    areas: input.draft_data.areas || [],
    data: {},
    status: 'draft',
    draft_data: input.draft_data,
    saved_by_name: savedByName,
    saved_by_id: userId || null,
    saved_at: now.toISOString(),
  }
  if (input.base_id) row.base_id = input.base_id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('airfield_checks')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Failed to save check draft:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as CheckRow
  logActivity('saved', 'check', created.id, created.display_id, { check_type: input.draft_data.checkType || 'draft' }, input.base_id)
  return { data: created, error: null }
}

/** Load the most recent draft check for a base */
export async function loadCheckDraftFromDb(baseId?: string | null): Promise<CheckRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('airfield_checks')
    .select('*')
    .eq('status', 'draft')
    .order('saved_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (baseId) {
    query = (supabase as any)
      .from('airfield_checks')
      .select('*')
      .eq('status', 'draft')
      .eq('base_id', baseId)
      .order('saved_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  }

  const { data, error } = await query
  if (error) {
    console.error('Failed to load check draft:', error.message)
    return null
  }
  return (data as CheckRow) || null
}

/** Delete a draft check row (safety: only deletes rows with status='draft') */
export async function deleteCheckDraft(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('airfield_checks')
    .delete()
    .eq('id', id)
    .eq('status', 'draft')

  if (error) {
    console.error('Failed to delete check draft:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

export async function fetchCheckPhotos(checkId: string): Promise<CheckPhotoRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('photos')
    .select('*')
    .eq('check_id', checkId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch check photos:', error.message)
    return []
  }

  return data as CheckPhotoRow[]
}
