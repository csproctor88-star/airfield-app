import { createClient } from './client'
import { logActivity } from './activity'
import { updateAirfieldStatus } from './airfield-status'
import type { InspectionType, InspectionItem } from './types'
import type { InspectionHalfDraft } from '@/lib/inspection-draft'

export type InspectionRow = {
  id: string
  display_id: string
  base_id: string | null
  inspection_type: InspectionType
  inspector_id: string
  inspector_name: string | null
  inspection_date: string
  status: 'in_progress' | 'completed'
  items: InspectionItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  completion_percent: number
  construction_meeting: boolean
  joint_monthly: boolean
  personnel: string[]
  bwc_value: string | null
  rsc_condition: string | null
  rcr_value: string | null
  rcr_condition: string | null
  weather_conditions: string | null
  temperature_f: number | null
  notes: string | null
  daily_group_id: string | null
  completed_by_name: string | null
  completed_by_id: string | null
  completed_at: string | null
  filed_by_name: string | null
  filed_by_id: string | null
  filed_at: string | null
  draft_data: InspectionHalfDraft | null
  saved_by_name: string | null
  saved_by_id: string | null
  saved_at: string | null
  created_at: string
  updated_at: string
}

export async function fetchInspections(baseId?: string | null, status?: 'in_progress' | 'completed'): Promise<InspectionRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  let query = supabase
    .from('inspections')
    .select('*')
    .order('created_at', { ascending: false })

  if (baseId) {
    query = query.eq('base_id', baseId)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch inspections:', error.message)
    return []
  }

  return (data ?? []) as InspectionRow[]
}

export async function fetchInspection(id: string): Promise<InspectionRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch inspection:', error.message)
    return null
  }

  return data as InspectionRow
}

/** Fetch both halves of a daily inspection by group ID */
export async function fetchDailyGroup(groupId: string): Promise<InspectionRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('daily_group_id', groupId)
    .order('inspection_type', { ascending: true })

  if (error) {
    console.error('Failed to fetch daily group:', error.message)
    return []
  }

  return (data ?? []) as InspectionRow[]
}

