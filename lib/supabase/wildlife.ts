import { createClient } from './client'
import { logActivity } from './activity'

// ── Types ──

export type WildlifeSightingRow = {
  id: string
  base_id: string | null
  display_id: string
  species_common: string
  species_scientific: string | null
  species_group: string
  size_category: string | null
  count_observed: number
  behavior: string | null
  latitude: number | null
  longitude: number | null
  location_text: string | null
  airfield_zone: string | null
  observed_at: string
  time_of_day: string | null
  sky_condition: string | null
  precipitation: string | null
  action_taken: string | null
  dispersal_method: string | null
  dispersal_effective: boolean | null
  observed_by: string
  observed_by_id: string | null
  check_id: string | null
  inspection_id: string | null
  discrepancy_id: string | null
  photo_count: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type WildlifeStrikeRow = {
  id: string
  base_id: string | null
  display_id: string
  species_common: string | null
  species_scientific: string | null
  species_group: string | null
  size_category: string | null
  number_struck: number
  number_seen: number | null
  latitude: number | null
  longitude: number | null
  location_text: string | null
  strike_date: string
  time_of_day: string | null
  sky_condition: string | null
  precipitation: string | null
  aircraft_type: string | null
  aircraft_registration: string | null
  engine_type: string | null
  phase_of_flight: string | null
  altitude_agl: number | null
  speed_ias: number | null
  pilot_warned: boolean | null
  parts_struck: string[] | null
  parts_damaged: string[] | null
  damage_level: string | null
  engine_ingested: boolean
  engines_ingested: number[] | null
  flight_effect: string | null
  repair_cost: number | null
  other_cost: number | null
  hours_out_of_service: number | null
  remains_collected: boolean
  remains_sent_to_lab: boolean
  lab_identification: string | null
  reported_by: string
  reported_by_id: string | null
  discrepancy_id: string | null
  sighting_id: string | null
  photo_count: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type BwcHistoryRow = {
  id: string
  base_id: string | null
  bwc_value: string
  set_at: string
  set_by: string | null
  source: string | null
  source_id: string | null
  notes: string | null
  created_at: string
}

// ── Sightings ──

export async function createSighting(input: {
  species_common: string
  species_scientific?: string | null
  species_group: string
  size_category?: string | null
  count_observed: number
  behavior?: string | null
  latitude?: number | null
  longitude?: number | null
  location_text?: string | null
  airfield_zone?: string | null
  observed_at?: string
  time_of_day?: string | null
  sky_condition?: string | null
  precipitation?: string | null
  action_taken?: string | null
  dispersal_method?: string | null
  dispersal_effective?: boolean | null
  observed_by: string
  observed_by_id?: string | null
  check_id?: string | null
  inspection_id?: string | null
  notes?: string | null
  base_id?: string | null
}): Promise<{ data: WildlifeSightingRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const now = new Date()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `WS-${ts}`

  const row: Record<string, unknown> = {
    display_id,
    species_common: input.species_common,
    species_scientific: input.species_scientific ?? null,
    species_group: input.species_group,
    size_category: input.size_category ?? null,
    count_observed: input.count_observed,
    behavior: input.behavior ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    location_text: input.location_text ?? null,
    airfield_zone: input.airfield_zone ?? null,
    observed_at: input.observed_at ?? now.toISOString(),
    time_of_day: input.time_of_day ?? null,
    sky_condition: input.sky_condition ?? null,
    precipitation: input.precipitation ?? null,
    action_taken: input.action_taken ?? 'none',
    dispersal_method: input.dispersal_method ?? null,
    dispersal_effective: input.dispersal_effective ?? null,
    observed_by: input.observed_by,
    observed_by_id: input.observed_by_id ?? null,
    check_id: input.check_id ?? null,
    inspection_id: input.inspection_id ?? null,
    notes: input.notes ?? null,
  }
  if (input.base_id) row.base_id = input.base_id

  const { data, error } = await supabase
    .from('wildlife_sightings')
    .insert(row as any)
    .select()
    .single()

  if (error) {
    console.error('Failed to create sighting:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as WildlifeSightingRow

  const actionLabel = input.action_taken && input.action_taken !== 'none'
    ? ` — ${input.action_taken.toUpperCase()}`
    : ''
  logActivity(
    'created', 'wildlife_sighting', created.id, created.display_id,
    { details: `WILDLIFE SIGHTING: ${input.count_observed}x ${input.species_common.toUpperCase()}${actionLabel}` },
    input.base_id,
  )

  return { data: created, error: null }
}

export async function fetchSightings(
  baseId?: string | null,
  filters?: { startDate?: string; endDate?: string; species?: string; zone?: string },
): Promise<{ data: WildlifeSightingRow[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  let query = supabase
    .from('wildlife_sightings')
    .select('*')
    .order('observed_at', { ascending: false })

  if (baseId) query = query.eq('base_id', baseId)
  if (filters?.startDate) query = query.gte('observed_at', filters.startDate)
  if (filters?.endDate) query = query.lte('observed_at', filters.endDate)
  if (filters?.species) query = query.eq('species_common', filters.species)
  if (filters?.zone) query = query.eq('airfield_zone', filters.zone)

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch sightings:', error.message)
    return { data: [], error: error.message }
  }

  return { data: data as WildlifeSightingRow[], error: null }
}

export async function fetchSighting(id: string): Promise<WildlifeSightingRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('wildlife_sightings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch sighting:', error.message)
    return null
  }

  return data as WildlifeSightingRow
}

export async function deleteSighting(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: existing } = await supabase
    .from('wildlife_sightings')
    .select('display_id, base_id')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('wildlife_sightings').delete().eq('id', id)

  if (error) {
    console.error('Delete sighting failed:', error.message)
    return { error: error.message }
  }

  await supabase.from('activity_log').delete().eq('entity_id', id)

  return { error: null }
}

// ── Strikes ──

export async function createStrike(input: {
  species_common?: string | null
  species_scientific?: string | null
  species_group?: string | null
  size_category?: string | null
  number_struck?: number
  number_seen?: number | null
  latitude?: number | null
  longitude?: number | null
  location_text?: string | null
  strike_date?: string
  time_of_day?: string | null
  sky_condition?: string | null
  precipitation?: string | null
  aircraft_type?: string | null
  aircraft_registration?: string | null
  engine_type?: string | null
  phase_of_flight?: string | null
  altitude_agl?: number | null
  speed_ias?: number | null
  pilot_warned?: boolean | null
  parts_struck?: string[]
  parts_damaged?: string[]
  damage_level?: string | null
  engine_ingested?: boolean
  engines_ingested?: number[]
  flight_effect?: string | null
  repair_cost?: number | null
  other_cost?: number | null
  hours_out_of_service?: number | null
  remains_collected?: boolean
  remains_sent_to_lab?: boolean
  lab_identification?: string | null
  reported_by: string
  reported_by_id?: string | null
  sighting_id?: string | null
  notes?: string | null
  base_id?: string | null
}): Promise<{ data: WildlifeStrikeRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const now = new Date()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `WX-${ts}`

  const row: Record<string, unknown> = {
    display_id,
    species_common: input.species_common ?? null,
    species_scientific: input.species_scientific ?? null,
    species_group: input.species_group ?? null,
    size_category: input.size_category ?? null,
    number_struck: input.number_struck ?? 1,
    number_seen: input.number_seen ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    location_text: input.location_text ?? null,
    strike_date: input.strike_date ?? now.toISOString(),
    time_of_day: input.time_of_day ?? null,
    sky_condition: input.sky_condition ?? null,
    precipitation: input.precipitation ?? null,
    aircraft_type: input.aircraft_type ?? null,
    aircraft_registration: input.aircraft_registration ?? null,
    engine_type: input.engine_type ?? null,
    phase_of_flight: input.phase_of_flight ?? null,
    altitude_agl: input.altitude_agl ?? null,
    speed_ias: input.speed_ias ?? null,
    pilot_warned: input.pilot_warned ?? null,
    parts_struck: input.parts_struck ?? [],
    parts_damaged: input.parts_damaged ?? [],
    damage_level: input.damage_level ?? 'none',
    engine_ingested: input.engine_ingested ?? false,
    engines_ingested: input.engines_ingested ?? [],
    flight_effect: input.flight_effect ?? 'none',
    repair_cost: input.repair_cost ?? null,
    other_cost: input.other_cost ?? null,
    hours_out_of_service: input.hours_out_of_service ?? null,
    remains_collected: input.remains_collected ?? false,
    remains_sent_to_lab: input.remains_sent_to_lab ?? false,
    lab_identification: input.lab_identification ?? null,
    reported_by: input.reported_by,
    reported_by_id: input.reported_by_id ?? null,
    sighting_id: input.sighting_id ?? null,
    notes: input.notes ?? null,
  }
  if (input.base_id) row.base_id = input.base_id

  const { data, error } = await supabase
    .from('wildlife_strikes')
    .insert(row as any)
    .select()
    .single()

  if (error) {
    console.error('Failed to create strike:', error.message)
    return { data: null, error: error.message }
  }

  const created = data as WildlifeStrikeRow

  const speciesLabel = input.species_common?.toUpperCase() || 'UNKNOWN SPECIES'
  const damageLabel = input.damage_level && input.damage_level !== 'none'
    ? ` — DMG: ${input.damage_level.toUpperCase()}`
    : ''
  logActivity(
    'created', 'wildlife_strike', created.id, created.display_id,
    { details: `WILDLIFE STRIKE: ${speciesLabel}${damageLabel}` },
    input.base_id,
  )

  return { data: created, error: null }
}

export async function fetchStrikes(
  baseId?: string | null,
  filters?: { startDate?: string; endDate?: string; species?: string; damageLevel?: string },
): Promise<{ data: WildlifeStrikeRow[]; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  let query = supabase
    .from('wildlife_strikes')
    .select('*')
    .order('strike_date', { ascending: false })

  if (baseId) query = query.eq('base_id', baseId)
  if (filters?.startDate) query = query.gte('strike_date', filters.startDate)
  if (filters?.endDate) query = query.lte('strike_date', filters.endDate)
  if (filters?.species) query = query.eq('species_common', filters.species)
  if (filters?.damageLevel) query = query.eq('damage_level', filters.damageLevel)

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch strikes:', error.message)
    return { data: [], error: error.message }
  }

  return { data: data as WildlifeStrikeRow[], error: null }
}

