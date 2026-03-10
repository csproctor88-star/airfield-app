import { createClient } from './client'
import { logActivity } from './activity'
import type { DiscrepancyStatus, CurrentStatus } from './types'

export type DiscrepancyRow = {
  id: string
  display_id: string
  base_id: string | null
  type: string
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

export async function fetchDiscrepancies(baseId?: string | null): Promise<DiscrepancyRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  let query = supabase
    .from('discrepancies')
    .select('*')
    .order('created_at', { ascending: false })

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query

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
  notam_reference?: string
  current_status?: string
  latitude?: number | null
  longitude?: number | null
  base_id?: string | null
}): Promise<{ data: DiscrepancyRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let reported_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) reported_by = user.id
  } catch {
    // No authenticated user
  }

  const now = new Date()
  const year = now.getFullYear()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `D-${year}-${ts}`

  const status: DiscrepancyStatus = 'open'

  const row: Record<string, unknown> = {
    display_id,
    type: input.type,
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
  if (input.base_id) row.base_id = input.base_id

  const { data, error } = await supabase
    .from('discrepancies')
    .insert(row as any)
    .select()
    .single()

  if (error) {
    console.error('Failed to create discrepancy:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as DiscrepancyRow
  let discDetails = `NEW DISCREPANCY — ${input.title.toUpperCase()}`
  if (input.location_text) discDetails += `, ${input.location_text.toUpperCase()}`
  if (input.notam_reference) discDetails += `. NOTAM: ${input.notam_reference.toUpperCase()}`
  logActivity('created', 'discrepancy', created.id, created.display_id, { details: discDetails }, input.base_id)

  return { data: created, error: null }
}

export async function updateDiscrepancy(
  id: string,
  fields: {
    title?: string
    description?: string
    location_text?: string
    type?: string
    current_status?: string
    notam_reference?: string | null
    assigned_shop?: string | null
    work_order_number?: string | null
    resolution_notes?: string | null
  }
): Promise<{ data: DiscrepancyRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('discrepancies')
    .update({ ...fields, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update discrepancy:', error.message)
    return { data: null, error: error.message }
  }

  const updated = data as DiscrepancyRow
  const updateParts = [`DISCREPANCY ${updated.display_id} UPDATED`]
  if (fields.title) updateParts.push(fields.title.toUpperCase())
  if (fields.assigned_shop) updateParts.push(`ASSIGNED TO ${fields.assigned_shop.toUpperCase()}`)
  if (fields.work_order_number) updateParts.push(`WO: ${fields.work_order_number.toUpperCase()}`)
  logActivity('updated', 'discrepancy', updated.id, updated.display_id, { details: updateParts.join('. ') }, updated.base_id)

  return { data: updated, error: null }
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

  const { data: rawData, error } = await supabase
    .from('discrepancies')
    .update(updateFields as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update status:', error.message)
    return { data: null, error: error.message }
  }

  const statusUpdated = rawData as DiscrepancyRow

  // Insert audit trail for status change
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const auditRow: Record<string, unknown> = {
        discrepancy_id: id,
        old_status: oldStatus,
        new_status: newStatus,
        notes: notes || null,
        updated_by: user.id,
      }
      if (statusUpdated?.base_id) auditRow.base_id = statusUpdated.base_id
          const { error: auditError } = await supabase.from('status_updates').insert(auditRow as any)
      if (auditError) {
        console.error('Failed to save status update note:', auditError.message)
      }
    }
  } catch (e) {
    console.error('Audit trail insert failed:', e)
  }
  const statusParts = [`DISCREPANCY ${statusUpdated.display_id} ${newStatus.toUpperCase()}`]
  if (extraFields?.assigned_shop) statusParts.push(`ASSIGNED TO ${extraFields.assigned_shop.toUpperCase()}`)
  if (extraFields?.resolution_notes) statusParts.push(extraFields.resolution_notes.toUpperCase())
  if (notes) statusParts.push(notes.toUpperCase())
  logActivity(
    newStatus === 'cancelled' ? 'cancelled' : 'status_updated',
    'discrepancy', statusUpdated.id, statusUpdated.display_id, { details: statusParts.join('. ') }, statusUpdated.base_id
  )

  return { data: statusUpdated, error: null }
}

export async function deleteDiscrepancy(
  id: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: existing } = await supabase.from('discrepancies').select('display_id, title, base_id').eq('id', id).single()

  await supabase.from('photos').delete().eq('discrepancy_id', id)
  await supabase.from('status_updates').delete().eq('discrepancy_id', id)
  const { error } = await supabase.from('discrepancies').delete().eq('id', id)

  if (error) {
    console.error('Delete discrepancy failed:', error.message)
    return { error: error.message }
  }

  logActivity('deleted', 'discrepancy', id, existing?.display_id, { details: `DISCREPANCY ${existing?.display_id || ''} DELETED${existing?.title ? ` — ${existing.title.toUpperCase()}` : ''}` }, existing?.base_id)

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
  file: File,
  baseId?: string | null
): Promise<{ data: PhotoRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `discrepancy-photos/${discrepancyId}/${Date.now()}.${ext}`

  let storageUrl = storagePath
  let usedStorage = false
  try {
      const { error: uploadError } = await supabase.storage
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

  // Resolve base_id: use provided value, or look it up from the discrepancy
  let resolvedBaseId = baseId
  if (!resolvedBaseId) {
    try {
          const { data: disc } = await supabase
        .from('discrepancies')
        .select('base_id')
        .eq('id', discrepancyId)
        .single()
      if (disc?.base_id) resolvedBaseId = disc.base_id
    } catch { /* proceed without base_id */ }
  }

  const photoRow: Record<string, unknown> = {
    discrepancy_id: discrepancyId,
    storage_path: storageUrl,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'image/jpeg',
  }
  if (uploaded_by) photoRow.uploaded_by = uploaded_by
  if (resolvedBaseId) photoRow.base_id = resolvedBaseId

  const { data, error } = await supabase
    .from('photos')
    .insert(photoRow as any)
    .select()
    .single()

  if (error) {
    console.error('Photo record insert failed:', error.message)
    return { data: null, error: error.message }
  }

  const { data: disc } = await supabase
    .from('discrepancies')
    .select('photo_count')
    .eq('id', discrepancyId)
    .single()
  if (disc) {
      await supabase
      .from('discrepancies')
      .update({ photo_count: (disc.photo_count || 0) + 1 })
      .eq('id', discrepancyId)
  }

  return { data: data as PhotoRow, error: null }
}

export async function fetchDiscrepancyPhotos(discrepancyId: string): Promise<PhotoRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
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
  new_status: string | null
  notes: string | null
  updated_by: string
  created_at: string
  user_name?: string
  user_rank?: string
}