export async function createInspection(input: {
  inspection_type: InspectionType
  inspector_name: string
  items: InspectionItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  construction_meeting: boolean
  joint_monthly: boolean
  personnel?: string[]
  bwc_value: string | null
  rsc_condition?: string | null
  rcr_value?: string | null
  rcr_condition?: string | null
  weather_conditions: string | null
  temperature_f: number | null
  notes: string | null
  daily_group_id?: string | null
  completed_by_name?: string | null
  completed_by_id?: string | null
  completed_at?: string | null
  filed_by_name?: string | null
  filed_by_id?: string | null
  base_id?: string | null
}): Promise<{ data: InspectionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let inspector_id: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) inspector_id = user.id
  } catch {
    // No authenticated user
  }

  const now = new Date()
  const year = now.getFullYear()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const prefixMap: Record<string, string> = {
    airfield: 'AI',
    lighting: 'LI',
    construction_meeting: 'CM',
    joint_monthly: 'JM',
  }
  const prefix = prefixMap[input.inspection_type] || 'AI'
  const display_id = `${prefix}-${year}-${ts}`

  const completion_percent = input.total_items > 0
    ? Math.round(((input.passed_count + input.failed_count + input.na_count) / input.total_items) * 100)
    : 0

  const row: Record<string, unknown> = {
    display_id,
    inspection_type: input.inspection_type,
    inspector_name: input.inspector_name,
    inspection_date: now.toISOString().split('T')[0],
    status: 'completed',
    items: input.items,
    total_items: input.total_items,
    passed_count: input.passed_count,
    failed_count: input.failed_count,
    na_count: input.na_count,
    completion_percent,
    construction_meeting: input.construction_meeting,
    joint_monthly: input.joint_monthly,
    personnel: input.personnel || [],
    bwc_value: input.bwc_value,
    rsc_condition: input.rsc_condition || null,
    rcr_value: input.rcr_value || null,
    rcr_condition: input.rcr_condition || null,
    weather_conditions: input.weather_conditions,
    temperature_f: input.temperature_f,
    notes: input.notes,
    daily_group_id: input.daily_group_id || null,
    completed_by_name: input.completed_by_name || input.inspector_name,
    completed_by_id: input.completed_by_id || inspector_id || null,
    completed_at: input.completed_at || now.toISOString(),
    filed_by_name: input.filed_by_name || null,
    filed_by_id: input.filed_by_id || null,
    filed_at: now.toISOString(),
  }
  if (inspector_id) row.inspector_id = inspector_id
  if (input.base_id) row.base_id = input.base_id

  const { data, error } = await supabase
    .from('inspections')
    .insert(row as any)
    .select()
    .single()

  if (error) {
    console.error('Failed to create inspection:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as InspectionRow

  // Build formatted details matching manual entry template verbiage
  const failedItems = (input.items || []).filter(i => i.response === 'fail')
  const discNotes = failedItems.flatMap(i => {
    const notes: string[] = []
    if (i.notes) notes.push(i.notes)
    if (i.discrepancies) {
      for (const d of i.discrepancies) {
        if (d.comment) notes.push(d.comment)
      }
    }
    return notes
  }).filter(Boolean)
  const discStr = failedItems.length > 0
    ? `${failedItems.map(i => i.item).join(', ').toUpperCase()}${discNotes.length > 0 ? ` — ${discNotes.join('; ').toUpperCase()}` : ''}`
    : 'NO NEW DISCREPANCIES'
  const inspTypeLabel = input.inspection_type === 'lighting' ? 'LIGHTING' : input.inspection_type === 'construction_meeting' ? 'PRE/POST CONSTRUCTION' : input.inspection_type === 'joint_monthly' ? 'MONTHLY JOINT' : 'AFLD'
  let inspDetails = `${inspTypeLabel} INSPECTION CMPLT; ${discStr}`
  if (input.rsc_condition && input.bwc_value) inspDetails += `. ADVISES RSC/${input.rsc_condition.toUpperCase()} & BWC/${input.bwc_value.toUpperCase()}`
  else if (input.rsc_condition) inspDetails += `. ADVISES RSC/${input.rsc_condition.toUpperCase()}`
  else if (input.bwc_value) inspDetails += `. ADVISES BWC/${input.bwc_value.toUpperCase()}`
  logActivity('completed', 'inspection', created.id, created.display_id, { details: inspDetails }, input.base_id)

  // Auto-update airfield_status BWC from inspection
  if (input.bwc_value) {
    await updateAirfieldStatus({ bwc_value: input.bwc_value, bwc_updated_at: now.toISOString() }, input.base_id)
  }

  // Auto-update airfield_status RSC from inspection
  if (input.rsc_condition) {
    await updateAirfieldStatus({ rsc_condition: input.rsc_condition, rsc_updated_at: now.toISOString() }, input.base_id)
  }

  // Auto-update airfield_status RCR from inspection
  if (input.rcr_value) {
    await updateAirfieldStatus({
      rcr_touchdown: input.rcr_value,
      rcr_condition: input.rcr_condition || null,
      rcr_updated_at: now.toISOString(),
    }, input.base_id)
  } else if (input.rsc_condition && !input.rcr_value) {
    // RSC only — clear existing RCR so dashboard shows RSC
    await updateAirfieldStatus({
      rcr_touchdown: null, rcr_midpoint: null, rcr_rollout: null,
      rcr_condition: null, rcr_updated_at: null,
    }, input.base_id)
  }

  return { data: created, error: null }
}

/** Save (upsert) an inspection draft to the database.
 *  If `id` is provided, updates the existing row; otherwise inserts a new row. */
export async function saveInspectionDraft(input: {
  id?: string | null
  inspection_type: InspectionType
  draft_data: InspectionHalfDraft
  items: InspectionItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  bwc_value: string | null
  rsc_condition?: string | null
  rcr_value?: string | null
  rcr_condition?: string | null
  notes: string | null
  daily_group_id: string
  construction_meeting: boolean
  joint_monthly: boolean
  base_id?: string | null
}): Promise<{ data: InspectionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let userId: string | undefined
  let savedByName: string | null = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      userId = user.id
          const { data: profile } = await supabase
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
  const completion_percent = input.total_items > 0
    ? Math.round(((input.passed_count + input.failed_count + input.na_count) / input.total_items) * 100)
    : 0

  if (input.id) {
    // Update existing row
      const { data, error } = await supabase
      .from('inspections')
      .update({
        draft_data: input.draft_data as unknown as Record<string, unknown>,
        items: input.items,
        total_items: input.total_items,
        passed_count: input.passed_count,
        failed_count: input.failed_count,
        na_count: input.na_count,
        completion_percent,
        bwc_value: input.bwc_value,
        rsc_condition: input.rsc_condition || null,
        rcr_value: input.rcr_value || null,
        rcr_condition: input.rcr_condition || null,
        notes: input.notes,
        saved_by_name: savedByName,
        saved_by_id: userId || null,
        saved_at: now.toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update inspection draft:', error.message)
      return { data: null, error: error.message }
    }

    const updated = data as InspectionRow
    if (completion_percent >= 100) {
      const typeLabel = input.inspection_type === 'lighting' ? 'LIGHTING' : input.inspection_type === 'construction_meeting' ? 'PRE/POST CONSTRUCTION' : input.inspection_type === 'joint_monthly' ? 'MONTHLY JOINT' : 'AFLD'
      const draftFailed = (input.items || []).filter(i => i.response === 'fail')
      const draftDiscStr = draftFailed.length > 0
        ? draftFailed.map(i => i.item).join(', ').toUpperCase()
        : 'NO NEW DISCREPANCIES'
      let cmpltDetails = `${typeLabel} INSPECTION CMPLT; ${draftDiscStr}`
      if (input.rsc_condition && input.bwc_value) cmpltDetails += `. ADVISES RSC/${input.rsc_condition.toUpperCase()} & BWC/${input.bwc_value.toUpperCase()}`
      else if (input.rsc_condition) cmpltDetails += `. ADVISES RSC/${input.rsc_condition.toUpperCase()}`
      else if (input.bwc_value) cmpltDetails += `. ADVISES BWC/${input.bwc_value.toUpperCase()}`
      logActivity('completed', 'inspection', updated.id, updated.display_id, { details: cmpltDetails }, input.base_id)
    } else {
      logActivity('saved', 'inspection', updated.id, updated.display_id, { details: `AFLD INSPECTION IN-PROGRESS, ${completion_percent}% CMPLT` }, input.base_id)
    }
    return { data: updated, error: null }
  }

  // Insert new row
  const year = now.getFullYear()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const prefixMap: Record<string, string> = {
    airfield: 'AI',
    lighting: 'LI',
    construction_meeting: 'CM',
    joint_monthly: 'JM',
  }
  const prefix = prefixMap[input.inspection_type] || 'AI'
  const display_id = `${prefix}-${year}-${ts}`

  const row: Record<string, unknown> = {
    display_id,
    inspection_type: input.inspection_type,
    inspector_name: savedByName,
    inspection_date: now.toISOString().split('T')[0],
    status: 'in_progress',
    items: input.items,
    total_items: input.total_items,
    passed_count: input.passed_count,
    failed_count: input.failed_count,
    na_count: input.na_count,
    completion_percent,
    construction_meeting: input.construction_meeting,
    joint_monthly: input.joint_monthly,
    personnel: [],
    bwc_value: input.bwc_value,
    rsc_condition: input.rsc_condition || null,
    rcr_value: input.rcr_value || null,
    rcr_condition: input.rcr_condition || null,
    notes: input.notes,
    daily_group_id: input.daily_group_id,
    draft_data: input.draft_data,
    saved_by_name: savedByName,
    saved_by_id: userId || null,
    saved_at: now.toISOString(),
  }
  if (userId) row.inspector_id = userId
  if (input.base_id) row.base_id = input.base_id

  const { data, error } = await supabase
    .from('inspections')
    .insert(row as any)
    .select()
    .single()

  if (error) {
    console.error('Failed to save inspection draft:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as InspectionRow
  if (completion_percent >= 100) {
    const newTypeLabel = input.inspection_type === 'lighting' ? 'LIGHTING' : input.inspection_type === 'construction_meeting' ? 'PRE/POST CONSTRUCTION' : input.inspection_type === 'joint_monthly' ? 'MONTHLY JOINT' : 'AFLD'
    const newDraftFailed = (input.items || []).filter(i => i.response === 'fail')
    const newDraftDiscStr = newDraftFailed.length > 0
      ? newDraftFailed.map(i => i.item).join(', ').toUpperCase()
      : 'NO NEW DISCREPANCIES'
    let newCmpltDetails = `${newTypeLabel} INSPECTION CMPLT; ${newDraftDiscStr}`
    if (input.rsc_condition && input.bwc_value) newCmpltDetails += `. ADVISES RSC/${input.rsc_condition.toUpperCase()} & BWC/${input.bwc_value.toUpperCase()}`
    else if (input.rsc_condition) newCmpltDetails += `. ADVISES RSC/${input.rsc_condition.toUpperCase()}`
    else if (input.bwc_value) newCmpltDetails += `. ADVISES BWC/${input.bwc_value.toUpperCase()}`
    logActivity('completed', 'inspection', created.id, created.display_id, { details: newCmpltDetails }, input.base_id)
  } else {
    logActivity('saved', 'inspection', created.id, created.display_id, { details: `AFLD INSPECTION IN-PROGRESS, ${completion_percent}% CMPLT` }, input.base_id)
  }
  return { data: created, error: null }
}

/** File (finalize) an in-progress inspection: set status to completed, clear draft_data */
export async function fileInspection(input: {
  id: string
  items: InspectionItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  bwc_value: string | null
  rsc_condition?: string | null
  rcr_value?: string | null
  rcr_condition?: string | null
  weather_conditions: string | null
  temperature_f: number | null
  notes: string | null
  inspector_name: string
  completed_by_name: string
  completed_by_id: string | null
  completed_at: string
  filed_by_name: string
  filed_by_id: string | null
  personnel?: string[]
  construction_meeting?: boolean
  joint_monthly?: boolean
  base_id?: string | null
}): Promise<{ data: InspectionRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const now = new Date()
  const completion_percent = input.total_items > 0
    ? Math.round(((input.passed_count + input.failed_count + input.na_count) / input.total_items) * 100)
    : 0

  const { data, error } = await supabase
    .from('inspections')
    .update({
      status: 'completed',
      items: input.items,
      total_items: input.total_items,
      passed_count: input.passed_count,
      failed_count: input.failed_count,
      na_count: input.na_count,
      completion_percent,
      bwc_value: input.bwc_value,
      rsc_condition: input.rsc_condition || null,
      rcr_value: input.rcr_value || null,
      rcr_condition: input.rcr_condition || null,
      weather_conditions: input.weather_conditions,
      temperature_f: input.temperature_f,
      notes: input.notes,
      inspector_name: input.inspector_name,
      completed_by_name: input.completed_by_name,
      completed_by_id: input.completed_by_id,
      completed_at: input.completed_at,
      filed_by_name: input.filed_by_name,
      filed_by_id: input.filed_by_id,
      filed_at: now.toISOString(),
      draft_data: null,
      saved_at: null,
      saved_by_name: null,
      saved_by_id: null,
      ...(input.personnel !== undefined ? { personnel: input.personnel } : {}),
      ...(input.construction_meeting !== undefined ? { construction_meeting: input.construction_meeting } : {}),
      ...(input.joint_monthly !== undefined ? { joint_monthly: input.joint_monthly } : {}),
    })
    .eq('id', input.id)
    .select()
    .single()

  if (error) {
    console.error('Failed to file inspection:', error.message)
    return { data: null, error: error.message }
  }

  const filed = data as InspectionRow

  // Auto-update airfield_status BWC from filed inspection
  if (input.bwc_value) {
    await updateAirfieldStatus({ bwc_value: input.bwc_value, bwc_updated_at: new Date().toISOString() }, input.base_id)
  }

  // Auto-update airfield_status RSC from filed inspection
  if (input.rsc_condition) {
    await updateAirfieldStatus({ rsc_condition: input.rsc_condition, rsc_updated_at: new Date().toISOString() }, input.base_id)
  }

  // Auto-update airfield_status RCR from filed inspection
  if (input.rcr_value) {
    await updateAirfieldStatus({
      rcr_touchdown: input.rcr_value,
      rcr_condition: input.rcr_condition || null,
      rcr_updated_at: new Date().toISOString(),
    }, input.base_id)
  } else if (input.rsc_condition && !input.rcr_value) {
    // RSC only — clear existing RCR so dashboard shows RSC
    await updateAirfieldStatus({
      rcr_touchdown: null, rcr_midpoint: null, rcr_rollout: null,
      rcr_condition: null, rcr_updated_at: null,
    }, input.base_id)
  }

  return { data: filed, error: null }
}

/** Get the current user's profile name for auto-fill */
export async function getInspectorName(): Promise<{ name: string | null; id: string | null }> {
  const supabase = createClient()
  if (!supabase) return { name: null, id: null }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { name: null, id: null }

      const { data: profile } = await supabase
      .from('profiles')
      .select('name, rank')
      .eq('id', user.id)
      .single()

    if (profile) {
      const displayName = profile.rank
        ? `${profile.rank} ${profile.name}`
        : profile.name
      return { name: displayName, id: user.id }
    }

    return { name: user.email || null, id: user.id }
  } catch {
    return { name: null, id: null }
  }
}

// ── Inspection Photo Types & Functions ──

export type InspectionPhotoRow = {
  id: string
  inspection_id: string | null
  inspection_item_id: string | null
  issue_index: number | null
  storage_path: string
  file_name: string
  file_size: number | null
  mime_type: string
  latitude: number | null
  longitude: number | null
  created_at: string
}

export async function uploadInspectionPhoto(
  inspectionId: string,
  file: File,
  itemId?: string | null,
  latitude?: number | null,
  longitude?: number | null,
  baseId?: string | null,
  discIndex?: number | null,
): Promise<{ data: InspectionPhotoRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const ext = file.name.split('.').pop() || 'jpg'
  const storagePath = `inspection-photos/${inspectionId}/${Date.now()}.${ext}`

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

  const photoRow: Record<string, unknown> = {
    inspection_id: inspectionId,
    inspection_item_id: itemId || null,
    storage_path: storageUrl,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'image/jpeg',
  }
  if (uploaded_by) photoRow.uploaded_by = uploaded_by
  if (baseId) photoRow.base_id = baseId
  if (latitude != null) photoRow.latitude = latitude
  if (longitude != null) photoRow.longitude = longitude
  if (discIndex != null) photoRow.issue_index = discIndex

  const { data, error } = await supabase
    .from('photos')
    .insert(photoRow as any)
    .select()
    .single()

  if (error) {
    console.error('Inspection photo insert failed:', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as InspectionPhotoRow, error: null }
}

export async function fetchInspectionPhotos(inspectionId: string): Promise<InspectionPhotoRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch inspection photos:', error.message)
    return []
  }

  return data as InspectionPhotoRow[]
}

export async function deleteInspection(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: existing } = await supabase.from('inspections').select('display_id, inspection_type, base_id').eq('id', id).single()

  const { error } = await supabase
    .from('inspections')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Delete inspection failed:', error.message)
    return { error: error.message }
  }

  logActivity('deleted', 'inspection', id, existing?.display_id, { details: 'AFLD INSPECTION DELETED' }, existing?.base_id)

  return { error: null }
}

export async function updateInspectionNotes(id: string, notes: string | null): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: existing } = await supabase.from('inspections').select('display_id, base_id').eq('id', id).single()

  const { error } = await supabase
    .from('inspections')
    .update({ notes })
    .eq('id', id)

  if (error) {
    console.error('Update inspection notes failed:', error.message)
    return { error: error.message }
  }

  logActivity('updated', 'inspection', id, existing?.display_id, { details: 'UPDATED AIRFIELD INSPECTION FORM' }, existing?.base_id)

  return { error: null }
}