export async function fetchStrike(id: string): Promise<WildlifeStrikeRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('wildlife_strikes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch strike:', error.message)
    return null
  }

  return data as WildlifeStrikeRow
}

export async function deleteStrike(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase.from('wildlife_strikes').delete().eq('id', id)

  if (error) {
    console.error('Delete strike failed:', error.message)
    return { error: error.message }
  }

  await supabase.from('activity_log').delete().eq('entity_id', id)

  return { error: null }
}

// ── BWC History ──

export async function logBwcChange(
  baseId: string | null | undefined,
  bwcValue: string,
  source: string,
  sourceId?: string | null,
  setBy?: string | null,
  notes?: string | null,
): Promise<void> {
  const supabase = createClient()
  if (!supabase) return

  const row: Record<string, unknown> = {
    bwc_value: bwcValue,
    set_at: new Date().toISOString(),
    source,
    source_id: sourceId ?? null,
    set_by: setBy ?? null,
    notes: notes ?? null,
  }
  if (baseId) row.base_id = baseId

  const { error } = await supabase
    .from('bwc_history')
    .insert(row as any)

  if (error) {
    console.error('Failed to log BWC change:', error.message)
  }
}

export async function fetchBwcHistory(
  baseId?: string | null,
  startDate?: string,
  endDate?: string,
): Promise<BwcHistoryRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  let query = supabase
    .from('bwc_history')
    .select('*')
    .order('set_at', { ascending: false })

  if (baseId) query = query.eq('base_id', baseId)
  if (startDate) query = query.gte('set_at', startDate)
  if (endDate) query = query.lte('set_at', endDate)

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch BWC history:', error.message)
    return []
  }

  return data as BwcHistoryRow[]
}

