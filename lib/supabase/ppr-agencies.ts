import { createClient } from './client'
import { friendlyError } from '@/lib/utils'

function db() {
  return createClient()
}

export type PprAgency = {
  id: string
  base_id: string
  agency_name: string
  sort_order: number
  is_active: boolean
  /** When true, this group gets the .ics calendar invite on PPR approval. */
  send_calendar_invite: boolean
  created_at: string
}

export async function fetchPprAgencies(baseId: string, onlyActive = false): Promise<PprAgency[]> {
  const supabase = db()
  if (!supabase) return []

  let query = supabase
    .from('ppr_agencies')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })
    .order('agency_name', { ascending: true })

  if (onlyActive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) {
    console.error('fetchPprAgencies failed:', error.message)
    return []
  }
  return (data || []) as PprAgency[]
}

export async function createPprAgency(
  baseId: string,
  name: string,
  sendCalendarInvite = false,
): Promise<{ data: PprAgency | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const trimmed = name.trim()
  if (!trimmed) return { data: null, error: 'Agency name is required' }

  const { data: existing } = await supabase
    .from('ppr_agencies')
    .select('sort_order')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder =
    (existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order : 0) + 10

  const { data, error } = await supabase
    .from('ppr_agencies')
    .insert({ base_id: baseId, agency_name: trimmed, sort_order: nextOrder, send_calendar_invite: sendCalendarInvite })
    .select('*')
    .single()

  if (error) return { data: null, error: friendlyError(error.message) }
  return { data: data as PprAgency, error: null }
}

export async function updatePprAgency(
  id: string,
  fields: { agency_name?: string; is_active?: boolean; sort_order?: number; send_calendar_invite?: boolean },
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const patch: Record<string, unknown> = {}
  if (fields.agency_name !== undefined) patch.agency_name = fields.agency_name.trim()
  if (fields.is_active !== undefined) patch.is_active = fields.is_active
  if (fields.sort_order !== undefined) patch.sort_order = fields.sort_order
  if (fields.send_calendar_invite !== undefined) patch.send_calendar_invite = fields.send_calendar_invite

  const { error } = await supabase.from('ppr_agencies').update(patch).eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

export async function deletePprAgency(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('ppr_agencies').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

export async function reorderPprAgencies(
  ordered: { id: string; sort_order: number }[],
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  for (const entry of ordered) {
    const { error } = await supabase
      .from('ppr_agencies')
      .update({ sort_order: entry.sort_order })
      .eq('id', entry.id)
    if (error) return { error: friendlyError(error.message) }
  }
  return { error: null }
}
