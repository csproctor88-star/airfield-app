import { createClient } from '@/lib/supabase/client'
import type { InspectionRow } from '@/lib/supabase/inspections'
import type { CheckRow } from '@/lib/supabase/checks'
import type { InspectionItem } from '@/lib/supabase/types'

// ── Types ──

export interface DiscrepancyWithReporter {
  id: string
  display_id: string
  title: string
  type: string
  severity: string
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

export interface DailyReportData {
  inspections: (InspectionRow & { failed_items: InspectionItem[] })[]
  checks: CheckRow[]
  newDiscrepancies: DiscrepancyWithReporter[]
  statusUpdates: StatusUpdateWithContext[]
  obstructionEvals: ObstructionEvalForReport[]
  /** Photos keyed by entity — e.g. "check:<id>", "discrepancy:<id>", "obstruction:<id>" */
  photos: Record<string, PhotoForDailyReport[]>
}

// ── Data Fetching ──

export async function fetchDailyReportData(
  startUTC: string,
  endUTC: string
): Promise<DailyReportData> {
  const supabase = createClient()

  const results = await Promise.all([
    fetchInspectionsForDate(supabase, startUTC, endUTC),
    fetchChecksForDate(supabase, startUTC, endUTC),
    fetchNewDiscrepanciesForDate(supabase, startUTC, endUTC),
    fetchStatusUpdatesForDate(supabase, startUTC, endUTC),
    fetchObstructionEvalsForDate(supabase, startUTC, endUTC),
  ])

  const checks = results[1] as CheckRow[]
  const newDiscrepancies = results[2] as DiscrepancyWithReporter[]
  const obstructionEvals = results[4] as ObstructionEvalForReport[]

  // Fetch photos for checks, discrepancies, and obstruction evaluations
  const photos = await fetchPhotosForDailyReport(
    supabase,
    checks.map((c) => c.id),
    newDiscrepancies.map((d) => d.id),
    obstructionEvals,
  )

  return {
    inspections: results[0],
    checks,
    newDiscrepancies,
    statusUpdates: results[3],
    obstructionEvals,
    photos,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInspectionsForDate(supabase: any, startUTC: string, endUTC: string) {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

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
async function fetchChecksForDate(supabase: any, startUTC: string, endUTC: string) {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('airfield_checks')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Report: failed to fetch checks:', error.message)
    return []
  }

  return (data ?? []) as CheckRow[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchNewDiscrepanciesForDate(supabase: any, startUTC: string, endUTC: string) {
  if (!supabase) return []

  // Try with profile join
  const { data, error } = await supabase
    .from('discrepancies')
    .select('id, display_id, title, type, severity, location_text, assigned_shop, reported_by, created_at, profiles:reported_by(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      reporter_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      reporter_rank: (row.profiles as { rank?: string } | null)?.rank || null,
    })) as DiscrepancyWithReporter[]
  }

  // Fallback
  const { data: fb, error: fbErr } = await supabase
    .from('discrepancies')
    .select('id, display_id, title, type, severity, location_text, assigned_shop, reported_by, created_at')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

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
async function fetchStatusUpdatesForDate(supabase: any, startUTC: string, endUTC: string) {
  if (!supabase) return []

  // Try with profile + discrepancy join
  const { data, error } = await supabase
    .from('status_updates')
    .select('*, profiles:updated_by(name, rank), discrepancies:discrepancy_id(display_id, title)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

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
  const { data: fb, error: fbErr } = await supabase
    .from('status_updates')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

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
async function fetchObstructionEvalsForDate(supabase: any, startUTC: string, endUTC: string) {
  if (!supabase) return []

  // Try with profile join
  const { data, error } = await supabase
    .from('obstruction_evaluations')
    .select('id, display_id, description, object_height_agl, latitude, longitude, has_violation, controlling_surface, violated_surfaces, photo_storage_path, evaluated_by, created_at, profiles:evaluated_by(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      evaluator_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      evaluator_rank: (row.profiles as { rank?: string } | null)?.rank || null,
    })) as ObstructionEvalForReport[]
  }

  // Fallback
  const { data: fb, error: fbErr } = await supabase
    .from('obstruction_evaluations')
    .select('id, display_id, description, object_height_agl, latitude, longitude, has_violation, controlling_surface, violated_surfaces, photo_storage_path, evaluated_by, created_at')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

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
        return await blobToDataUrl(blob)
      }
    }
  } catch {
    // Storage not available
  }
  return null
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
