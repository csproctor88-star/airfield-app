import { createClient } from './client'

type ProfileFragment = {
  name?: string | null
  rank?: string | null
  role?: string | null
  edipi?: string | null
  operating_initials?: string | null
} | null

type LogRow = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_display_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_id: string | null
  profiles: ProfileFragment
}

type DiscRow = {
  id: string
  display_id: string | null
  title: string | null
  status: string
  current_status: string | null
  type: string | null
  location_text: string | null
  created_at: string
  updated_at: string
  reported_by: string | null
  profiles: ProfileFragment
}

type CheckRow = {
  id: string
  display_id: string | null
  check_type: string | null
  completed_at: string
  completed_by: string | null
  profiles: ProfileFragment
}

type InspRow = {
  id: string
  display_id: string | null
  inspection_type: string | null
  status: string
  filed_at: string
  inspector_id: string | null
  profiles: ProfileFragment
}

type QrcRow = {
  id: string
  qrc_number: string | number
  title: string | null
  status: string
  opened_at: string
  closed_at: string | null
  opened_by: string | null
  profiles: ProfileFragment
}

type SightingRow = {
  id: string
  display_id: string | null
  species_common: string | null
  count_observed: number | null
  location_text: string | null
  created_at: string
  observed_by: string | null
  profiles: ProfileFragment
}

type StrikeRow = {
  id: string
  display_id: string | null
  species_common: string | null
  created_at: string
  reported_by: string | null
  profiles: ProfileFragment
}

export type ActivityEntry = {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_display_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_name: string
  user_rank: string | null
  user_role: string | null
  user_edipi: string | null
  user_operating_initials: string | null
}

