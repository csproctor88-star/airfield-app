// Page-view capture + read helpers.
//
// Writes go through the record_page_view SECURITY DEFINER RPC (see migration
// 2026061800) which stamps user_id from auth.uid() and upserts the daily
// rollup. Reads are RLS-gated to admins. All functions degrade gracefully when
// Supabase isn't configured (demo mode).

import { createClient } from './client'

export interface PageViewRow {
  user_id: string
  base_id: string
  route: string
  view_date: string
  count: number
  last_viewed_at: string
}

/**
 * Record a single page view for the current user at the given base. Best
 * effort — never throws; a failed telemetry write must never disrupt
 * navigation. The route should already be normalized (see normalizeRoute).
 */
export async function recordPageView(route: string, baseId: string | null): Promise<void> {
  if (!baseId || !route) return
  const supabase = createClient()
  if (!supabase) return
  try {
    await supabase.rpc('record_page_view' as never, { p_route: route, p_base_id: baseId } as never)
  } catch {
    /* swallow — telemetry is non-critical */
  }
}

/** Per-user page views since a date (YYYY-MM-DD). Admin-gated by RLS. */
export async function getUserPageViews(userId: string, sinceDate: string): Promise<PageViewRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('page_view_daily')
    .select('user_id, base_id, route, view_date, count, last_viewed_at')
    .eq('user_id', userId)
    .gte('view_date', sinceDate)
    .order('view_date', { ascending: false })
    .limit(2000)
  if (error || !data) return []
  return data as unknown as PageViewRow[]
}

/** App-wide page views since a date, optionally scoped to one base. */
export async function getAppWidePageViews(baseId: string | null, sinceDate: string): Promise<PageViewRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  let query = supabase
    .from('page_view_daily')
    .select('user_id, base_id, route, view_date, count, last_viewed_at')
    .gte('view_date', sinceDate)
    .order('view_date', { ascending: false })
    .limit(10000)
  if (baseId) query = query.eq('base_id', baseId)
  const { data, error } = await query
  if (error || !data) return []
  return data as unknown as PageViewRow[]
}
