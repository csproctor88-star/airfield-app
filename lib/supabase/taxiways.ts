// CRUD operations for base_taxiways (installation-level taxiway centerlines)

import { createClient } from './client'
import type { BaseTaxiway } from './types'

export async function fetchTaxiways(baseId: string): Promise<BaseTaxiway[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('base_taxiways')
    .select('*')
    .eq('base_id', baseId)
    .order('designator')

  if (error) {
    console.error('fetchTaxiways error:', error)
    return []
  }
  return (data ?? []) as BaseTaxiway[]
}

export async function createTaxiway(
  baseId: string,
  taxiway: {
    designator: string
    taxiway_type?: string
    tdg?: number
    width_ft?: number | null
    centerline_coords: [number, number][]
    notes?: string | null
  },
): Promise<BaseTaxiway | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('base_taxiways')
    .insert({
      base_id: baseId,
      designator: taxiway.designator,
      taxiway_type: taxiway.taxiway_type || 'taxiway',
      tdg: taxiway.tdg ?? 3,
      width_ft: taxiway.width_ft ?? null,
      centerline_coords: taxiway.centerline_coords as any,
      notes: taxiway.notes ?? null,
    } as any)
    .select('*')
    .single()

  if (error) {
    console.error('createTaxiway error:', error)
    return null
  }
  return data as BaseTaxiway
}

export async function updateTaxiway(
  id: string,
  updates: Partial<{
    designator: string
    taxiway_type: string
    tdg: number
    width_ft: number | null
    centerline_coords: [number, number][]
    notes: string | null
  }>,
): Promise<BaseTaxiway | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('base_taxiways')
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('updateTaxiway error:', error)
    return null
  }
  return data as BaseTaxiway
}

export async function deleteTaxiway(id: string): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('base_taxiways')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('deleteTaxiway error:', error)
    return false
  }
  return true
}
