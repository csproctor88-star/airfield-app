import { createClient } from './client'
import { logActivity } from './activity'
import type { AcsiInspection, AcsiItem, AcsiTeamMember, AcsiSignatureBlock, AcsiDraftData } from './types'

export async function fetchAcsiInspections(baseId?: string | null): Promise<AcsiInspection[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('acsi_inspections')
    .select('*')
    .order('created_at', { ascending: false })

  if (baseId) {
    query = query.eq('base_id', baseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch ACSI inspections:', error.message)
    return []
  }

  return (data ?? []) as AcsiInspection[]
}

export async function fetchAcsiInspection(id: string): Promise<AcsiInspection | null> {
  const supabase = createClient()
  if (!supabase) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('acsi_inspections')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch ACSI inspection:', error.message)
    return null
  }

  return data as AcsiInspection
}

/** Save (upsert) an ACSI draft to the database.
 *  If `id` is provided, updates; otherwise inserts. */
export async function saveAcsiDraft(input: {
  id?: string | null
  airfield_name: string
  inspection_date: string
  fiscal_year: number
  items: AcsiItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  inspection_team: AcsiTeamMember[]
  risk_cert_signatures: AcsiSignatureBlock[]
  notes: string | null
  draft_data: AcsiDraftData
  base_id?: string | null
}): Promise<{ data: AcsiInspection | null; error: string | null }> {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('acsi_inspections')
      .update({
        airfield_name: input.airfield_name,
        inspection_date: input.inspection_date,
        fiscal_year: input.fiscal_year,
        items: input.items,
        total_items: input.total_items,
        passed_count: input.passed_count,
        failed_count: input.failed_count,
        na_count: input.na_count,
        inspection_team: input.inspection_team,
        risk_cert_signatures: input.risk_cert_signatures,
        notes: input.notes,
        draft_data: input.draft_data,
        saved_by_name: savedByName,
        saved_by_id: userId || null,
        saved_at: now.toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update ACSI draft:', error.message)
      return { data: null, error: error.message }
    }

    const updated = data as AcsiInspection
    logActivity('saved', 'acsi_inspection', updated.id, updated.display_id, {}, input.base_id)
    return { data: updated, error: null }
  }

  // Insert new row
  const year = now.getFullYear()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `ACSI-${year}-${ts}`

  const row: Record<string, unknown> = {
    display_id,
    airfield_name: input.airfield_name,
    inspection_date: input.inspection_date,
    fiscal_year: input.fiscal_year,
    status: 'draft',
    items: input.items,
    total_items: input.total_items,
    passed_count: input.passed_count,
    failed_count: input.failed_count,
    na_count: input.na_count,
    inspection_team: input.inspection_team,
    risk_cert_signatures: input.risk_cert_signatures,
    notes: input.notes,
    draft_data: input.draft_data,
    inspector_name: savedByName,
    saved_by_name: savedByName,
    saved_by_id: userId || null,
    saved_at: now.toISOString(),
  }
  if (userId) row.inspector_id = userId
  if (input.base_id) row.base_id = input.base_id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('acsi_inspections')
    .insert(row)
    .select()
    .single()

  if (error) {
    console.error('Failed to save ACSI draft:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as AcsiInspection
  logActivity('saved', 'acsi_inspection', created.id, created.display_id, {}, input.base_id)
  return { data: created, error: null }
}

/** File (finalize) an ACSI inspection: set status to completed, clear draft_data */
export async function fileAcsiInspection(input: {
  id: string
  items: AcsiItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  airfield_name: string
  inspection_date: string
  fiscal_year: number
  inspection_team: AcsiTeamMember[]
  risk_cert_signatures: AcsiSignatureBlock[]
  notes: string | null
  inspector_name: string
  completed_by_name: string
  completed_by_id: string | null
  base_id?: string | null
}): Promise<{ data: AcsiInspection | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const now = new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('acsi_inspections')
    .update({
      status: 'completed',
      items: input.items,
      total_items: input.total_items,
      passed_count: input.passed_count,
      failed_count: input.failed_count,
      na_count: input.na_count,
      airfield_name: input.airfield_name,
      inspection_date: input.inspection_date,
      fiscal_year: input.fiscal_year,
      inspection_team: input.inspection_team,
      risk_cert_signatures: input.risk_cert_signatures,
      notes: input.notes,
      inspector_name: input.inspector_name,
      completed_by_name: input.completed_by_name,
      completed_by_id: input.completed_by_id,
      completed_at: now.toISOString(),
      filed_at: now.toISOString(),
      filed_by_name: input.completed_by_name,
      filed_by_id: input.completed_by_id,
      draft_data: null,
      saved_at: null,
      saved_by_name: null,
      saved_by_id: null,
    })
    .eq('id', input.id)
    .select()
    .single()

  if (error) {
    console.error('Failed to file ACSI inspection:', error.message)
    return { data: null, error: error.message }
  }

  const filed = data as AcsiInspection
  logActivity('filed', 'acsi_inspection', filed.id, filed.display_id, {}, input.base_id)
  return { data: filed, error: null }
}

export async function deleteAcsiInspection(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('acsi_inspections')
    .select('display_id, base_id')
    .eq('id', id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('acsi_inspections')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Delete ACSI inspection failed:', error.message)
    return { error: error.message }
  }

  logActivity('deleted', 'acsi_inspection', id, existing?.display_id, {}, existing?.base_id)
  return { error: null }
}

// ── ACSI Photo Functions ──

export type AcsiPhotoRow = {
  id: string
  acsi_inspection_id: string | null
  acsi_item_id: string | null
  storage_path: string
  file_name: string
  file_size: number | null
  mime_type: string
  created_at: string
}

export async function uploadAcsiPhoto(
  inspectionId: string,
  file: File,
  itemId?: string | null,
  baseId?: string | null,
  discrepancyIndex?: number,
): Promise<{ data: AcsiPhotoRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `acsi-photos/${inspectionId}/${Date.now()}.${ext}`

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
    acsi_inspection_id: inspectionId,
    acsi_item_id: itemId ? (discrepancyIndex != null ? `${itemId}:${discrepancyIndex}` : itemId) : null,
    storage_path: storageUrl,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'image/jpeg',
  }
  if (uploaded_by) photoRow.uploaded_by = uploaded_by
  if (baseId) photoRow.base_id = baseId

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('photos')
    .insert(photoRow)
    .select()
    .single()

  if (error) {
    console.error('ACSI photo insert failed:', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as AcsiPhotoRow, error: null }
}

export async function fetchAcsiPhotos(inspectionId: string): Promise<AcsiPhotoRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('photos')
    .select('*')
    .eq('acsi_inspection_id', inspectionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch ACSI photos:', error.message)
    return []
  }

  return data as AcsiPhotoRow[]
}
