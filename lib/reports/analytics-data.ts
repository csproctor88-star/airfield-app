import { createClient } from '@/lib/supabase/client'

interface InspectionMetrics {
  completed: number
  avgMinutes: number | null
  passRate: number | null
}

export interface AnalyticsData {
  // Inspections — split by type
  airfieldInspections: InspectionMetrics
  lightingInspections: InspectionMetrics
  // Checks
  checks: {
    last30Days: number
    avgPerDay: number
    avgCompletionMinutes: number | null
    byType: { type: string; count: number }[]
  }
  // Discrepancies
  discrepancies: {
    currentOpen: number
    avgDaysToClose: number | null
    openedLast30: number
    closedLast30: number
  }
  // Personnel
  personnel: {
    activeToday: number
    avgPerDay: number | null
  }
  // QRC
  qrc: {
    executionsLast30: number
    avgResponseMinutes: number | null
  }
  // Wildlife
  wildlife: {
    sightings: number
    strikes: number
    topSpecies: string | null
  }
  // Obstructions
  obstructions: {
    evaluated: number
    violations: number
  }
  // Parking Plans
  parking: {
    totalPlans: number
    createdInPeriod: number
    activePlan: string | null
  }
}

const EMPTY_INSP: InspectionMetrics = { completed: 0, avgMinutes: null, passRate: null }

/** Pair "started" → "completed" activity entries chronologically by detected type.
 *  Each "started" of a given type pairs with the next "completed" of the same type. */
function pairStartCompleteByType(
  entries: { action: string; created_at: string; metadata: any }[],
  detectType: (details: string) => string | null,
): { type: string; startedAt: string; completedAt: string }[] {
  const pairs: { type: string; startedAt: string; completedAt: string }[] = []
  // Track the most recent unmatched "started" per type
  const pending: Record<string, string> = {} // type → startedAt

  for (const entry of entries) {
    const details = (entry.metadata?.details as string) || ''
    const type = detectType(details)
    if (!type) continue

    if (entry.action === 'started') {
      pending[type] = entry.created_at
    } else if (entry.action === 'completed' && pending[type]) {
      pairs.push({ type, startedAt: pending[type], completedAt: entry.created_at })
      delete pending[type]
    }
  }
  return pairs
}

const EMPTY: AnalyticsData = {
  airfieldInspections: EMPTY_INSP,
  lightingInspections: EMPTY_INSP,
  checks: { last30Days: 0, avgPerDay: 0, avgCompletionMinutes: null, byType: [] },
  discrepancies: { currentOpen: 0, avgDaysToClose: null, openedLast30: 0, closedLast30: 0 },
  personnel: { activeToday: 0, avgPerDay: null },
  qrc: { executionsLast30: 0, avgResponseMinutes: null },
  wildlife: { sightings: 0, strikes: 0, topSpecies: null },
  obstructions: { evaluated: 0, violations: 0 },
  parking: { totalPlans: 0, createdInPeriod: 0, activePlan: null },
}

