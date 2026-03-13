import { createClient } from '@/lib/supabase/client'
import type { InspectionRow } from '@/lib/supabase/inspections'
import type { CheckRow } from '@/lib/supabase/checks'
import type { InspectionItem } from '@/lib/supabase/types'
import { fetchMapImageDataUrl } from '@/lib/utils'

// ── Types ──

export interface DiscrepancyWithReporter {
  id: string
  display_id: string
  title: string
  type: string
  location_text: string
  assigned_shop: string | null
  reported_by: string
  created_at: string
  // Joined
  reporter_name: string
  reporter_rank: string | null
}

export interface StatusUpdateWithContext {
  id: string
  discrepancy_id: string
  old_status: string | null
  new_status: string | null
  notes: string | null
  updated_by: string
  created_at: string
  // Joined from discrepancies
  discrepancy_display_id: string
  discrepancy_title: string
  // Joined from profiles
  user_name: string
  user_rank: string | null
}

export interface ObstructionEvalForReport {
  id: string
  display_id: string
  description: string | null
  object_height_agl: number
  latitude: number | null
  longitude: number | null
  has_violation: boolean
  controlling_surface: string | null
  violated_surfaces: string[]
  photo_storage_path: string | null
  evaluated_by: string
  created_at: string
  // Joined
  evaluator_name: string
  evaluator_rank: string | null
}

export interface PhotoForDailyReport {
  id: string
  storage_path: string
  file_name: string
  dataUrl: string | null
}

export interface ActivityEntryForReport {
  id: string
  action: string
  entity_type: string
  entity_display_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_name: string
  user_rank: string | null
}

export interface QrcExecutionForReport {
  id: string
  qrc_number: number
  title: string
  status: string
  opened_at: string
  open_initials: string | null
  closed_at: string | null
  close_initials: string | null
  scn_data: Record<string, unknown> | null
  total_steps: number
  completed_steps: number
  scn_field_labels: { key: string; label: string }[]
}

export interface OutageEventForReport {
  id: string
  feature_label: string | null
  feature_type: string | null
  system_name: string | null
  component_label: string | null
  event_type: string
  reporter_name: string
  reporter_rank: string | null
  created_at: string
}

export interface DailyReportData {
  inspections: (InspectionRow & { failed_items: InspectionItem[] })[]
  checks: CheckRow[]
  newDiscrepancies: DiscrepancyWithReporter[]
  statusUpdates: StatusUpdateWithContext[]
  obstructionEvals: ObstructionEvalForReport[]
  activityEntries: ActivityEntryForReport[]
  qrcExecutions: QrcExecutionForReport[]
  outageEvents: OutageEventForReport[]
  /** Photos keyed by entity — e.g. "check:<id>", "discrepancy:<id>", "obstruction:<id>" */
  photos: Record<string, PhotoForDailyReport[]>
}

// ── Data Fetching ──

