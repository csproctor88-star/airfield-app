import { createClient } from '@/lib/supabase/client'
import type { InspectionRow } from '@/lib/supabase/inspections'
import type { CheckRow } from '@/lib/supabase/checks'
import type { RunwayStatusLogRow } from '@/lib/supabase/airfield-status'
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
  evaluated_by: string
  created_at: string
  // Joined
  evaluator_name: string
  evaluator_rank: string | null
}

export interface DailyReportData {
  inspections: (InspectionRow & { failed_items: InspectionItem[] })[]
  checks: CheckRow[]
  runwayChanges: RunwayStatusLogRow[]
  newDiscrepancies: DiscrepancyWithReporter[]
  statusUpdates: StatusUpdateWithContext[]
  obstructionEvals: ObstructionEvalForReport[]
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
    fetchRunwayChangesForDate(supabase, startUTC, endUTC),
    fetchNewDiscrepanciesForDate(supabase, startUTC, endUTC),
    fetchStatusUpdatesForDate(supabase, startUTC, endUTC),
    fetchObstructionEvalsForDate(supabase, startUTC, endUTC),
  ])

  return {
    inspections: results[0],
    checks: results[1],
    runwayChanges: results[2],
    newDiscrepancies: results[3],
    statusUpdates: results[4],
    obstructionEvals: results[5],
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
async function fetchRunwayChangesForDate(supabase: any, startUTC: string, endUTC: string) {
  if (!supabase) return []

  // Try with profile join
  const { data, error } = await supabase
    .from('runway_status_log')
    .select('*, profiles:changed_by(name, rank)')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (!error && data) {
    return (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      user_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
      user_rank: (row.profiles as { rank?: string } | null)?.rank || undefined,
    })) as RunwayStatusLogRow[]
  }

  // Fallback
  const { data: fb, error: fbErr } = await supabase
    .from('runway_status_log')
    .select('*')
    .gte('created_at', startUTC)
    .lte('created_at', endUTC)
    .order('created_at', { ascending: true })

  if (fbErr) {
    console.error('Report: failed to fetch runway status log:', fbErr.message)
    return []
  }

  return ((fb ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, user_name: 'Unknown' })) as RunwayStatusLogRow[]
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
    .select('id, display_id, description, object_height_agl, latitude, longitude, has_violation, controlling_surface, violated_surfaces, evaluated_by, created_at, profiles:evaluated_by(name, rank)')
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
    .select('id, display_id, description, object_height_agl, latitude, longitude, has_violation, controlling_surface, violated_surfaces, evaluated_by, created_at')
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