export async function fetchStatusUpdates(discrepancyId: string): Promise<StatusUpdateRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('status_updates')
    .select('*, profiles:updated_by(name, rank)')
    .eq('discrepancy_id', discrepancyId)
    .order('created_at', { ascending: false })

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      user_rank: (row.profiles as { rank?: string } | null)?.rank || undefined,
    })) as StatusUpdateRow[]
  }

  console.warn('Status updates profile join failed, falling back:', error?.message)
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('status_updates')
    .select('*')
    .eq('discrepancy_id', discrepancyId)
    .order('created_at', { ascending: false })

  if (fallbackError) {
    console.error('Failed to fetch status updates:', fallbackError.message)
    return []
  }

  return (fallbackData ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    user_name: 'Unknown',
  })) as StatusUpdateRow[]
}

export async function addStatusNote(discrepancyId: string, notes: string, baseId?: string | null): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No authenticated user' }

    const row: Record<string, unknown> = {
      discrepancy_id: discrepancyId,
      old_status: null,
      new_status: null,
      notes,
      updated_by: user.id,
    }
    if (baseId) row.base_id = baseId

      const { error } = await supabase
      .from('status_updates')
      .insert(row as any)

    if (error) {
      console.error('Failed to add note:', error.message)
      return { error: error.message }
    }
    return { error: null }
  } catch {
    return { error: 'Failed to add note' }
  }
}

export async function fetchDiscrepancyKPIs(baseId?: string | null): Promise<{
  open: number
}> {
  const supabase = createClient()
  if (!supabase) return { open: 0 }

  let query = supabase
    .from('discrepancies')
    .select('status')
    .not('status', 'in', '("completed","cancelled")')

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch KPIs:', error.message)
    return { open: 0 }
  }

  const rows = (data ?? []) as { status: string }[]
  const open = rows.filter(r => !['completed', 'cancelled'].includes(r.status)).length

  return { open }
}
