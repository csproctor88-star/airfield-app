import { createClient } from './client'

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
}

export async function fetchActivityLog(options: {
  baseId?: string | null
  startDate?: string
  endDate?: string
  limit?: number
}): Promise<{ data: ActivityEntry[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  const { baseId, startDate, endDate, limit = 200 } = options

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('activity_log')
    .select('id, action, entity_type, entity_id, entity_display_id, metadata, created_at, user_id, profiles:user_id(name, rank)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (baseId) query = query.eq('base_id', baseId)
  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)

  const { data, error } = await query

  if (error) {
    // Fallback without join
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallbackQuery = (supabase as any)
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (baseId) fallbackQuery = fallbackQuery.eq('base_id', baseId)
    if (startDate) fallbackQuery = fallbackQuery.gte('created_at', startDate)
    if (endDate) fallbackQuery = fallbackQuery.lte('created_at', endDate)

    const { data: fallback } = await fallbackQuery

    if (fallback) {
      return {
        data: fallback.map((r: Record<string, unknown>) => ({
          ...r,
          user_name: 'Unknown',
          user_rank: null,
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
        metadata: (r.metadata as Record<string, unknown>) || null,
      })) as ActivityEntry[],
      error: null,
    }
  }

  return { data: [], error: null }
}
