import { friendlyError } from '@/lib/utils'
import { createClient } from './client'

export type FacilityRow = {
  id: string
  base_id: string
  facility_number: string
  description: string
  sort_order: number
  created_at: string
}

export async function fetchFacilities(baseId?: string | null): Promise<FacilityRow[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []

  const { data, error } = await supabase
    .from('base_facilities')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to fetch facilities:', error.message)
    return []
  }

  return data as FacilityRow[]
}

export async function createFacility(input: {
  base_id: string
  facility_number: string
  description: string
  sort_order?: number
}): Promise<{ data: FacilityRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('base_facilities')
    .insert({
      base_id: input.base_id,
      facility_number: input.facility_number,
      description: input.description,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create facility:', error.message)
    return { data: null, error: friendlyError(error.message) }
  }

  return { data: data as FacilityRow, error: null }
}

export async function bulkCreateFacilities(
  baseId: string,
  rows: { facility_number: string; description: string }[],
): Promise<{ count: number; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { count: 0, error: 'Supabase not configured' }

  const inserts = rows.map((r, i) => ({
    base_id: baseId,
    facility_number: r.facility_number,
    description: r.description,
    sort_order: i,
  }))

  const { data, error } = await supabase
    .from('base_facilities')
    .insert(inserts as never)
    .select()

  if (error) {
    console.error('Failed to bulk create facilities:', error.message)
    return { count: 0, error: friendlyError(error.message) }
  }

  return { count: data?.length ?? 0, error: null }
}

export async function deleteFacility(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase
    .from('base_facilities')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Failed to delete facility:', error.message)
    return { error: friendlyError(error.message) }
  }

  return { error: null }
}