export async function fetchDailyReportData(
  startUTC: string,
  endUTC: string,
  baseId?: string | null
): Promise<DailyReportData> {
  const supabase = createClient()

  const results = await Promise.all([
    fetchInspectionsForDate(supabase, startUTC, endUTC, baseId),
    fetchChecksForDate(supabase, startUTC, endUTC, baseId),
    fetchNewDiscrepanciesForDate(supabase, startUTC, endUTC, baseId),
    fetchStatusUpdatesForDate(supabase, startUTC, endUTC, baseId),
    fetchObstructionEvalsForDate(supabase, startUTC, endUTC, baseId),
    fetchActivityForDate(supabase, startUTC, endUTC, baseId),
    fetchQrcExecutionsForDate(supabase, startUTC, endUTC, baseId),
    fetchOutageEventsForDate(supabase, startUTC, endUTC, baseId),
  ])

  const checks = results[1] as CheckRow[]
  const newDiscrepancies = results[2] as DiscrepancyWithReporter[]
  const obstructionEvals = results[4] as ObstructionEvalForReport[]
  const activityEntries = results[5] as ActivityEntryForReport[]
  const qrcExecutions = results[6] as QrcExecutionForReport[]
  const outageEvents = results[7] as OutageEventForReport[]

  // Fetch photos for checks, discrepancies, and obstruction evaluations
  const photos = await fetchPhotosForDailyReport(
    supabase,
    checks.map((c) => c.id),
    newDiscrepancies.map((d) => d.id),
    obstructionEvals,
  )

  // Add Mapbox satellite map images for checks with coordinates
  for (const check of checks) {
    if (check.latitude != null && check.longitude != null) {
      const mapDataUrl = await fetchMapImageDataUrl(check.latitude, check.longitude)
      if (mapDataUrl) {
        const key = `check:${check.id}`
        if (!photos[key]) photos[key] = []
        photos[key].push({ id: `map-${check.id}`, storage_path: '', file_name: 'Location Map', dataUrl: mapDataUrl })
      }
    }
  }

  return {
    inspections: results[0],
    checks,
    newDiscrepancies,
    statusUpdates: results[3],
    obstructionEvals,
    activityEntries,
    qrcExecutions,
    outageEvents,
    photos,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInspectionsForDate(supabase: any, startUTC: string, endUTC: string, baseId?: string | null) {
  if (!supabase) return []

  let query = supabase
    .from('inspections')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) query = query.eq('base_id', baseId)

  const { data, error } = await query

  if (error) {
    console.error('Report: failed to fetch inspections:', error.message)
    return []
  }

  return ((data ?? []) as InspectionRow[]).map((insp) => ({
    ...insp,
    failed_items: (insp.items || []).filter((i: InspectionItem) => i.response === 'fail'),
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchChecksForDate(supabase: any, startUTC: string, endUTC: string, baseId?: string | null) {
  if (!supabase) return []

  let query = supabase
    .from('airfield_checks')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) query = query.eq('base_id', baseId)

  const { data, error } = await query

  if (error) {
    console.error('Report: failed to fetch checks:', error.message)
    return []
  }

  return (data ?? []) as CheckRow[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchNewDiscrepanciesForDate(supabase: any, startUTC: string, endUTC: string, baseId?: string | null) {
  if (!supabase) return []

  // Try with profile join
  let query = supabase
    .from('discrepancies')
    .select('id, display_id, title, type, location_text, assigned_shop, reported_by, created_at, profiles:reported_by(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) query = query.eq('base_id', baseId)

  const { data, error } = await query

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      reporter_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      reporter_rank: (row.profiles as { rank?: string } | null)?.rank || null,
    })) as DiscrepancyWithReporter[]
  }

  // Fallback
  let fbQuery = supabase
    .from('discrepancies')
    .select('id, display_id, title, type, location_text, assigned_shop, reported_by, created_at')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) fbQuery = fbQuery.eq('base_id', baseId)

  const { data: fb, error: fbErr } = await fbQuery

  if (fbErr) {
    console.error('Report: failed to fetch discrepancies:', fbErr.message)
    return []
  }

  return ((fb ?? []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    reporter_name: 'Unknown',
    reporter_rank: null,
  })) as DiscrepancyWithReporter[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchStatusUpdatesForDate(supabase: any, startUTC: string, endUTC: string, baseId?: string | null) {
  if (!supabase) return []

  // Try with profile + discrepancy join
  let query = supabase
    .from('status_updates')
    .select('*, profiles:updated_by(name, rank), discrepancies:discrepancy_id(display_id, title)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) query = query.eq('base_id', baseId)

  const { data, error } = await query

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      user_rank: (row.profiles as { rank?: string } | null)?.rank || null,
      discrepancy_display_id: (row.discrepancies as { display_id?: string } | null)?.display_id || 'Unknown',
      discrepancy_title: (row.discrepancies as { title?: string } | null)?.title || 'Unknown',
    })) as StatusUpdateWithContext[]
  }

  // Fallback without joins
  let fbQuery = supabase
    .from('status_updates')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) fbQuery = fbQuery.eq('base_id', baseId)

  const { data: fb, error: fbErr } = await fbQuery

  if (fbErr) {
    console.error('Report: failed to fetch status updates:', fbErr.message)
    return []
  }

  return ((fb ?? []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    user_name: 'Unknown',
    user_rank: null,
    discrepancy_display_id: 'Unknown',
    discrepancy_title: 'Unknown',
  })) as StatusUpdateWithContext[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchObstructionEvalsForDate(supabase: any, startUTC: string, endUTC: string, baseId?: string | null) {
  if (!supabase) return []

  // Try with profile join
  let query = supabase
    .from('obstruction_evaluations')
    .select('id, display_id, description, object_height_agl, latitude, longitude, has_violation, controlling_surface, violated_surfaces, photo_storage_path, evaluated_by, created_at, profiles:evaluated_by(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) query = query.eq('base_id', baseId)

  const { data, error } = await query

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      evaluator_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      evaluator_rank: (row.profiles as { rank?: string } | null)?.rank || null,
    })) as ObstructionEvalForReport[]
  }

  // Fallback
  let fbQuery = supabase
    .from('obstruction_evaluations')
    .select('id, display_id, description, object_height_agl, latitude, longitude, has_violation, controlling_surface, violated_surfaces, photo_storage_path, evaluated_by, created_at')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) fbQuery = fbQuery.eq('base_id', baseId)

  const { data: fb, error: fbErr } = await fbQuery

  if (fbErr) {
    console.error('Report: failed to fetch obstruction evals:', fbErr.message)
    return []
  }

  return ((fb ?? []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    evaluator_name: 'Unknown',
    evaluator_rank: null,
  })) as ObstructionEvalForReport[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchActivityForDate(supabase: any, startUTC: string, endUTC: string, baseId?: string | null) {
  if (!supabase) return []

  let query = supabase
    .from('activity_log')
    .select('id, action, entity_type, entity_display_id, metadata, created_at, profiles:user_id(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) query = query.eq('base_id', baseId)

  const { data, error } = await query

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      user_rank: (row.profiles as { rank?: string } | null)?.rank || null,
    })) as ActivityEntryForReport[]
  }

  // Fallback without join
  let fbQuery = supabase
    .from('activity_log')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) fbQuery = fbQuery.eq('base_id', baseId)

  const { data: fb, error: fbErr } = await fbQuery
  if (fbErr) {
    console.error('Report: failed to fetch activity:', fbErr.message)
    return []
  }

  return ((fb ?? []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    user_name: 'Unknown',
    user_rank: null,
  })) as ActivityEntryForReport[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchQrcExecutionsForDate(supabase: any, startUTC: string, endUTC: string, baseId?: string | null) {
  if (!supabase) return []

  const selectStr = '*, qrc_templates:template_id(steps, scn_fields, has_scn_form)'

  // Fetch executions opened during range (exclude cancelled)
  let q1 = supabase.from('qrc_executions').select(selectStr)
    .gte('opened_at', startUTC).lte('opened_at', endUTC)
    .neq('status', 'cancelled')
    .order('opened_at', { ascending: true })
  if (baseId) q1 = q1.eq('base_id', baseId)

  // Fetch executions closed during range (but opened before, exclude cancelled)
  let q2 = supabase.from('qrc_executions').select(selectStr)
    .lt('opened_at', startUTC)
    .gte('closed_at', startUTC).lte('closed_at', endUTC)
    .neq('status', 'cancelled')
    .order('opened_at', { ascending: true })
  if (baseId) q2 = q2.eq('base_id', baseId)

  const [r1, r2] = await Promise.all([q1, q2])

  if (r1.error && r2.error) {
    console.error('Report: failed to fetch QRC executions:', r1.error.message)
    return []
  }

  // Merge and deduplicate
  const allRows = [...(r1.data || []), ...(r2.data || [])] as Record<string, unknown>[]
  const seen = new Set<string>()
  const unique = allRows.filter((r) => {
    const id = r.id as string
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  return unique.map((row) => {
    const template = row.qrc_templates as { steps?: unknown[]; scn_fields?: Record<string, unknown>; has_scn_form?: boolean } | null
    const steps = (template?.steps || []) as { id: string; type?: string; sub_steps?: { id: string; type?: string }[] }[]

    // Flatten steps to count total (exclude conditionals)
    function flattenSteps(s: { id: string; type?: string; sub_steps?: { id: string; type?: string }[] }[]): string[] {
      const ids: string[] = []
      for (const step of s) {
        if (step.type !== 'conditional') ids.push(step.id)
        if (step.sub_steps) ids.push(...flattenSteps(step.sub_steps))
      }
      return ids
    }
    const allStepIds = flattenSteps(steps)
    const responses = (row.step_responses || {}) as Record<string, { completed?: boolean }>
    const completedCount = allStepIds.filter((id) => responses[id]?.completed).length

    // Extract SCN field labels
    const scnFields = template?.scn_fields as { fields?: { key: string; label: string }[] } | null
    const scnFieldLabels = (scnFields?.fields || []).map((f) => ({ key: f.key, label: f.label }))

    return {
      id: row.id,
      qrc_number: row.qrc_number,
      title: row.title,
      status: row.status,
      opened_at: row.opened_at,
      open_initials: row.open_initials,
      closed_at: row.closed_at,
      close_initials: row.close_initials,
      scn_data: row.scn_data,
      total_steps: allStepIds.length,
      completed_steps: completedCount,
      scn_field_labels: scnFieldLabels,
    }
  }) as QrcExecutionForReport[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchOutageEventsForDate(supabase: any, startUTC: string, endUTC: string, baseId?: string | null) {
  if (!supabase) return []

  let query = supabase
    .from('outage_events')
    .select('id, event_type, created_at, reported_by, feature_id, system_component_id, profiles:reported_by(name, rank), infrastructure_features:feature_id(label, feature_type), lighting_system_components:system_component_id(label, system_id, lighting_systems:system_id(name))')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (baseId) query = query.eq('base_id', baseId)

  const { data, error } = await query

  if (error) {
    // Fallback without complex joins
    let fbQuery = supabase
      .from('outage_events')
      .select('id, event_type, created_at, feature_id')
      .gte('created_at', startUTC)
      .lte('created_at', endUTC)
      .order('created_at', { ascending: true })

    if (baseId) fbQuery = fbQuery.eq('base_id', baseId)

    const { data: fb } = await fbQuery
    return ((fb ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id,
      feature_label: null,
      feature_type: null,
      system_name: null,
      component_label: null,
      event_type: r.event_type,
      reporter_name: 'Unknown',
      reporter_rank: null,
      created_at: r.created_at,
    })) as OutageEventForReport[]
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as { name?: string; rank?: string } | null
    const feature = row.infrastructure_features as { label?: string; feature_type?: string } | null
    const comp = row.lighting_system_components as { label?: string; lighting_systems?: { name?: string } | null } | null
    return {
      id: row.id as string,
      feature_label: feature?.label || null,
      feature_type: feature?.feature_type || null,
      system_name: comp?.lighting_systems?.name || null,
      component_label: comp?.label || null,
      event_type: row.event_type as string,
      reporter_name: profile?.name || 'Unknown',
      reporter_rank: profile?.rank || null,
      created_at: row.created_at as string,
    }
  }) as OutageEventForReport[]
}

// ── Photo Fetching ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPhotosForDailyReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  checkIds: string[],
  discrepancyIds: string[],
  obstructionEvals: ObstructionEvalForReport[],
): Promise<Record<string, PhotoForDailyReport[]>> {
  const photos: Record<string, PhotoForDailyReport[]> = {}
  if (!supabase) return photos

  // Fetch photos for checks
  if (checkIds.length > 0) {
    const { data: checkPhotos } = await supabase
      .from('photos')
      .select('id, check_id, storage_path, file_name')
      .in('check_id', checkIds)
      .order('created_at', { ascending: true })

    if (checkPhotos) {
      for (const row of checkPhotos as { id: string; check_id: string; storage_path: string; file_name: string }[]) {
        const key = `check:${row.check_id}`
        if (!photos[key]) photos[key] = []
        const dataUrl = await resolvePhotoUrl(supabase, row.storage_path)
        photos[key].push({ id: row.id, storage_path: row.storage_path, file_name: row.file_name, dataUrl })
      }
    }
  }

  // Fetch photos for discrepancies
  if (discrepancyIds.length > 0) {
    const { data: discPhotos } = await supabase
      .from('photos')
      .select('id, discrepancy_id, storage_path, file_name')
      .in('discrepancy_id', discrepancyIds)
      .order('created_at', { ascending: true })

    if (discPhotos) {
      for (const row of discPhotos as { id: string; discrepancy_id: string; storage_path: string; file_name: string }[]) {
        const key = `discrepancy:${row.discrepancy_id}`
        if (!photos[key]) photos[key] = []
        const dataUrl = await resolvePhotoUrl(supabase, row.storage_path)
        photos[key].push({ id: row.id, storage_path: row.storage_path, file_name: row.file_name, dataUrl })
      }
    }
  }

  // Resolve obstruction evaluation photos from photo_storage_path JSON
  for (const evalRow of obstructionEvals) {
    if (!evalRow.photo_storage_path) continue
    try {
      const paths: string[] = JSON.parse(evalRow.photo_storage_path)
      const key = `obstruction:${evalRow.id}`
      photos[key] = []
      for (const path of paths) {
        const dataUrl = await resolvePhotoUrl(supabase, path)
        const fileName = path.split('/').pop() || 'photo'
        photos[key].push({ id: `obs-${evalRow.id}-${fileName}`, storage_path: path, file_name: fileName, dataUrl })
      }
    } catch {
      // Invalid JSON in photo_storage_path
    }
  }

  return photos
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePhotoUrl(supabase: any, storagePath: string): Promise<string | null> {
  if (storagePath.startsWith('data:')) return storagePath
  try {
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(storagePath)
    if (urlData?.publicUrl) {
      const response = await fetch(urlData.publicUrl)
      if (response.ok) {
        const blob = await response.blob()
        // Resize large images to prevent jsPDF memory issues
        return await blobToResizedDataUrl(blob)
      }
    }
  } catch {
    // Storage not available
  }
  return null
}

/** Convert blob to a data URL, resizing large images to max 800px for PDF thumbnails. */
function blobToResizedDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 800
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > MAX || h > MAX) {
        const scale = Math.min(MAX / w, MAX / h)
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No canvas context')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      // Fallback to raw data URL if image can't be loaded into canvas
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    }
    img.src = url
  })
}
