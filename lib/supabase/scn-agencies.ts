import { createClient } from './client'
import { friendlyError } from '@/lib/utils'

function db() {
  return createClient()
}

export type ScnAgency = {
  id: string
  base_id: string
  agency_name: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export async function fetchScnAgencies(baseId: string, onlyActive = false): Promise<ScnAgency[]> {
  const supabase = db()
  if (!supabase) return []

  let query = supabase
    .from('scn_agencies')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })
    .order('agency_name', { ascending: true })

  if (onlyActive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) {
    console.error('fetchScnAgencies failed:', error.message)
    return []
  }
  return (data || []) as ScnAgency[]
}

export async function createScnAgency(baseId: string, name: string): Promise<{ data: ScnAgency | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const trimmed = name.trim()
  if (!trimmed) return { data: null, error: 'Agency name is required' }

  // Append to end by default
  const { data: existing } = await supabase
    .from('scn_agencies')
    .select('sort_order')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order : 0) + 10

  const { data, error } = await supabase
    .from('scn_agencies')
    .insert({ base_id: baseId, agency_name: trimmed, sort_order: nextOrder })
    .select('*')
    .single()

  if (error) return { data: null, error: friendlyError(error.message) }
  return { data: data as ScnAgency, error: null }
}

export async function updateScnAgency(id: string, fields: { agency_name?: string; is_active?: boolean; sort_order?: number }): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const patch: Record<string, unknown> = {}
  if (fields.agency_name !== undefined) patch.agency_name = fields.agency_name.trim()
  if (fields.is_active !== undefined) patch.is_active = fields.is_active
  if (fields.sort_order !== undefined) patch.sort_order = fields.sort_order

  const { error } = await supabase.from('scn_agencies').update(patch).eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

export async function deleteScnAgency(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('scn_agencies').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

export async function reorderScnAgencies(ordered: { id: string; sort_order: number }[]): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  for (const entry of ordered) {
    const { error } = await supabase
      .from('scn_agencies')
      .update({ sort_order: entry.sort_order })
      .eq('id', entry.id)
    if (error) return { error: friendlyError(error.message) }
  }
  return { error: null }
}
