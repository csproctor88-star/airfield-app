import { createClient } from './client'
import type { ObstructionEvaluation } from './types'

export type ObstructionRow = ObstructionEvaluation

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
  photo_storage_path: string | null
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

  const row: Record<string, unknown> = {
    display_id,
    ...input,
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

  return { data: data as ObstructionRow, error: null }
}

export async function uploadObstructionPhoto(
  evaluationId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { path: null, error: 'Supabase not configured' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `obstruction-photos/${evaluationId}/${Date.now()}.${ext}`

  let storageUrl = storagePath
  let usedStorage = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: uploadError } = await (supabase as any).storage
      .from('photos')
      .upload(storagePath, file, { contentType: file.type || 'image/jpeg' })

    if (!uploadError) {
      usedStorage = true
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
      return { path: null, error: 'Failed to process photo' }
    }
  }

  // Update the evaluation record with the photo path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('obstruction_evaluations')
    .update({ photo_storage_path: storageUrl })
    .eq('id', evaluationId)

  if (error) {
    console.error('Failed to update photo path:', error.message)
    return { path: null, error: error.message }
  }

  return { path: storageUrl, error: null }
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
    photo_storage_path: string | null
    results: Record<string, unknown>[]
    controlling_surface: string | null
    violated_surfaces: string[]
    has_violation: boolean
    notes: string | null
  },
): Promise<{ data: ObstructionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('obstruction_evaluations')
    .update(input)
    .eq('id', id)

  if (updateError) {
    console.error('Failed to update obstruction evaluation:', updateError.message)
    return { data: null, error: updateError.message }
  }

  // Fetch the updated record separately to avoid .single() coercion issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: fetchError } = await (supabase as any)
    .from('obstruction_evaluations')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) {
    // Update succeeded but fetch failed — return a minimal object with the id
    return { data: { id } as ObstructionRow, error: null }
  }

  return { data: data as ObstructionRow, error: null }
}

export async function deleteObstructionEvaluation(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('obstruction_evaluations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Delete obstruction evaluation failed:', error.message)
    return { error: error.message }
  }

  return { error: null }
}
