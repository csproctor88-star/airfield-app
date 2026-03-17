import { createClient } from './client'

export type BaseWildlifeSpeciesRow = {
  id: string
  installation_id: string
  species_common: string
  added_by: string | null
  created_at: string
}

export async function fetchBaseSpecies(installationId: string): Promise<BaseWildlifeSpeciesRow[]> {
  const supabase = createClient()
  if (!supabase || !installationId) return []
  const { data } = await supabase
    .from('base_wildlife_species')
    .select('*')
    .eq('installation_id', installationId)
    .order('species_common')
  return (data ?? []) as BaseWildlifeSpeciesRow[]
}

export async function addBaseSpecies(installationId: string, speciesCommon: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Not connected' }
  const { error } = await supabase
    .from('base_wildlife_species')
    .insert({ installation_id: installationId, species_common: speciesCommon } as any)
  if (error) {
    if (error.code === '23505') return { error: null } // duplicate, treat as success
    return { error: error.message }
  }
  return { error: null }
}

export async function addBaseSpeciesBulk(installationId: string, speciesNames: string[]): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Not connected' }
  const rows = speciesNames.map(name => ({ installation_id: installationId, species_common: name }))
  const { error } = await supabase
    .from('base_wildlife_species')
    .upsert(rows as any[], { onConflict: 'installation_id,species_common' })
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
    .eq('installation_id', installationId)
    .eq('species_common', speciesCommon)
  if (error) return { error: error.message }
  return { error: null }
}
