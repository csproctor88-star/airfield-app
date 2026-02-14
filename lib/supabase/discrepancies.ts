import { createClient } from './client'
import type { Severity, DiscrepancyStatus } from './types'
import { calculateSLADeadline } from '@/lib/calculations/sla'

export type DiscrepancyRow = {
  id: string
  display_id: string
  type: string
  severity: Severity
  status: DiscrepancyStatus
  title: string
  description: string
  location_text: string
  latitude: number | null
  longitude: number | null
  assigned_shop: string | null
  assigned_to: string | null
  reported_by: string
  work_order_number: string | null
  sla_deadline: string | null
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
  severity: string
  assigned_shop?: string
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

  // Calculate SLA deadline
  const sla_deadline = calculateSLADeadline(input.severity, now).toISOString()

  const status: DiscrepancyStatus = input.assigned_shop ? 'assigned' : 'open'

  const row: Record<string, unknown> = {
    display_id,
    type: input.type,
    severity: input.severity,
    status,
    title: input.title,
    description: input.description,
    location_text: input.location_text,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    assigned_shop: input.assigned_shop || null,
    sla_deadline,
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

  // Upload file to storage
  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `discrepancy-photos/${discrepancyId}/${Date.now()}.${ext}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: uploadError } = await (supabase as any).storage
    .from('photos')
    .upload(storagePath, file, { contentType: file.type || 'image/jpeg' })

  if (uploadError) {
    console.error('Storage upload failed:', uploadError.message)
    return { data: null, error: uploadError.message }
  }

  // Insert row into photos table
  let uploaded_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) uploaded_by = user.id
  } catch {
    // No authenticated user
  }

  const photoRow: Record<string, unknown> = {
    discrepancy_id: discrepancyId,
    storage_path: storagePath,
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

export async function fetchDiscrepancyKPIs(): Promise<{
  open: number
  critical: number
  overdue: number
}> {
  const supabase = createClient()
  if (!supabase) return { open: 0, critical: 0, overdue: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('discrepancies')
    .select('severity, status, sla_deadline')
    .not('status', 'in', '("closed")')

  if (error) {
    console.error('Failed to fetch KPIs:', error.message)
    return { open: 0, critical: 0, overdue: 0 }
  }

  const rows = (data ?? []) as { severity: string; status: string; sla_deadline: string | null }[]
  const now = new Date()

  const open = rows.filter(r => !['resolved', 'closed'].includes(r.status)).length
  const critical = rows.filter(r => r.severity === 'critical' && !['resolved', 'closed'].includes(r.status)).length
  const overdue = rows.filter(r => {
    if (!r.sla_deadline || ['resolved', 'closed'].includes(r.status)) return false
    return now > new Date(r.sla_deadline)
  }).length

  return { open, critical, overdue }
}