export async function fetchActivityLog(options: {
  baseId?: string | null
  startDate?: string
  endDate?: string
  limit?: number
  /** Entity types to omit. The Events Log page (`/activity`, AF Form
   *  3616-style operational log) excludes high-volume internal-workflow
   *  rows like PPR coordination and wildlife sightings — those still
   *  show on the Activity Log page (`/recent-activity`). */
  excludeEntityTypes?: string[]
}): Promise<{ data: ActivityEntry[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  const { baseId, startDate, endDate, limit = 200, excludeEntityTypes } = options

  let query = supabase
    .from('activity_log')
    .select('id, action, entity_type, entity_id, entity_display_id, metadata, created_at, user_id, profiles:user_id(name, rank, role, edipi, operating_initials)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (baseId) query = query.eq('base_id', baseId)
  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)
  if (excludeEntityTypes && excludeEntityTypes.length > 0) {
    query = query.not('entity_type', 'in', `(${excludeEntityTypes.join(',')})`)
  }

  const { data, error } = await query

  if (error) {
    // Fallback without join
      let fallbackQuery = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (baseId) fallbackQuery = fallbackQuery.eq('base_id', baseId)
    if (startDate) fallbackQuery = fallbackQuery.gte('created_at', startDate)
    if (endDate) fallbackQuery = fallbackQuery.lte('created_at', endDate)
    if (excludeEntityTypes && excludeEntityTypes.length > 0) {
      fallbackQuery = fallbackQuery.not('entity_type', 'in', `(${excludeEntityTypes.join(',')})`)
    }

    const { data: fallback } = await fallbackQuery

    if (fallback) {
      return {
        data: fallback.map((r: Record<string, unknown>) => ({
          ...r,
          user_name: 'Unknown',
          user_rank: null,
          user_role: null,
          user_edipi: null,
          user_operating_initials: null,
          metadata: (r.metadata as Record<string, unknown>) || null,
        })) as ActivityEntry[],
        error: null,
      }
    }

    return { data: [], error: error.message }
  }

  if (data) {
    return {
      data: data.map((r: Record<string, unknown>) => ({
        ...r,
        user_name: (r.profiles as { name?: string } | null)?.name || 'Unknown',
        user_rank: (r.profiles as { rank?: string } | null)?.rank || null,
        user_role: (r.profiles as { role?: string } | null)?.role || null,
        user_edipi: (r.profiles as { edipi?: string } | null)?.edipi || null,
        user_operating_initials: (r.profiles as { operating_initials?: string } | null)?.operating_initials || null,
        metadata: (r.metadata as Record<string, unknown>) || null,
      })) as ActivityEntry[],
      error: null,
    }
  }

  return { data: [], error: null }
}

/**
 * One page of Events Log entries — cursor-paginated for infinite-scroll.
 *
 * When `beforeCreatedAt` is set, returns rows older than that timestamp
 * (the cursor is the `created_at` of the last loaded row, so a stable
 * walk through the table that survives concurrent inserts).
 *
 * When `searchQuery` is set (≥2 chars), filters server-side across
 * `entity_display_id`, `entity_type`, `metadata.details`, and any user
 * whose `name` or `operating_initials` matches. Lets the search bar hit
 * the entire table, not just whatever's currently in memory.
 *
 * Returns `hasMore: true` when the result is at least `limit` rows long
 * — the caller uses that to decide whether to keep showing the
 * load-more sentinel.
 */
export async function fetchActivityLogPage(options: {
  baseId?: string | null
  startDate?: string
  endDate?: string
  beforeCreatedAt?: string
  limit?: number
  excludeEntityTypes?: string[]
  searchQuery?: string
}): Promise<{ data: ActivityEntry[]; hasMore: boolean; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], hasMore: false, error: 'Supabase not configured' }

  const { baseId, startDate, endDate, beforeCreatedAt, limit = 500, excludeEntityTypes, searchQuery } = options

  // ── Search expansion: profiles → user_ids ──
  // PostgREST's `.or()` operates on a single table, so to match against
  // joined `profiles` columns we do a small lookup first and fold the
  // matched user IDs into the activity_log filter as `user_id.in.(...)`.
  let matchedUserIds: string[] = []
  const trimmedQ = (searchQuery || '').trim()
  // Sanitize for PostgREST URL syntax — strip characters that confuse
  // the .or() filter parser (commas, parens, %).
  const safeQ = trimmedQ.replace(/[,()%]/g, ' ').trim()
  const useSearch = safeQ.length >= 2

  if (useSearch) {
    const { data: profileMatches } = await supabase
      .from('profiles')
      .select('id')
      .or(`name.ilike.%${safeQ}%,operating_initials.ilike.%${safeQ}%`)
      .limit(200)
    matchedUserIds = ((profileMatches || []) as { id: string }[]).map((p) => p.id)
  }

  let query = supabase
    .from('activity_log')
    .select('id, action, entity_type, entity_id, entity_display_id, metadata, created_at, user_id, profiles:user_id(name, rank, role, edipi, operating_initials)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (baseId) query = query.eq('base_id', baseId)
  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)
  if (beforeCreatedAt) query = query.lt('created_at', beforeCreatedAt)
  if (excludeEntityTypes && excludeEntityTypes.length > 0) {
    query = query.not('entity_type', 'in', `(${excludeEntityTypes.join(',')})`)
  }

  if (useSearch) {
    const orParts = [
      `entity_display_id.ilike.%${safeQ}%`,
      `entity_type.ilike.%${safeQ}%`,
      `metadata->>details.ilike.%${safeQ}%`,
      `metadata->>template_label.ilike.%${safeQ}%`,
      `metadata->>template_category.ilike.%${safeQ}%`,
      `action.ilike.%${safeQ}%`,
    ]
    if (matchedUserIds.length > 0) {
      orParts.push(`user_id.in.(${matchedUserIds.join(',')})`)
    }
    query = query.or(orParts.join(','))
  }

  const { data, error } = await query
  if (error) return { data: [], hasMore: false, error: error.message }

  const rows = ((data || []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    user_name: (r.profiles as { name?: string } | null)?.name || 'Unknown',
    user_rank: (r.profiles as { rank?: string } | null)?.rank || null,
    user_role: (r.profiles as { role?: string } | null)?.role || null,
    user_edipi: (r.profiles as { edipi?: string } | null)?.edipi || null,
    user_operating_initials: (r.profiles as { operating_initials?: string } | null)?.operating_initials || null,
    metadata: (r.metadata as Record<string, unknown>) || null,
  })) as ActivityEntry[]

  return { data: rows, hasMore: rows.length >= limit, error: null }
}

/**
 * Paginated variant of `fetchActivityLog` for the Events Log export path.
 * Bypasses Supabase's 1000-row default by fetching pages until the source
 * is exhausted, so a multi-month export pulls every row in range — not
 * just the most recent N. Same join shape and filters as `fetchActivityLog`.
 */
