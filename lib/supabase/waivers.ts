import { createClient } from './client'
import { logActivity } from './activity'
import type { WaiverStatus } from './types'

export type WaiverRow = {
  id: string
  display_id: string
  base_id: string | null
  waiver_type: string
  status: WaiverStatus
  title: string
  description: string
  location_text: string | null
  authority_reference: string | null
  conditions: string | null
  requested_by: string | null
  approved_by: string | null
  effective_start: string | null
  effective_end: string | null
  approved_at: string | null
  denied_at: string | null
  denial_reason: string | null
  linked_discrepancy_id: string | null
  linked_obstruction_id: string | null
  linked_notam_id: string | null
  photo_count: number
  created_at: string
  updated_at: string
}

export async function fetchWaivers(baseId?: string | null): Promise<WaiverRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
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
  title: string
  description: string
  waiver_type: string
  location_text?: string
  authority_reference?: string
  conditions?: string
  effective_start?: string | null
  effective_end?: string | null
  linked_discrepancy_id?: string | null
  linked_obstruction_id?: string | null
  linked_notam_id?: string | null
  status?: WaiverStatus
  base_id?: string | null
}): Promise<{ data: WaiverRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let requested_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) requested_by = user.id
  } catch {
    // No authenticated user
  }

  const now = new Date()
  const year = now.getFullYear()
  const ts = now.getTime().toString(16).slice(-4).toUpperCase()
  const display_id = `W-${year}-${ts}`

  const row: Record<string, unknown> = {
    display_id,
    waiver_type: input.waiver_type,
    status: input.status || 'draft',
    title: input.title,
    description: input.description,
    location_text: input.location_text || null,
    authority_reference: input.authority_reference || null,
    conditions: input.conditions || null,
    effective_start: input.effective_start || null,
    effective_end: input.effective_end || null,
    linked_discrepancy_id: input.linked_discrepancy_id || null,
    linked_obstruction_id: input.linked_obstruction_id || null,
    linked_notam_id: input.linked_notam_id || null,
  }
  if (requested_by) row.requested_by = requested_by
  if (input.base_id) row.base_id = input.base_id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('waivers')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Failed to create waiver:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as WaiverRow
  logActivity('created', 'waiver', created.id, created.display_id, { title: input.title, waiver_type: input.waiver_type }, input.base_id)

  return { data: created, error: null }
}

export async function updateWaiver(
  id: string,
  fields: {
    title?: string
    description?: string
    waiver_type?: string
    location_text?: string | null
    authority_reference?: string | null
    conditions?: string | null
    effective_start?: string | null
    effective_end?: string | null
    linked_discrepancy_id?: string | null
    linked_obstruction_id?: string | null
    linked_notam_id?: string | null
  }
): Promise<{ data: WaiverRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('waivers')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update waiver:', error.message)
    return { data: null, error: error.message }
  }

  const updated = data as WaiverRow
  logActivity('updated', 'waiver', updated.id, updated.display_id, { fields: Object.keys(fields) }, updated.base_id)

  return { data: updated, error: null }
}

export async function updateWaiverStatus(
  id: string,
  newStatus: WaiverStatus,
  extra?: { denial_reason?: string; effective_start?: string; effective_end?: string }
): Promise<{ data: WaiverRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const updateFields: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'approved') {
    updateFields.approved_at = new Date().toISOString()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) updateFields.approved_by = user.id
    } catch {
      // No authenticated user
    }
    if (extra?.effective_start) updateFields.effective_start = extra.effective_start
    if (extra?.effective_end) updateFields.effective_end = extra.effective_end
  }

  if (newStatus === 'denied') {
    updateFields.denied_at = new Date().toISOString()
    if (extra?.denial_reason) updateFields.denial_reason = extra.denial_reason
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('waivers')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update waiver status:', error.message)
    return { data: null, error: error.message }
  }

  const updated = data as WaiverRow
  logActivity('status_updated', 'waiver', updated.id, updated.display_id, { new_status: newStatus }, updated.base_id)

  return { data: updated, error: null }
}

export async function deleteWaiver(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any).from('waivers').select('display_id, title, base_id').eq('id', id).single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('waivers').delete().eq('id', id)

  if (error) {
    console.error('Delete waiver failed:', error.message)
    return { error: error.message }
  }

  logActivity('deleted', 'waiver', id, existing?.display_id, { title: existing?.title }, existing?.base_id)

  return { error: null }
}