export async function fetchAnalyticsData(baseId: string | null, days = 30): Promise<AnalyticsData> {
  const supabase = createClient()
  if (!supabase || !baseId) return EMPTY

  const now = new Date()
  const since = new Date(now.getTime() - days * 86400000).toISOString()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  try {
    const [
      inspectionData,
      checkData,
      discrepancyData,
      personnelData,
      qrcData,
      wildlifeData,
      obstructionData,
      parkingData,
    ] = await Promise.all([
      fetchInspectionAnalytics(supabase, baseId, since),
      fetchCheckAnalytics(supabase, baseId, since),
      fetchDiscrepancyAnalytics(supabase, baseId, since),
      fetchPersonnelAnalytics(supabase, baseId, todayStart, since),
      fetchQrcAnalytics(supabase, baseId, since),
      fetchWildlifeAnalytics(supabase, baseId, since),
      fetchObstructionAnalytics(supabase, baseId, since),
      fetchParkingAnalytics(supabase, baseId, since),
    ])

    return {
      airfieldInspections: inspectionData.airfield,
      lightingInspections: inspectionData.lighting,
      checks: checkData,
      discrepancies: discrepancyData,
      personnel: personnelData,
      qrc: qrcData,
      wildlife: wildlifeData,
      obstructions: obstructionData,
      parking: parkingData,
    }
  } catch (e) {
    console.error('Analytics fetch failed:', e)
    return EMPTY
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInspectionAnalytics(supabase: any, baseId: string, since: string) {
  // Fetch completed inspections for pass rate + counts
  const { data } = await supabase
    .from('inspections')
    .select('id, inspection_type, passed_count, failed_count, na_count')
    .eq('base_id', baseId)
    .eq('status', 'completed')
    .gte('created_at', since)

  const rows = (data ?? []) as { id: string; inspection_type: string; passed_count: number; failed_count: number; na_count: number }[]

  // Fetch activity log start/complete entries for actual on-airfield time
  // Note: "started" uses installationId as entity_id, "completed" uses the inspection row ID.
  // So we pair them chronologically by type (detected from metadata.details text).
  const { data: activityRows } = await supabase
    .from('activity_log')
    .select('action, created_at, metadata')
    .eq('base_id', baseId)
    .eq('entity_type', 'inspection')
    .in('action', ['started', 'completed'])
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  // Pair started→completed chronologically per type
  const inspTimings = pairStartCompleteByType(
    (activityRows ?? []) as { action: string; created_at: string; metadata: any }[],
    (details: string) => {
      if (details.includes('Airfield')) return 'airfield'
      if (details.includes('Lighting')) return 'lighting'
      return null
    },
  )

  function calcMetrics(filtered: typeof rows, type: string): InspectionMetrics {
    let totalMinutes = 0
    let completedWithTime = 0
    let totalPassed = 0
    let totalItems = 0

    const pairs = inspTimings.filter(p => p.type === type)
    for (const pair of pairs) {
      const mins = (new Date(pair.completedAt).getTime() - new Date(pair.startedAt).getTime()) / 60000
      if (mins > 0 && mins < 1440) {
        totalMinutes += mins
        completedWithTime++
      }
    }

    for (const r of filtered) {
      totalPassed += r.passed_count || 0
      totalItems += (r.passed_count || 0) + (r.failed_count || 0) + (r.na_count || 0)
    }

    return {
      completed: filtered.length,
      avgMinutes: completedWithTime > 0 ? Math.round(totalMinutes / completedWithTime) : null,
      passRate: totalItems > 0 ? Math.round((totalPassed / totalItems) * 100) : null,
    }
  }

  return {
    airfield: calcMetrics(rows.filter(r => r.inspection_type === 'airfield'), 'airfield'),
    lighting: calcMetrics(rows.filter(r => r.inspection_type === 'lighting'), 'lighting'),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCheckAnalytics(supabase: any, baseId: string, since: string) {
  const { data } = await supabase
    .from('airfield_checks')
    .select('check_type, created_at')
    .eq('base_id', baseId)
    .gte('created_at', since)

  const rows = (data ?? []) as { check_type: string; created_at: string }[]

  const typeCounts: Record<string, number> = {}
  const dayCounts: Record<string, number> = {}

  for (const r of rows) {
    typeCounts[r.check_type] = (typeCounts[r.check_type] || 0) + 1
    const day = r.created_at.slice(0, 10)
    dayCounts[day] = (dayCounts[day] || 0) + 1
  }

  // Use activity log started→completed pairs for actual on-airfield time
  // Note: "started" uses installationId as entity_id, "completed" uses check ID — pair chronologically
  const { data: activityRows } = await supabase
    .from('activity_log')
    .select('action, created_at, metadata')
    .eq('base_id', baseId)
    .eq('entity_type', 'airfield_check')
    .in('action', ['started', 'completed'])
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  // For checks, all are the same "type" so use a constant
  const checkTimings = pairStartCompleteByType(
    (activityRows ?? []) as { action: string; created_at: string; metadata: any }[],
    () => 'check', // all check entries are the same type
  )

  let totalMinutes = 0
  let completedWithTime = 0
  for (const pair of checkTimings) {
    const mins = (new Date(pair.completedAt).getTime() - new Date(pair.startedAt).getTime()) / 60000
    if (mins > 0 && mins < 480) { // exclude >8h as unreasonable
      totalMinutes += mins
      completedWithTime++
    }
  }

  const uniqueDays = Object.keys(dayCounts).length
  const byType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }))

  return {
    last30Days: rows.length,
    avgPerDay: uniqueDays > 0 ? Math.round((rows.length / uniqueDays) * 10) / 10 : 0,
    avgCompletionMinutes: completedWithTime > 0 ? Math.round(totalMinutes / completedWithTime) : null,
    byType,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchDiscrepancyAnalytics(supabase: any, baseId: string, since: string) {
  // Current open count
  const { data: openData } = await supabase
    .from('discrepancies')
    .select('id')
    .eq('base_id', baseId)
    .eq('status', 'open')

  // Opened in last 30 days
  const { data: openedData } = await supabase
    .from('discrepancies')
    .select('id')
    .eq('base_id', baseId)
    .gte('created_at', since)

  // Closed in last 30 days (with resolution timing)
  const { data: closedData } = await supabase
    .from('discrepancies')
    .select('created_at, resolution_date, updated_at')
    .eq('base_id', baseId)
    .in('status', ['completed', 'cancelled'])
    .gte('updated_at', since)

  const closedRows = (closedData ?? []) as { created_at: string; resolution_date: string | null; updated_at: string }[]

  let totalDays = 0
  let countWithTime = 0
  for (const r of closedRows) {
    const closeDate = r.resolution_date || r.updated_at
    const days = (new Date(closeDate).getTime() - new Date(r.created_at).getTime()) / 86400000
    if (days >= 0) {
      totalDays += days
      countWithTime++
    }
  }

  return {
    currentOpen: (openData ?? []).length,
    avgDaysToClose: countWithTime > 0 ? Math.round(totalDays / countWithTime) : null,
    openedLast30: (openedData ?? []).length,
    closedLast30: closedRows.length,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPersonnelAnalytics(supabase: any, baseId: string, todayStart: string, since: string) {
  // Active today
  const { data: todayData } = await supabase
    .from('airfield_contractors')
    .select('id')
    .eq('base_id', baseId)
    .eq('status', 'active')

  // Get all records from last 30 days for avg per day
  const { data: recentData } = await supabase
    .from('airfield_contractors')
    .select('start_date')
    .eq('base_id', baseId)
    .gte('start_date', since.slice(0, 10))

  const recentRows = (recentData ?? []) as { start_date: string }[]
  const dayCounts: Record<string, number> = {}
  for (const r of recentRows) {
    const day = r.start_date
    dayCounts[day] = (dayCounts[day] || 0) + 1
  }
  const uniqueDays = Object.keys(dayCounts).length

  return {
    activeToday: (todayData ?? []).length,
    avgPerDay: uniqueDays > 0 ? Math.round((recentRows.length / uniqueDays) * 10) / 10 : null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchQrcAnalytics(supabase: any, baseId: string, since: string) {
  const { data } = await supabase
    .from('qrc_executions')
    .select('opened_at, closed_at, status')
    .eq('base_id', baseId)
    .gte('opened_at', since)

  const rows = (data ?? []) as { opened_at: string; closed_at: string | null; status: string }[]

  let totalMinutes = 0
  let closedCount = 0
  for (const r of rows) {
    if (r.closed_at) {
      const mins = (new Date(r.closed_at).getTime() - new Date(r.opened_at).getTime()) / 60000
      if (mins > 0 && mins < 1440) {
        totalMinutes += mins
        closedCount++
      }
    }
  }

  return {
    executionsLast30: rows.length,
    avgResponseMinutes: closedCount > 0 ? Math.round(totalMinutes / closedCount) : null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchWildlifeAnalytics(supabase: any, baseId: string, since: string) {
  const [sightingsRes, strikesRes] = await Promise.all([
    supabase
      .from('wildlife_sightings')
      .select('species_group')
      .eq('base_id', baseId)
      .gte('observed_at', since),
    supabase
      .from('wildlife_strikes')
      .select('species_group')
      .eq('base_id', baseId)
      .gte('strike_date', since.slice(0, 10)),
  ])

  const sightings = (sightingsRes.data ?? []) as { species_group: string }[]
  const strikes = (strikesRes.data ?? []) as { species_group: string }[]

  // Top species across both
  const speciesCounts: Record<string, number> = {}
  for (const s of [...sightings, ...strikes]) {
    if (s.species_group) {
      speciesCounts[s.species_group] = (speciesCounts[s.species_group] || 0) + 1
    }
  }
  const topSpecies = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  return {
    sightings: sightings.length,
    strikes: strikes.length,
    topSpecies,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchObstructionAnalytics(supabase: any, baseId: string, since: string) {
  const { data } = await supabase
    .from('obstruction_evaluations')
    .select('has_violation')
    .eq('base_id', baseId)
    .gte('created_at', since)

  const rows = (data ?? []) as { has_violation: boolean }[]
  return {
    evaluated: rows.length,
    violations: rows.filter(r => r.has_violation).length,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchParkingAnalytics(supabase: any, baseId: string, since: string) {
  const [allPlans, recentPlans] = await Promise.all([
    supabase
      .from('parking_plans')
      .select('id, plan_name, is_active')
      .eq('base_id', baseId),
    supabase
      .from('parking_plans')
      .select('id')
      .eq('base_id', baseId)
      .gte('created_at', since),
  ])

  const all = (allPlans.data ?? []) as { id: string; plan_name: string; is_active: boolean }[]
  const active = all.find(p => p.is_active)

  return {
    totalPlans: all.length,
    createdInPeriod: (recentPlans.data ?? []).length,
    activePlan: active?.plan_name || null,
  }
}