export async function fetchActivityLogForExport(options: {
  baseId?: string | null
  startDate?: string
  endDate?: string
  excludeEntityTypes?: string[]
}): Promise<{ data: ActivityEntry[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  const { baseId, startDate, endDate, excludeEntityTypes } = options
  const pageSize = 1000
  const all: ActivityEntry[] = []
  let offset = 0

  while (true) {
    let query = supabase
      .from('activity_log')
      .select('id, action, entity_type, entity_id, entity_display_id, metadata, created_at, user_id, profiles:user_id(name, rank, role, edipi, operating_initials)')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (baseId) query = query.eq('base_id', baseId)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)
    if (excludeEntityTypes && excludeEntityTypes.length > 0) {
      query = query.not('entity_type', 'in', `(${excludeEntityTypes.join(',')})`)
    }

    const { data, error } = await query
    if (error) return { data: all, error: error.message }
    if (!data || data.length === 0) break

    for (const r of data as Record<string, unknown>[]) {
      all.push({
        ...r,
        user_name: (r.profiles as { name?: string } | null)?.name || 'Unknown',
        user_rank: (r.profiles as { rank?: string } | null)?.rank || null,
        user_role: (r.profiles as { role?: string } | null)?.role || null,
        user_edipi: (r.profiles as { edipi?: string } | null)?.edipi || null,
        user_operating_initials: (r.profiles as { operating_initials?: string } | null)?.operating_initials || null,
        metadata: (r.metadata as Record<string, unknown>) || null,
      } as ActivityEntry)
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  return { data: all, error: null }
}

/**
 * Fetch a unified activity feed for the Dashboard's "Recent Activity" section.
 * Merges activity_log entries with recent discrepancy, check, and inspection events
 * so the Dashboard shows everything that happens — not just manual log entries.
 */
export async function fetchDashboardActivity(baseId: string | null, limit = 30): Promise<ActivityEntry[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []

  const since = new Date(Date.now() - 7 * 86400000).toISOString() // last 7 days

  // 1. Standard activity log entries
  const { data: logData } = await supabase
    .from('activity_log')
    .select('id, action, entity_type, entity_id, entity_display_id, metadata, created_at, user_id, profiles:user_id(name, rank, role, edipi, operating_initials)')
    .eq('base_id', baseId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  const entries: ActivityEntry[] = ((logData || []) as unknown as LogRow[]).map((r) => ({
    id: r.id,
    action: r.action,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    entity_display_id: r.entity_display_id,
    metadata: r.metadata || null,
    created_at: r.created_at,
    user_name: r.profiles?.name || 'Unknown',
    user_rank: r.profiles?.rank || null,
    user_role: r.profiles?.role || null,
    user_edipi: r.profiles?.edipi || null,
    user_operating_initials: r.profiles?.operating_initials || null,
  }))

  const usedIds = new Set(entries.map(e => `${e.entity_type}-${e.entity_id}-${e.action}`))

  // 2. Recent discrepancy changes (created, status updates, completed)
  const { data: discData } = await supabase
    .from('discrepancies')
    .select('id, display_id, title, status, current_status, type, location_text, created_at, updated_at, reported_by, profiles:reported_by(name, rank, operating_initials)')
    .eq('base_id', baseId)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(20)

  const discIds = (discData || []).map(d => d.id)
  type StatusUpdateRow = {
    discrepancy_id: string
    created_at: string
    profiles: ProfileFragment
  }
  const latestStatusUpdateByDisc = new Map<string, StatusUpdateRow>()
  if (discIds.length > 0) {
    const { data: suData } = await supabase
      .from('status_updates')
      .select('discrepancy_id, created_at, profiles:updated_by(name, rank, operating_initials)')
      .in('discrepancy_id', discIds)
      .order('created_at', { ascending: false })
    for (const su of (suData || []) as unknown as StatusUpdateRow[]) {
      if (!latestStatusUpdateByDisc.has(su.discrepancy_id)) {
        latestStatusUpdateByDisc.set(su.discrepancy_id, su)
      }
    }
  }

  for (const d of (discData || []) as unknown as DiscRow[]) {
    const key = `discrepancy-${d.id}-updated`
    if (usedIds.has(key)) continue
    usedIds.add(key)
    const isNew = new Date(d.created_at).getTime() > Date.now() - 7 * 86400000 &&
      Math.abs(new Date(d.created_at).getTime() - new Date(d.updated_at).getTime()) < 60000
    const latestSu = latestStatusUpdateByDisc.get(d.id)
    const suFresh = latestSu
      ? Math.abs(new Date(latestSu.created_at).getTime() - new Date(d.updated_at).getTime()) < 5 * 60 * 1000
      : false
    const attribution = isNew ? d.profiles : (suFresh ? latestSu!.profiles : d.profiles)
    entries.push({
      id: `disc-${d.id}`,
      action: isNew ? 'created' : d.status === 'completed' ? 'completed' : 'updated',
      entity_type: 'discrepancy',
      entity_id: d.id,
      entity_display_id: d.display_id,
      metadata: { details: `${d.title || d.type?.toUpperCase() || 'DISCREPANCY'}${d.location_text ? ' — ' + d.location_text : ''}${d.current_status ? ' [' + d.current_status.replace(/_/g, ' ').toUpperCase() + ']' : ''}` },
      created_at: isNew ? d.created_at : d.updated_at,
      user_name: attribution?.name || 'Unknown',
      user_rank: attribution?.rank || null,
      user_role: null,
      user_edipi: null,
      user_operating_initials: attribution?.operating_initials || null,
    })
  }

  // 3. Recent check completions
  const { data: checkData } = await supabase
    .from('airfield_checks')
    .select('id, display_id, check_type, completed_at, completed_by, profiles:completed_by(name, rank, operating_initials)')
    .eq('base_id', baseId)
    .not('completed_at', 'is', null)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(20)

  for (const c of (checkData || []) as unknown as CheckRow[]) {
    const key = `check-${c.id}-completed`
    if (usedIds.has(key)) continue
    usedIds.add(key)
    const typeLabel = (c.check_type || '').replace(/_/g, ' ').toUpperCase()
    entries.push({
      id: `chk-${c.id}`,
      action: 'completed',
      entity_type: 'check',
      entity_id: c.id,
      entity_display_id: c.display_id,
      metadata: { details: `${typeLabel} CHECK COMPLETED` },
      created_at: c.completed_at,
      user_name: c.profiles?.name || 'Unknown',
      user_rank: c.profiles?.rank || null,
      user_role: null,
      user_edipi: null,
      user_operating_initials: c.profiles?.operating_initials || null,
    })
  }

  // 4. Recent inspection filings
  const { data: inspData } = await supabase
    .from('inspections')
    .select('id, display_id, inspection_type, status, filed_at, inspector_id, profiles:inspector_id(name, rank, operating_initials)')
    .eq('base_id', baseId)
    .eq('status', 'completed')
    .not('filed_at', 'is', null)
    .gte('filed_at', since)
    .order('filed_at', { ascending: false })
    .limit(10)

  for (const ins of (inspData || []) as unknown as InspRow[]) {
    const key = `inspection-${ins.id}-filed`
    if (usedIds.has(key)) continue
    usedIds.add(key)
    const typeLabel = (ins.inspection_type || '').toUpperCase()
    entries.push({
      id: `insp-${ins.id}`,
      action: 'filed',
      entity_type: 'inspection',
      entity_id: ins.id,
      entity_display_id: ins.display_id,
      metadata: { details: `${typeLabel} INSPECTION FILED` },
      created_at: ins.filed_at,
      user_name: ins.profiles?.name || 'Unknown',
      user_rank: ins.profiles?.rank || null,
      user_role: null,
      user_edipi: null,
      user_operating_initials: ins.profiles?.operating_initials || null,
    })
  }

  // 5. QRC executions
  const { data: qrcData } = await supabase
    .from('qrc_executions')
    .select('id, qrc_number, title, status, opened_at, closed_at, opened_by, profiles:opened_by(name, rank, operating_initials)')
    .eq('base_id', baseId)
    .gte('opened_at', since)
    .order('opened_at', { ascending: false })
    .limit(10)

  for (const q of (qrcData || []) as unknown as QrcRow[]) {
    const key = `qrc-${q.id}-opened`
    if (usedIds.has(key)) continue
    usedIds.add(key)
    entries.push({
      id: `qrc-${q.id}`,
      action: q.status === 'closed' ? 'closed' : 'opened',
      entity_type: 'qrc',
      entity_id: q.id,
      entity_display_id: `QRC-${q.qrc_number}`,
      metadata: { details: q.title || `QRC-${q.qrc_number}` },
      created_at: q.status === 'closed' && q.closed_at ? q.closed_at : q.opened_at,
      user_name: q.profiles?.name || 'Unknown',
      user_rank: q.profiles?.rank || null,
      user_role: null,
      user_edipi: null,
      user_operating_initials: q.profiles?.operating_initials || null,
    })
  }

  // 6. Wildlife sightings
  const { data: sightingData } = await supabase
    .from('wildlife_sightings')
    .select('id, display_id, species_common, count_observed, location_text, created_at, observed_by, profiles:observed_by(name, rank, operating_initials)')
    .eq('base_id', baseId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10)

  for (const s of (sightingData || []) as unknown as SightingRow[]) {
    const key = `wildlife_sighting-${s.id}-created`
    if (usedIds.has(key)) continue
    usedIds.add(key)
    entries.push({
      id: `ws-${s.id}`,
      action: 'created',
      entity_type: 'wildlife_sighting',
      entity_id: s.id,
      entity_display_id: s.display_id,
      metadata: { details: `${s.species_common || 'Wildlife'} (${s.count_observed || 1})${s.location_text ? ' — ' + s.location_text : ''}` },
      created_at: s.created_at,
      user_name: s.profiles?.name || 'Unknown',
      user_rank: s.profiles?.rank || null,
      user_role: null,
      user_edipi: null,
      user_operating_initials: s.profiles?.operating_initials || null,
    })
  }

  // 7. Wildlife strikes
  const { data: strikeData } = await supabase
    .from('wildlife_strikes')
    .select('id, display_id, species_common, created_at, reported_by, profiles:reported_by(name, rank, operating_initials)')
    .eq('base_id', baseId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10)

  for (const s of (strikeData || []) as unknown as StrikeRow[]) {
    const key = `wildlife_strike-${s.id}-created`
    if (usedIds.has(key)) continue
    usedIds.add(key)
    entries.push({
      id: `wk-${s.id}`,
      action: 'created',
      entity_type: 'wildlife_strike',
      entity_id: s.id,
      entity_display_id: s.display_id,
      metadata: { details: `BIRD STRIKE — ${s.species_common || 'Unknown species'}` },
      created_at: s.created_at,
      user_name: s.profiles?.name || 'Unknown',
      user_rank: s.profiles?.rank || null,
      user_role: null,
      user_edipi: null,
      user_operating_initials: s.profiles?.operating_initials || null,
    })
  }

  // Sort all entries by created_at descending and trim to limit
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return entries.slice(0, limit)
}

export type EntityDetails = {
  title?: string
  description?: string
  notes?: string
  extra?: string
}

/**
 * Batch-fetch entity details for activity log export enrichment.
 * Groups entries by entity_type, issues one query per type, returns Map<entity_id, EntityDetails>.
 */
export async function fetchEntityDetails(entries: ActivityEntry[]): Promise<Map<string, EntityDetails>> {
  const supabase = createClient()
  if (!supabase) return new Map()

  // Group entity IDs by type (skip types whose context lives in metadata)
  const groups: Record<string, string[]> = {}
  for (const e of entries) {
    if (!e.entity_id) continue
    if (e.entity_type === 'airfield_status' || e.entity_type === 'navaid_status') continue
    if (!groups[e.entity_type]) groups[e.entity_type] = []
    if (!groups[e.entity_type].includes(e.entity_id)) {
      groups[e.entity_type].push(e.entity_id)
    }
  }

  const result = new Map<string, EntityDetails>()

  // Discrepancies
  if (groups['discrepancy']?.length) {
    try {
          const { data } = await supabase
        .from('discrepancies')
        .select('id, title, description, resolution_notes')
        .in('id', groups['discrepancy'])
      if (data) {
        for (const r of data as { id: string; title?: string; description?: string; resolution_notes?: string }[]) {
          result.set(r.id, { title: r.title || undefined, description: r.description || undefined, notes: r.resolution_notes || undefined })
        }
      }
    } catch { /* deleted entities */ }
  }

  // Obstruction evaluations
  if (groups['obstruction_evaluation']?.length) {
    try {
          const { data } = await supabase
        .from('obstruction_evaluations')
        .select('id, description, notes')
        .in('id', groups['obstruction_evaluation'])
      if (data) {
        for (const r of data as { id: string; description?: string; notes?: string }[]) {
          result.set(r.id, { description: r.description || undefined, notes: r.notes || undefined })
        }
      }
    } catch { /* deleted entities */ }
  }

  // Airfield checks + comments (entity_type may be 'check' or 'airfield_check')
  const checkIds = [...(groups['check'] || []), ...(groups['airfield_check'] || [])]
  if (checkIds.length) {
    try {
          const { data } = await supabase
        .from('airfield_checks')
        .select('id, check_type')
        .in('id', checkIds)
      if (data) {
        for (const r of data as { id: string; check_type?: string }[]) {
          result.set(r.id, { title: r.check_type?.toUpperCase() || undefined })
        }
      }
      // Fetch comments separately
          const { data: comments } = await supabase
        .from('check_comments')
        .select('check_id, comment')
        .in('check_id', checkIds)
      if (comments) {
        const commentsByCheck: Record<string, string[]> = {}
        for (const c of comments as { check_id: string; comment: string }[]) {
          if (!commentsByCheck[c.check_id]) commentsByCheck[c.check_id] = []
          commentsByCheck[c.check_id].push(c.comment)
        }
        for (const [checkId, msgs] of Object.entries(commentsByCheck)) {
          const existing = result.get(checkId)
          if (existing) {
            existing.notes = msgs.join('; ')
          } else {
            result.set(checkId, { notes: msgs.join('; ') })
          }
        }
      }
    } catch { /* deleted entities */ }
  }

  // Inspections
  if (groups['inspection']?.length) {
    try {
          const { data } = await supabase
        .from('inspections')
        .select('id, notes, weather_conditions, inspection_type')
        .in('id', groups['inspection'])
      if (data) {
        for (const r of data as { id: string; notes?: string; weather_conditions?: string; inspection_type?: string }[]) {
          result.set(r.id, {
            title: r.inspection_type || undefined,
            notes: r.notes || undefined,
            extra: r.weather_conditions ? `Weather: ${r.weather_conditions}` : undefined,
          })
        }
      }
    } catch { /* deleted entities */ }
  }

  // Waivers
  if (groups['waiver']?.length) {
    try {
          const { data } = await supabase
        .from('waivers')
        .select('id, waiver_number, description')
        .in('id', groups['waiver'])
      if (data) {
        for (const r of data as { id: string; waiver_number?: string; description?: string }[]) {
          result.set(r.id, { title: r.waiver_number || undefined, description: r.description || undefined })
        }
      }
    } catch { /* deleted entities */ }
  }

  // Wildlife sightings
  if (groups['wildlife_sighting']?.length) {
    try {
      const { data } = await supabase
        .from('wildlife_sightings')
        .select('id, species_common, count_observed, action_taken, location_text')
        .in('id', groups['wildlife_sighting'])
      if (data) {
        for (const r of data as { id: string; species_common?: string; count_observed?: number; action_taken?: string; location_text?: string }[]) {
          result.set(r.id, {
            title: r.species_common || 'Unknown species',
            description: `${r.count_observed ?? 1}x observed${r.location_text ? ` at ${r.location_text}` : ''}`,
            extra: r.action_taken && r.action_taken !== 'none' ? `Action: ${r.action_taken}` : undefined,
          })
        }
      }
    } catch { /* deleted entities */ }
  }

  // Wildlife strikes
  if (groups['wildlife_strike']?.length) {
    try {
      const { data } = await supabase
        .from('wildlife_strikes')
        .select('id, species_common, aircraft_type, damage_level, location_text')
        .in('id', groups['wildlife_strike'])
      if (data) {
        for (const r of data as { id: string; species_common?: string; aircraft_type?: string; damage_level?: string; location_text?: string }[]) {
          result.set(r.id, {
            title: r.species_common || 'Unknown species',
            description: `${r.aircraft_type || 'Unknown aircraft'}${r.location_text ? ` at ${r.location_text}` : ''}`,
            extra: r.damage_level ? `Damage: ${r.damage_level}` : undefined,
          })
        }
      }
    } catch { /* deleted entities */ }
  }

  // Parking plans
  if (groups['parking_plan']?.length) {
    try {
      const { data } = await supabase
        .from('parking_plans')
        .select('id, plan_name, description')
        .in('id', groups['parking_plan'])
      if (data) {
        for (const r of data as { id: string; plan_name?: string; description?: string }[]) {
          result.set(r.id, { title: r.plan_name || undefined, description: r.description || undefined })
        }
      }
    } catch { /* deleted entities */ }
  }

  // Waiver reviews
  if (groups['waiver_review']?.length) {
    try {
          const { data } = await supabase
        .from('waiver_reviews')
        .select('id, notes')
        .in('id', groups['waiver_review'])
      if (data) {
        for (const r of data as { id: string; notes?: string }[]) {
          result.set(r.id, { notes: r.notes || undefined })
        }
      }
    } catch { /* deleted entities */ }
  }

  return result
}
