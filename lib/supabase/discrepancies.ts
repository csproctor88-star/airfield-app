import { createClient } from './client'
import type { Severity, DiscrepancyStatus, CurrentStatus } from './types'

export type DiscrepancyRow = {
  id: string
  display_id: string
  type: string
  severity: Severity
  status: DiscrepancyStatus
  current_status: CurrentStatus
  title: string
  description: string
  location_text: string
  latitude: number | null
  longitude: number | null
  assigned_shop: string | null
  assigned_to: string | null
  reported_by: string
  work_order_number: string | null
  notam_reference: string | null
  linked_notam_id: string | null
  inspection_id: string | null
  resolution_notes: string | null
  resolution_date: string | null
  photo_count: number
  created_at: string
  updated_at: string
}

export async function fetchDiscrepancies(): Promise<DiscrepancyRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('discrepancies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch discrepancies:', error.message)
    return []
  }

  return data as DiscrepancyRow[]
}

export async function fetchDiscrepancy(id: string): Promise<DiscrepancyRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('discrepancies')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch discrepancy:', error.message)
    return null
  }

  return data as DiscrepancyRow
}

export async function createDiscrepancy(input: {
  title: string
  description: string
  location_text: string
  type: string
  severity?: string
  notam_reference?: string
  current_status?: string
  latitude?: number | null
  longitude?: number | null
}): Promise<{ data: DiscrepancyRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // Get the current user for reported_by
  // reported_by is uuid with FK to auth.users — only include it when we have a real user
  let reported_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) reported_by = user.id
  } catch {
    // No authenticated user
  }

  // Generate a display ID based on timestamp to avoid count query issues with RLS
  const now = new Date()
  const year = now.getFullYear()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `D-${year}-${ts}`

  const status: DiscrepancyStatus = 'open'

  const row: Record<string, unknown> = {
    display_id,
    type: input.type,
    severity: input.severity || 'no',
    status,
    current_status: input.current_status || 'submitted_to_afm',
    notam_reference: input.notam_reference || null,
    title: input.title,
    description: input.description,
    location_text: input.location_text,
    work_order_number: 'Pending',
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  }
  if (reported_by) row.reported_by = reported_by

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('discrepancies')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Failed to create discrepancy:', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as DiscrepancyRow, error: null }
}

export async function updateDiscrepancy(
  id: string,
  fields: {
    title?: string
    description?: string
    location_text?: string
    type?: string
    severity?: string
    current_status?: string
    notam_reference?: string | null
    assigned_shop?: string | null
    work_order_number?: string | null
    resolution_notes?: string | null
  }
): Promise<{ data: DiscrepancyRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('discrepancies')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update discrepancy:', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as DiscrepancyRow, error: null }
}

export async function updateDiscrepancyStatus(
  id: string,
  oldStatus: string,
  newStatus: string,
  notes?: string,
  extraFields?: { assigned_shop?: string; resolution_notes?: string }
): Promise<{ data: DiscrepancyRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const updateFields: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (extraFields?.assigned_shop) updateFields.assigned_shop = extraFields.assigned_shop
  if (extraFields?.resolution_notes) updateFields.resolution_notes = extraFields.resolution_notes
  if (newStatus === 'resolved') updateFields.resolution_date = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('discrepancies')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update status:', error.message)
    return { data: null, error: error.message }
  }

  // Attempt to insert audit trail — don't block on FK issues
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await (supabase as any).from('status_updates').insert({
        discrepancy_id: id,
        old_status: oldStatus,
        new_status: newStatus,
        notes: notes || null,
        updated_by: user.id,
      })
    }
  } catch {
    // Audit trail is best-effort
  }

  return { data: data as DiscrepancyRow, error: null }
}

export async function deleteDiscrepancy(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // Delete related photos first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('photos').delete().eq('discrepancy_id', id)

  // Delete related status_updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('status_updates').delete().eq('discrepancy_id', id)

  // Delete the discrepancy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('discrepancies').delete().eq('id', id)

  if (error) {
    console.error('Delete discrepancy failed:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

export type PhotoRow = {
  id: string
  discrepancy_id: string | null
  storage_path: string
  thumbnail_path: string | null
  file_name: string
  file_size: number | null
  mime_type: string
  captured_at: string
  created_at: string
}

export async function uploadDiscrepancyPhoto(
  discrepancyId: string,
  file: File
): Promise<{ data: PhotoRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `discrepancy-photos/${discrepancyId}/${Date.now()}.${ext}`

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

  // Get current user — uploaded_by is optional if constraint was dropped
  let uploaded_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) uploaded_by = user.id
  } catch {
    // No authenticated user
  }

  const photoRow: Record<string, unknown> = {
    discrepancy_id: discrepancyId,
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

  // Increment photo_count on the discrepancy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: disc } = await (supabase as any)
    .from('discrepancies')
    .select('photo_count')
    .eq('id', discrepancyId)
    .single()
  if (disc) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('discrepancies')
      .update({ photo_count: (disc.photo_count || 0) + 1 })
      .eq('id', discrepancyId)
  }

  return { data: data as PhotoRow, error: null }
}

export async function fetchDiscrepancyPhotos(discrepancyId: string): Promise<PhotoRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('photos')
    .select('*')
    .eq('discrepancy_id', discrepancyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch photos:', error.message)
    return []
  }

  return data as PhotoRow[]
}

export type StatusUpdateRow = {
  id: string
  discrepancy_id: string
  old_status: string | null
  new_status: string
  notes: string | null
  updated_by: string
  created_at: string
  user_name?: string
}

export async function fetchStatusUpdates(discrepancyId: string): Promise<StatusUpdateRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('status_updates')
    .select('*, profiles:updated_by(name)')
    .eq('discrepancy_id', discrepancyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch status updates:', error.message)
    return []
  }

  // Flatten the joined profile name
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
  })) as StatusUpdateRow[]
}

export async function addStatusNote(discrepancyId: string, notes: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  let updated_by = 'unknown'
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) updated_by = user.id
  } catch { /* no user */ }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('status_updates')
    .insert({
      discrepancy_id: discrepancyId,
      old_status: null,
      new_status: '',
      notes,
      updated_by,
    })

  if (error) {
    console.error('Failed to add note:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export async function fetchDiscrepancyKPIs(): Promise<{
  open: number
  critical: number
}> {
  const supabase = createClient()
  if (!supabase) return { open: 0, critical: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('discrepancies')
    .select('severity, status')
    .not('status', 'in', '("closed")')

  if (error) {
    console.error('Failed to fetch KPIs:', error.message)
    return { open: 0, critical: 0 }
  }

  const rows = (data ?? []) as { severity: string; status: string }[]

  const open = rows.filter(r => !['resolved', 'closed'].includes(r.status)).length
  const critical = rows.filter(r => r.severity === 'critical' && !['resolved', 'closed'].includes(r.status)).length

  return { open, critical }
}