// ── Analytics ──

export type WildlifeAnalytics = {
  totalSightings: number
  totalStrikes: number
  totalDispersal: number
  topSpecies: { species: string; count: number }[]
  sightingsByMonth: { month: string; count: number }[]
  strikesByMonth: { month: string; count: number }[]
  speciesGroupBreakdown: { group: string; count: number }[]
  dispersalEffectiveness: { total: number; effective: number }
}

export async function fetchWildlifeAnalytics(
  baseId?: string | null,
  startDate?: string,
  endDate?: string,
): Promise<WildlifeAnalytics> {
  const empty: WildlifeAnalytics = {
    totalSightings: 0, totalStrikes: 0, totalDispersal: 0,
    topSpecies: [], sightingsByMonth: [], strikesByMonth: [],
    speciesGroupBreakdown: [], dispersalEffectiveness: { total: 0, effective: 0 },
  }

  const supabase = createClient()
  if (!supabase) return empty

  // Fetch all sightings and strikes for the period
  let sightingsQuery = supabase.from('wildlife_sightings').select('*')
  let strikesQuery = supabase.from('wildlife_strikes').select('*')

  if (baseId) {
    sightingsQuery = sightingsQuery.eq('base_id', baseId)
    strikesQuery = strikesQuery.eq('base_id', baseId)
  }
  if (startDate) {
    sightingsQuery = sightingsQuery.gte('observed_at', startDate)
    strikesQuery = strikesQuery.gte('strike_date', startDate)
  }
  if (endDate) {
    sightingsQuery = sightingsQuery.lte('observed_at', endDate)
    strikesQuery = strikesQuery.lte('strike_date', endDate)
  }

  const [sightingsResult, strikesResult] = await Promise.all([
    sightingsQuery,
    strikesQuery,
  ])

  const sightings = (sightingsResult.data || []) as WildlifeSightingRow[]
  const strikes = (strikesResult.data || []) as WildlifeStrikeRow[]

  // Aggregate species counts from sightings
  const speciesCounts: Record<string, number> = {}
  const groupCounts: Record<string, number> = {}
  const monthCounts: Record<string, number> = {}
  let dispersalTotal = 0
  let dispersalEffective = 0

  for (const s of sightings) {
    speciesCounts[s.species_common] = (speciesCounts[s.species_common] || 0) + s.count_observed
    groupCounts[s.species_group] = (groupCounts[s.species_group] || 0) + s.count_observed

    const month = s.observed_at.slice(0, 7)
    monthCounts[month] = (monthCounts[month] || 0) + 1

    if (s.action_taken && s.action_taken !== 'none') {
      dispersalTotal++
      if (s.dispersal_effective) dispersalEffective++
    }
  }

  const strikeMonthCounts: Record<string, number> = {}
  for (const s of strikes) {
    const month = s.strike_date.slice(0, 7)
    strikeMonthCounts[month] = (strikeMonthCounts[month] || 0) + 1
  }

  const topSpecies = Object.entries(speciesCounts)
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const speciesGroupBreakdown = Object.entries(groupCounts)
    .map(([group, count]) => ({ group, count }))
    .sort((a, b) => b.count - a.count)

  const sightingsByMonth = Object.entries(monthCounts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const strikesByMonth = Object.entries(strikeMonthCounts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalSightings: sightings.length,
    totalStrikes: strikes.length,
    totalDispersal: dispersalTotal,
    topSpecies,
    sightingsByMonth,
    strikesByMonth,
    speciesGroupBreakdown,
    dispersalEffectiveness: { total: dispersalTotal, effective: dispersalEffective },
  }
}

export async function fetchHeatmapData(
  baseId?: string | null,
  startDate?: string,
  endDate?: string,
  type?: 'sightings' | 'strikes' | 'all',
): Promise<{ lat: number; lng: number; weight: number; species: string; type: string }[]> {
  const supabase = createClient()
  if (!supabase) return []

  const points: { lat: number; lng: number; weight: number; species: string; type: string }[] = []
  const fetchType = type || 'all'

  if (fetchType === 'all' || fetchType === 'sightings') {
    let query = supabase
      .from('wildlife_sightings')
      .select('latitude, longitude, count_observed, species_common')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (baseId) query = query.eq('base_id', baseId)
    if (startDate) query = query.gte('observed_at', startDate)
    if (endDate) query = query.lte('observed_at', endDate)

    const { data } = await query
    if (data) {
      for (const d of data) {
        points.push({
          lat: d.latitude as number,
          lng: d.longitude as number,
          weight: d.count_observed as number,
          species: d.species_common as string,
          type: 'sighting',
        })
      }
    }
  }

  if (fetchType === 'all' || fetchType === 'strikes') {
    let query = supabase
      .from('wildlife_strikes')
      .select('latitude, longitude, number_struck, species_common')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (baseId) query = query.eq('base_id', baseId)
    if (startDate) query = query.gte('strike_date', startDate)
    if (endDate) query = query.lte('strike_date', endDate)

    const { data } = await query
    if (data) {
      for (const d of data) {
        points.push({
          lat: d.latitude as number,
          lng: d.longitude as number,
          weight: ((d.number_struck as number) || 1) * 3, // weight strikes higher
          species: (d.species_common as string) || 'Unknown',
          type: 'strike',
        })
      }
    }
  }

  return points
}
