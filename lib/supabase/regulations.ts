import { createClient } from './client'

export type RegulationRow = {
  id: string
  reg_id: string
  title: string
  description: string
  publication_date: string | null
  url: string | null
  source_section: string
  source_volume: string | null
  category: string
  pub_type: string
  is_core: boolean
  is_cross_ref: boolean
  is_scrubbed: boolean
  tags: string[]
  storage_path: string | null
  file_size_bytes: number | null
  last_verified_at: string | null
  verified_date: string | null
  created_at: string
}

export async function fetchRegulations(): Promise<RegulationRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .order('reg_id', { ascending: true })

  if (error) {
    console.error('Failed to fetch regulations:', error.message)
    return []
  }

  return data as RegulationRow[]
}

export async function fetchRegulation(id: string): Promise<RegulationRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch regulation:', error.message)
    return null
  }

  return data as RegulationRow
}

export async function searchRegulations(query: string): Promise<RegulationRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('regulations')
    .select('*')
    .textSearch('reg_id', query, { type: 'websearch' })
    .order('reg_id', { ascending: true })

  if (error) {
    // Fallback to ilike search
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('regulations')
      .select('*')
      .or(`reg_id.ilike.%${query}%,title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('reg_id', { ascending: true })

    if (fallbackError) {
      console.error('Failed to search regulations:', fallbackError.message)
      return []
    }
    return fallbackData as RegulationRow[]
  }

  return data as RegulationRow[]
}
