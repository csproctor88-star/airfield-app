// App-wide engagement aggregation for the sys-admin analytics dashboard.
//
// Pulls profiles + recent activity_log + page-view rollups (all RLS-gated to
// admins) and reduces them to the dashboard summary in JS. Scale here is small
// (dozens–hundreds of users, low thousands of monthly events), so client-side
// aggregation is fine. Activity is capped at ACTIVITY_LIMIT rows; the summary
// reports `truncated` so the UI can disclose it rather than silently undercount.

import { createClient } from '@/lib/supabase/client'
import { getAppWidePageViews } from '@/lib/supabase/page-views'
import { moduleLabel } from '@/lib/activity-labels'

const ACTIVITY_LIMIT = 10000
const DAY_MS = 86400_000

export interface ModuleStat { key: string; label: string; count: number }
export interface BaseStat { baseId: string; name: string; icao: string; activeUsers: number; actions: number }
export interface VersionStat { version: string; count: number }
export interface StaleUser { id: string; name: string; rank: string | null; lastSeenAt: string | null }

export interface EngagementSummary {
  scope: 'all' | 'base'
  totalUsers: number
  active: number
  pending: number
  deactivated: number
  newAccounts30d: number
  dau: number
  wau: number
  mau: number
  modules: ModuleStat[]
  pages: { route: string; count: number }[]
  versions: VersionStat[]
  bases: BaseStat[]
  stale: StaleUser[]
  truncated: boolean
}

interface ProfileRow {
  id: string
  name: string | null
  rank: string | null
  role: string
  status: string
  primary_base_id: string | null
  last_seen_at: string | null
  last_seen_release_version: string | null
  created_at: string
}
interface ActivityRow { user_id: string | null; entity_type: string; base_id: string | null; created_at: string }

/**
 * Load and compute the engagement summary. `baseId` null = all installations
 * (sys admin); otherwise scoped to one base. `nowMs` is injected so the
 * windows are deterministic and testable.
 */
export async function loadEngagementSummary(baseId: string | null, nowMs: number): Promise<EngagementSummary | null> {
  const supabase = createClient()
  if (!supabase) return null

  const since30Iso = new Date(nowMs - 30 * DAY_MS).toISOString()
  const since30Date = new Date(nowMs - 30 * DAY_MS).toISOString().slice(0, 10)

  let profileQuery = supabase
    .from('profiles')
    .select('id, name, rank, role, status, primary_base_id, last_seen_at, last_seen_release_version, created_at')
  if (baseId) profileQuery = profileQuery.eq('primary_base_id', baseId)

  let activityQuery = supabase
    .from('activity_log')
    .select('user_id, entity_type, base_id, created_at')
    .gte('created_at', since30Iso)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LIMIT)
  if (baseId) activityQuery = activityQuery.eq('base_id', baseId)

  const [{ data: profilesData }, { data: activityData }, pageViews, { data: basesData }] = await Promise.all([
    profileQuery,
    activityQuery,
    getAppWidePageViews(baseId, since30Date),
    supabase.from('bases').select('id, name, icao'),
  ])

  const profiles = (profilesData as unknown as ProfileRow[] | null) ?? []
  const activity = (activityData as unknown as ActivityRow[] | null) ?? []
  const baseNames = new Map<string, { name: string; icao: string }>()
  for (const b of (basesData as unknown as { id: string; name: string; icao: string | null }[] | null) ?? []) {
    baseNames.set(b.id, { name: b.name, icao: b.icao ?? '' })
  }

  const cut1 = nowMs - DAY_MS
  const cut7 = nowMs - 7 * DAY_MS
  const cut30 = nowMs - 30 * DAY_MS

  // Status tallies + new accounts.
  let active = 0, pending = 0, deactivated = 0, newAccounts30d = 0
  for (const p of profiles) {
    if (p.status === 'pending') pending++
    else if (p.status === 'deactivated') deactivated++
    else active++
    if (new Date(p.created_at).getTime() >= cut30) newAccounts30d++
  }

  // Active-user sets per window: present (last_seen_at) OR acted (activity_log).
  const seen = (cut: number) => {
    const s = new Set<string>()
    for (const p of profiles) {
      if (p.last_seen_at && new Date(p.last_seen_at).getTime() >= cut) s.add(p.id)
    }
    for (const a of activity) {
      if (a.user_id && new Date(a.created_at).getTime() >= cut) s.add(a.user_id)
    }
    return s
  }
  const dau = seen(cut1).size
  const wau = seen(cut7).size
  const mau = seen(cut30).size

  // Adoption by module (30d actions).
  const moduleCounts = new Map<string, number>()
  for (const a of activity) moduleCounts.set(a.entity_type, (moduleCounts.get(a.entity_type) ?? 0) + 1)
  const modules = Array.from(moduleCounts.entries())
    .map(([key, count]) => ({ key, label: moduleLabel(key), count }))
    .sort((a, b) => b.count - a.count)

  // Most-visited pages (30d).
  const pageCounts = new Map<string, number>()
  for (const pv of pageViews) pageCounts.set(pv.route, (pageCounts.get(pv.route) ?? 0) + pv.count)
  const pages = Array.from(pageCounts.entries())
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  // Version adoption.
  const versionCounts = new Map<string, number>()
  for (const p of profiles) {
    const v = p.last_seen_release_version || 'Unknown'
    versionCounts.set(v, (versionCounts.get(v) ?? 0) + 1)
  }
  const versions = Array.from(versionCounts.entries())
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => b.count - a.count)

  // Adoption by base (only meaningful across all installations).
  const mau30Set = seen(cut30)
  const baseAgg = new Map<string, { activeUsers: number; actions: number }>()
  if (!baseId) {
    for (const p of profiles) {
      if (!p.primary_base_id) continue
      if (!mau30Set.has(p.id)) continue
      const e = baseAgg.get(p.primary_base_id) ?? { activeUsers: 0, actions: 0 }
      e.activeUsers++
      baseAgg.set(p.primary_base_id, e)
    }
    for (const a of activity) {
      if (!a.base_id) continue
      const e = baseAgg.get(a.base_id) ?? { activeUsers: 0, actions: 0 }
      e.actions++
      baseAgg.set(a.base_id, e)
    }
  }
  const bases: BaseStat[] = Array.from(baseAgg.entries())
    .map(([id, e]) => ({ baseId: id, name: baseNames.get(id)?.name ?? 'Unknown', icao: baseNames.get(id)?.icao ?? '', ...e }))
    .sort((a, b) => b.actions - a.actions)

  // Stale: active-status users with no presence and no action in 30 days.
  const actedRecently = new Set(activity.filter((a) => a.user_id && new Date(a.created_at).getTime() >= cut30).map((a) => a.user_id as string))
  const stale: StaleUser[] = profiles
    .filter((p) => p.status !== 'deactivated' && p.status !== 'pending')
    .filter((p) => !actedRecently.has(p.id) && (!p.last_seen_at || new Date(p.last_seen_at).getTime() < cut30))
    .map((p) => ({ id: p.id, name: p.name || '(unnamed)', rank: p.rank, lastSeenAt: p.last_seen_at }))
    .sort((a, b) => {
      const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0
      const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0
      return ta - tb
    })
    .slice(0, 20)

  return {
    scope: baseId ? 'base' : 'all',
    totalUsers: profiles.length,
    active,
    pending,
    deactivated,
    newAccounts30d,
    dau,
    wau,
    mau,
    modules: modules.slice(0, 12),
    pages,
    versions,
    bases,
    stale,
    truncated: activity.length >= ACTIVITY_LIMIT,
  }
}
