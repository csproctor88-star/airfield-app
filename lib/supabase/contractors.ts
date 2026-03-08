import { createClient } from './client'
import { logActivity } from './activity'

export type ContractorRow = {
  id: string
  base_id: string | null
  company_name: string
  contact_name: string | null
  location: string
  work_description: string
  status: 'active' | 'completed'
  start_date: string
  end_date: string | null
  notes: string | null
  radio_number: string | null
  flag_number: string | null
  callsign: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export async function fetchContractors(baseId?: string | null): Promise<ContractorRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  let query = supabase
    .from('airfield_contractors')
    .select('*')
    .order('created_at', { ascending: false })

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch contractors:', error.message)
    return []
  }

  return data as ContractorRow[]
}

export async function fetchActiveContractors(baseId?: string | null): Promise<ContractorRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  let query = supabase
    .from('airfield_contractors')
    .select('*')
    .eq('status', 'active')
    .order('start_date', { ascending: true })

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch active contractors:', error.message)
    return []
  }

  return data as ContractorRow[]
}

export async function createContractor(input: {
  company_name: string
  contact_name?: string
  location: string
  work_description: string
  start_date?: string
  notes?: string
  radio_number?: string
  flag_number?: string
  callsign?: string
  base_id?: string | null
}): Promise<{ data: ContractorRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let created_by: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) created_by = user.id
  } catch {
    // No authenticated user
  }

  const row: Record<string, unknown> = {
    company_name: input.company_name,
    contact_name: input.contact_name || null,
    location: input.location,
    work_description: input.work_description,
    start_date: input.start_date || new Date().toISOString().split('T')[0],
    notes: input.notes || null,
    radio_number: input.radio_number || null,
    flag_number: input.flag_number || null,
    callsign: input.callsign || null,
  }
  if (created_by) row.created_by = created_by
  if (input.base_id) row.base_id = input.base_id

  const { data, error } = await supabase
    .from('airfield_contractors')
    .insert(row as any)
    .select()
    .single()

  if (error) {
    console.error('Failed to create contractor:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as ContractorRow
  logActivity('logged_personnel', 'contractor', created.id, undefined, { details: `${input.company_name.toUpperCase()} ON AIRFIELD FOR ${(input.work_description || 'WORK').toUpperCase()}` }, input.base_id)

  return { data: created, error: null }
}

export async function updateContractor(
  id: string,
  fields: {
    company_name?: string
    contact_name?: string | null
    location?: string
    work_description?: string
    status?: 'active' | 'completed'
    start_date?: string
    end_date?: string | null
    notes?: string | null
    radio_number?: string | null
    flag_number?: string | null
    callsign?: string | null
  }
): Promise<{ data: ContractorRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const updateFields: Record<string, unknown> = {
    ...fields,
    updated_at: new Date().toISOString(),
  }

  // Auto-set end_date when marking completed
  if (fields.status === 'completed' && !fields.end_date) {
    updateFields.end_date = new Date().toISOString().split('T')[0]
  }

  const { data, error } = await supabase
    .from('airfield_contractors')
    .update(updateFields as any)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update contractor:', error.message)
    return { data: null, error: error.message }
  }

  const updated = data as ContractorRow

  if (fields.status === 'completed') {
    logActivity('personnel_off_airfield', 'contractor', updated.id, undefined, { details: `${updated.company_name.toUpperCase()} OFF AIRFIELD` }, updated.base_id)
  } else {
    logActivity('updated', 'contractor', updated.id, updated.company_name, { details: `${updated.company_name.toUpperCase()} INFO UPDATED${fields.work_description ? `. ${fields.work_description.toUpperCase()}` : ''}` }, updated.base_id)
  }

  return { data: updated, error: null }
}
