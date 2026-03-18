import { createClient } from './client'

export type BaseWildlifeSpeciesRow = {
  id: string
  base_id: string
  species_common: string
  is_favorite: boolean
  added_by: string | null
  created_at: string
}

export async function fetchBaseSpecies(installationId: string): Promise<BaseWildlifeSpeciesRow[]> {
  const supabase = createClient()
  if (!supabase || !installationId) return []
  const { data } = await supabase
    .from('base_wildlife_species')
    .select('*')
    .eq('base_id', installationId)
    .order('species_common')
  return (data ?? []).map((r: any) => ({ ...r, is_favorite: r.is_favorite ?? false })) as BaseWildlifeSpeciesRow[]
}

export async function addBaseSpecies(installationId: string, speciesCommon: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Not connected' }
  const { error } = await supabase
    .from('base_wildlife_species')
    .insert({ base_id: installationId, species_common: speciesCommon } as any)
  if (error) {
    if (error.code === '23505') return { error: null } // duplicate, treat as success
    return { error: error.message }
  }
  return { error: null }
}

export async function addBaseSpeciesBulk(installationId: string, speciesNames: string[]): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Not connected' }
  const rows = speciesNames.map(name => ({ base_id: installationId, species_common: name }))
  const { error } = await supabase
    .from('base_wildlife_species')
    .upsert(rows as any[], { onConflict: 'base_id,species_common' })
  if (error) return { error: error.message }
  return { error: null }
}

export async function removeBaseSpecies(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Not connected' }
  const { error } = await supabase
    .from('base_wildlife_species')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function removeBaseSpeciesByName(installationId: string, speciesCommon: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Not connected' }
  const { error } = await supabase
    .from('base_wildlife_species')
    .delete()
    .eq('base_id', installationId)
    .eq('species_common', speciesCommon)
  if (error) return { error: error.message }
  return { error: null }
}

export async function toggleFavoriteSpecies(installationId: string, speciesCommon: string, isFavorite: boolean): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Not connected' }
  const { error } = await supabase
    .from('base_wildlife_species')
    .update({ is_favorite: isFavorite } as any)
    .eq('base_id', installationId)
    .eq('species_common', speciesCommon)
  if (error) return { error: error.message }
  return { error: null }
}
