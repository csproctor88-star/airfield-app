import { createClient } from '@/lib/supabase/client'

// ── Types ──

export interface AgingTier {
  label: string
  min: number
  max: number | null  // null = no upper bound
  color: string       // for UI display
  discrepancies: AgingDiscrepancy[]
}

export interface AgingDiscrepancy {
  id: string
  display_id: string
  title: string
  type: string
  severity: string
  current_status: string
  location_text: string
  assigned_shop: string | null
  work_order_number: string | null
  days_open: number
  created_at: string
  reporter_name: string
  reporter_rank: string | null
  last_update_at: string | null
  last_update_notes: string | null
}

export interface AgingSummary {
  total: number
  bySeverity: Record<string, number>
  byShop: { shop: string; count: number }[]
  avgDaysOpen: number | null
  oldest: { display_id: string; title: string; days_open: number } | null
}

export interface AgingDiscrepanciesData {
  tiers: AgingTier[]
  summary: AgingSummary
}

// ── Tier Definitions ──

const TIER_DEFS: { label: string; min: number; max: number | null; color: string }[] = [
  { label: '0 - 7 days',   min: 0,  max: 7,    color: '#22C55E' },
  { label: '8 - 14 days',  min: 8,  max: 14,   color: '#84CC16' },
  { label: '15 - 30 days', min: 15, max: 30,   color: '#FBBF24' },
  { label: '31 - 60 days', min: 31, max: 60,   color: '#F97316' },
  { label: '61 - 90 days', min: 61, max: 90,   color: '#EF4444' },
  { label: '90+ days',     min: 91, max: null,  color: '#DC2626' },
]

// ── Data Fetching ──

export async function fetchAgingDiscrepanciesData(baseId?: string | null): Promise<AgingDiscrepanciesData> {
  const empty: AgingDiscrepanciesData = {
    tiers: TIER_DEFS.map((t) => ({ ...t, discrepancies: [] })),
    summary: { total: 0, bySeverity: {}, byShop: [], avgDaysOpen: null, oldest: null },
  }

  const supabase = createClient()
  if (!supabase) return empty

  const now = new Date()

  // Fetch open discrepancies with profile join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('discrepancies')
    .select('*, profiles:reported_by(name, rank)')
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  if (baseId) query = query.eq('base_id', baseId)

  const { data, error } = await query

  let rows: AgingDiscrepancy[] = []

  if (!error && data) {
    rows = (data ?? []).map((row: Record<string, unknown>) => {
      const createdAt = new Date(row.created_at as string)
      const daysOpen = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: row.id as string,
        display_id: row.display_id as string,
        title: row.title as string,
        type: row.type as string,
        severity: row.severity as string,
        current_status: row.current_status as string,
        location_text: row.location_text as string,
        assigned_shop: row.assigned_shop as string | null,
        work_order_number: row.work_order_number as string | null,
        days_open: daysOpen,
        created_at: row.created_at as string,
        reporter_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
        reporter_rank: (row.profiles as { rank?: string } | null)?.rank || null,
        last_update_at: null,
        last_update_notes: null,
      }
    })
  } else {
    // Fallback without join
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fbQuery = (supabase as any)
      .from('discrepancies')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: true })

    if (baseId) fbQuery = fbQuery.eq('base_id', baseId)

    const { data: fb } = await fbQuery

    rows = ((fb ?? []) as Record<string, unknown>[]).map((row) => {
      const createdAt = new Date(row.created_at as string)
      const daysOpen = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: row.id as string,
        display_id: row.display_id as string,
        title: row.title as string,
        type: row.type as string,
        severity: row.severity as string,
        current_status: row.current_status as string,
        location_text: row.location_text as string,
        assigned_shop: row.assigned_shop as string | null,
        work_order_number: row.work_order_number as string | null,
        days_open: daysOpen,
        created_at: row.created_at as string,
        reporter_name: 'Unknown',
        reporter_rank: null,
        last_update_at: null,
        last_update_notes: null,
      }
    })
  }

  // Fetch latest status update per discrepancy
  const discIds = rows.map((d) => d.id)
  if (discIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updates } = await (supabase as any)
      .from('status_updates')
      .select('discrepancy_id, notes, created_at')
      .in('discrepancy_id', discIds)
      .order('created_at', { ascending: false })

    if (updates) {
      const latestByDisc: Record<string, { notes: string | null; created_at: string }> = {}
      for (const u of updates as { discrepancy_id: string; notes: string | null; created_at: string }[]) {
        if (!latestByDisc[u.discrepancy_id]) {
          latestByDisc[u.discrepancy_id] = u
        }
      }
      for (const d of rows) {
        const latest = latestByDisc[d.id]
        if (latest) {
          d.last_update_at = latest.created_at
          d.last_update_notes = latest.notes
        }
      }
    }
  }

  // Sort into tiers
  const tiers: AgingTier[] = TIER_DEFS.map((t) => ({ ...t, discrepancies: [] }))

  for (const disc of rows) {
    for (const tier of tiers) {
      const inMin = disc.days_open >= tier.min
      const inMax = tier.max === null || disc.days_open <= tier.max
      if (inMin && inMax) {
        tier.discrepancies.push(disc)
        break
      }
    }
  }

  // Sort discrepancies within each tier by days_open descending
  for (const tier of tiers) {
    tier.discrepancies.sort((a, b) => b.days_open - a.days_open)
  }

  // Compute summary
  const bySeverity: Record<string, number> = {}
  const shopCounts: Record<string, number> = {}
  let totalDays = 0

  for (const d of rows) {
    bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1
    const shop = d.assigned_shop || 'Unassigned'
    shopCounts[shop] = (shopCounts[shop] || 0) + 1
    totalDays += d.days_open
  }

  const byShop = Object.entries(shopCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([shop, count]) => ({ shop, count }))

  const sorted = [...rows].sort((a, b) => b.days_open - a.days_open)
  const oldest = sorted.length > 0
    ? { display_id: sorted[0].display_id, title: sorted[0].title, days_open: sorted[0].days_open }
    : null

  return {
    tiers,
    summary: {
      total: rows.length,
      bySeverity,
      byShop,
      avgDaysOpen: rows.length > 0 ? Math.round(totalDays / rows.length) : null,
      oldest,
    },
  }
}
