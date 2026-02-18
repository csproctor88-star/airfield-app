import { createClient } from './client'
import { logActivity } from './activity'
import type { ObstructionEvaluation } from './types'

export type ObstructionRow = ObstructionEvaluation

/** Parse photo_storage_path into an array of URLs.
 *  Handles: JSON array string, plain URL string, null/empty. */
export function parsePhotoPaths(raw: string | null | undefined): string[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed) as string[] } catch { /* fall through */ }
  }
  return [trimmed]
}

export async function fetchObstructionEvaluations(): Promise<ObstructionRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('obstruction_evaluations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch obstruction evaluations:', error.message)
    return []
  }

  return data as ObstructionRow[]
}

export async function fetchObstructionEvaluation(id: string): Promise<ObstructionRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('obstruction_evaluations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch obstruction evaluation:', error.message)
    return null
  }

  return data as ObstructionRow
}

export async function createObstructionEvaluation(input: {
  runway_class: 'A' | 'B'
  object_height_agl: number
  object_distance_ft: number | null
  distance_from_centerline_ft: number | null
  object_elevation_msl: number | null
  obstruction_top_msl: number | null
  latitude: number | null
  longitude: number | null
  description: string | null
  photo_storage_paths: string[]
  results: Record<string, unknown>[]
  controlling_surface: string | null
  violated_surfaces: string[]
  has_violation: boolean
  notes: string | null
}): Promise<{ data: ObstructionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let evaluated_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) evaluated_by = user.id
  } catch {
    // No authenticated user
  }

  // Generate display ID
  const now = new Date()
  const year = now.getFullYear()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `OBS-${year}-${ts}`

  const { photo_storage_paths, ...rest } = input
  const row: Record<string, unknown> = {
    display_id,
    ...rest,
    photo_storage_path: photo_storage_paths.length > 0 ? JSON.stringify(photo_storage_paths) : null,
  }
  if (evaluated_by) row.evaluated_by = evaluated_by

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('obstruction_evaluations')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Failed to create obstruction evaluation:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as ObstructionRow
  logActivity('created', 'obstruction_evaluation', created.id, created.display_id ?? undefined, { has_violation: input.has_violation })

  return { data: created, error: null }
}

export async function uploadObstructionPhoto(
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { url: null, error: 'Supabase not configured' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `obstruction-photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  let storageUrl: string | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: uploadError } = await (supabase as any).storage
      .from('photos')
      .upload(storagePath, file, { contentType: file.type || 'image/jpeg' })

    if (!uploadError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: urlData } = (supabase as any).storage
        .from('photos')
        .getPublicUrl(storagePath)
      if (urlData?.publicUrl) {
        storageUrl = urlData.publicUrl
      }
    } else {
      console.warn('Storage upload failed, storing as data URL:', uploadError.message)
    }
  } catch {
    console.warn('Storage not available, storing as data URL')
  }

  if (!storageUrl) {
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
      return { url: null, error: 'Failed to process photo' }
    }
  }

  return { url: storageUrl, error: null }
}

export async function updateObstructionEvaluation(
  id: string,
  input: {
    object_height_agl: number
    object_distance_ft: number | null
    distance_from_centerline_ft: number | null
    object_elevation_msl: number | null
    obstruction_top_msl: number | null
    latitude: number | null
    longitude: number | null
    description: string | null
    photo_storage_paths: string[]
    results: Record<string, unknown>[]
    controlling_surface: string | null
    violated_surfaces: string[]
    has_violation: boolean
    notes: string | null
  },
): Promise<{ data: ObstructionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { photo_storage_paths, ...rest } = input
  const updatePayload = {
    ...rest,
    photo_storage_path: photo_storage_paths.length > 0 ? JSON.stringify(photo_storage_paths) : null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updateData, error: updateError } = await (supabase as any)
    .from('obstruction_evaluations')
    .update(updatePayload)
    .eq('id', id)
    .select()

  if (updateError) {
    console.error('Failed to update obstruction evaluation:', updateError.message)
    return { data: null, error: updateError.message }
  }

  // If no rows were updated (RLS blocked), report a clear error
  if (!updateData || updateData.length === 0) {
    return { data: null, error: 'Update failed — you may not have permission to edit this evaluation.' }
  }

  const updated = updateData[0] as ObstructionRow
  logActivity('updated', 'obstruction_evaluation', updated.id, updated.display_id ?? undefined, { has_violation: input.has_violation })

  return { data: updated, error: null }
}

export async function deleteObstructionEvaluation(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // Capture display info before deletion for activity log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any).from('obstruction_evaluations').select('display_id').eq('id', id).single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('obstruction_evaluations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Delete obstruction evaluation failed:', error.message)
    return { error: error.message }
  }

  // Verify the row was actually deleted (RLS can silently block deletes)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: remaining } = await (supabase as any)
    .from('obstruction_evaluations')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (remaining) {
    return { error: 'Delete was blocked. You may not have permission to delete this evaluation.' }
  }

  logActivity('deleted', 'obstruction_evaluation', id, existing?.display_id)

  return { error: null }
}
