import { createClient } from '@/lib/supabase/client'

// ── Types ──

export type TrendPeriod = '30d' | '90d' | '6m' | '1y'

export interface TrendBucket {
  label: string          // e.g. "Feb 3" or "Jan 2026"
  startDate: string      // ISO date
  endDate: string        // ISO date
  opened: number
  closed: number
  net: number            // opened - closed
}

export interface TrendSummary {
  totalOpened: number
  totalClosed: number
  net: number
  avgDaysToClose: number | null
  topAreas: { area: string; count: number }[]
  topTypes: { type: string; count: number }[]
}

export interface DiscrepancyTrendsData {
  period: TrendPeriod
  periodLabel: string
  buckets: TrendBucket[]
  summary: TrendSummary
}

// ── Helpers ──

function getPeriodConfig(period: TrendPeriod): { days: number; bucketType: 'week' | 'month'; label: string } {
  switch (period) {
    case '30d':  return { days: 30,  bucketType: 'week',  label: 'Last 30 Days' }
    case '90d':  return { days: 90,  bucketType: 'week',  label: 'Last 90 Days' }
    case '6m':   return { days: 182, bucketType: 'month', label: 'Last 6 Months' }
    case '1y':   return { days: 365, bucketType: 'month', label: 'Last 12 Months' }
  }
}

function buildBuckets(startDate: Date, endDate: Date, type: 'week' | 'month'): TrendBucket[] {
  const buckets: TrendBucket[] = []
  const cursor = new Date(startDate)

  while (cursor < endDate) {
    let bucketEnd: Date
    let label: string

    if (type === 'week') {
      bucketEnd = new Date(cursor)
      bucketEnd.setDate(bucketEnd.getDate() + 6)
      if (bucketEnd > endDate) bucketEnd = new Date(endDate)
      label = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999)
      if (bucketEnd > endDate) bucketEnd = new Date(endDate)
      label = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }

    buckets.push({
      label,
      startDate: cursor.toISOString(),
      endDate: bucketEnd.toISOString(),
      opened: 0,
      closed: 0,
      net: 0,
    })

    if (type === 'week') {
      cursor.setDate(cursor.getDate() + 7)
    } else {
      cursor.setMonth(cursor.getMonth() + 1)
      cursor.setDate(1)
    }
  }

  return buckets
}

// ── Data Fetching ──

export async function fetchDiscrepancyTrendsData(period: TrendPeriod, baseId?: string | null): Promise<DiscrepancyTrendsData> {
  const config = getPeriodConfig(period)
  const now = new Date()
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - config.days)
  startDate.setHours(0, 0, 0, 0)

  const empty: DiscrepancyTrendsData = {
    period,
    periodLabel: config.label,
    buckets: [],
    summary: { totalOpened: 0, totalClosed: 0, net: 0, avgDaysToClose: null, topAreas: [], topTypes: [] },
  }

  const supabase = createClient()
  if (!supabase) return empty

  const startISO = startDate.toISOString()

  // Fetch all discrepancies created in the period (opened)
  let openedQuery = supabase
    .from('discrepancies')
    .select('id, created_at, location_text, type')
    .gte('created_at', startISO)
    .order('created_at', { ascending: true })

  if (baseId) openedQuery = openedQuery.eq('base_id', baseId)

  const { data: opened } = await openedQuery

  // Fetch all discrepancies closed/cancelled in the period
  let closedQuery = supabase
    .from('discrepancies')
    .select('id, created_at, updated_at, status, resolution_date')
    .in('status', ['completed', 'cancelled'])
    .gte('updated_at', startISO)
    .order('updated_at', { ascending: true })

  if (baseId) closedQuery = closedQuery.eq('base_id', baseId)

  const { data: closed } = await closedQuery

  const openedRows = (opened ?? []) as { id: string; created_at: string; location_text: string; type: string }[]
  const closedRows = (closed ?? []) as { id: string; created_at: string; updated_at: string; status: string; resolution_date: string | null }[]

  // Build time buckets
  const buckets = buildBuckets(startDate, now, config.bucketType)

  // Place opened into buckets
  for (const row of openedRows) {
    const ts = new Date(row.created_at).getTime()
    for (const bucket of buckets) {
      if (ts >= new Date(bucket.startDate).getTime() && ts <= new Date(bucket.endDate).getTime()) {
        bucket.opened++
        break
      }
    }
  }

  // Place closed into buckets (use resolution_date or updated_at)
  for (const row of closedRows) {
    const closeDate = row.resolution_date || row.updated_at
    const ts = new Date(closeDate).getTime()
    for (const bucket of buckets) {
      if (ts >= new Date(bucket.startDate).getTime() && ts <= new Date(bucket.endDate).getTime()) {
        bucket.closed++
        break
      }
    }
  }

  // Compute net per bucket
  for (const bucket of buckets) {
    bucket.net = bucket.opened - bucket.closed
  }

  // Compute avg days to close
  let totalDaysToClose = 0
  let closedCount = 0
  for (const row of closedRows) {
    const created = new Date(row.created_at).getTime()
    const closeDate = row.resolution_date || row.updated_at
    const resolved = new Date(closeDate).getTime()
    const days = Math.floor((resolved - created) / (1000 * 60 * 60 * 24))
    if (days >= 0) {
      totalDaysToClose += days
      closedCount++
    }
  }

  // Top areas from opened
  const areaCounts: Record<string, number> = {}
  for (const row of openedRows) {
    const area = row.location_text || 'Unknown'
    areaCounts[area] = (areaCounts[area] || 0) + 1
  }
  const topAreas = Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area, count]) => ({ area, count }))

  // Top types from opened
  const typeCounts: Record<string, number> = {}
  for (const row of openedRows) {
    typeCounts[row.type] = (typeCounts[row.type] || 0) + 1
  }
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }))

  return {
    period,
    periodLabel: config.label,
    buckets,
    summary: {
      totalOpened: openedRows.length,
      totalClosed: closedRows.length,
      net: openedRows.length - closedRows.length,
      avgDaysToClose: closedCount > 0 ? Math.round(totalDaysToClose / closedCount) : null,
      topAreas,
      topTypes,
    },
  }
}
