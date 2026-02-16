import { createClient } from './client'
import type { CheckType } from './types'

export type CheckPhotoRow = {
  id: string
  check_id: string | null
  storage_path: string
  thumbnail_path: string | null
  file_name: string
  file_size: number | null
  mime_type: string
  captured_at: string
  created_at: string
}

export type CheckRow = {
  id: string
  display_id: string
  check_type: CheckType
  areas: string[]
  data: Record<string, unknown>
  completed_by: string | null
  completed_at: string | null
  latitude: number | null
  longitude: number | null
  photo_count: number
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
    const commentRows = input.comments.map((c) => ({
      check_id: created.id,
      comment: c.comment,
      user_name: c.user_name,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: commentError } = await (supabase as any)
      .from('check_comments')
      .insert(commentRows)
    if (commentError) {
      console.error('Failed to save comments:', commentError.message)
    }
  }

  return { data: created, error: null }
}

export async function fetchChecks(): Promise<{ data: CheckRow[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('airfield_checks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch checks:', error.message)
    return { data: [], error: error.message }
  }

  return { data: data as CheckRow[], error: null }
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
  userName: string
): Promise<{ data: CheckCommentRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('check_comments')
    .insert({ check_id: checkId, comment, user_name: userName })
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

  // Delete comments first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('check_comments').delete().eq('check_id', id)

  // Delete photos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('photos').delete().eq('check_id', id)

  // Delete the check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('airfield_checks').delete().eq('id', id)

  if (error) {
    console.error('Delete check failed:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

export async function uploadCheckPhoto(
  checkId: string,
  file: File
): Promise<{ data: CheckPhotoRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `check-photos/${checkId}/${Date.now()}.${ext}`

  // Try uploading to Supabase Storage first
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

  // If storage failed, convert to base64 data URL as fallback
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

  // Get current user
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

  // Increment photo_count on the check
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
