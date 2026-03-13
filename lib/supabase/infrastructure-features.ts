import { createClient } from './client'
import type { InfrastructureFeature } from './types'

export type InfrastructureFeatureType =
  | 'runway_edge_light'
  | 'taxiway_light'
  | 'taxiway_end_light'
  | 'approach_light'
  | 'runway_threshold'
  | 'location_sign'
  | 'directional_sign'
  | 'informational_sign'
  | 'mandatory_sign'
  | 'obstruction_light'
  | 'runway_distance_marker'
  | 'papi'
  | 'threshold_light'
  | 'pre_threshold_light'
  | 'terminating_bar_light'
  | 'centerline_bar_light'
  | 'thousand_ft_bar_light'
  | 'sequenced_flasher'
  | 'reil'
  | 'windcone'
  | 'stadium_light'
  | 'rotating_beacon'

// ── Feature type label map ──

const FEATURE_TYPE_LABELS: Record<string, string> = {
  approach_light: 'Approach Light', centerline_bar_light: 'Centerline Bar Light',
  directional_sign: 'Directional Sign', informational_sign: 'Informational Sign',
  location_sign: 'Location Sign', mandatory_sign: 'Mandatory Sign',
  obstruction_light: 'Obstruction Light', papi: 'PAPI',
  pre_threshold_light: 'Pre-Threshold Light', reil: 'REIL',
  rotating_beacon: 'Rotating Beacon', runway_distance_marker: 'Distance Remaining Marker',
  runway_edge_light: 'Runway Edge Light', runway_threshold: 'Runway Threshold',
  sequenced_flasher: 'Sequenced Flasher', stadium_light: 'Stadium Light',
  taxiway_end_light: 'Taxiway End Light', taxiway_light: 'Taxiway Light',
  terminating_bar_light: 'Terminating Bar Light', thousand_ft_bar_light: "1000' Bar Light",
  threshold_light: 'Threshold Light', windcone: 'Windcone',
}

export function formatFeatureType(type: string): string {
  return FEATURE_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Build a descriptive display name for a feature using its system/component context.
 * Example: "TWY K — 19 Mandatory Sign" or "RWY 01/19 PAPI" or "Taxiway Light"
 *
 * @param feature - Must have label and feature_type
 * @param systemName - e.g. "TWY K - Airfield Signage" (the part before " - " is used as location prefix)
 * @param componentLabel - e.g. "Taxiway K Signs" (used as fallback if no system name)
 */
export function buildFeatureDisplayName(
  feature: { label: string | null; feature_type: string },
  systemName?: string | null,
  componentLabel?: string | null,
): string {
  const typeLabel = formatFeatureType(feature.feature_type)
  const parts: string[] = []

  // Extract location prefix from system name (e.g., "TWY K" from "TWY K - Airfield Signage")
  if (systemName) {
    const dashIdx = systemName.indexOf(' - ')
    parts.push(dashIdx >= 0 ? systemName.substring(0, dashIdx) : systemName)
  }

  if (feature.label) parts.push(feature.label)
  parts.push(typeLabel)

  return parts.join(' ')
}

// ── Fetch all features for a base ──

export async function fetchInfrastructureFeatures(baseId: string): Promise<InfrastructureFeature[]> {
  const supabase = createClient()
  if (!supabase) return []

  // Supabase default limit is 1000 rows — paginate to fetch all
  const allData: any[] = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('infrastructure_features')
      .select('*')
      .eq('base_id', baseId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) return allData as InfrastructureFeature[]
    if (!data || data.length === 0) break
    allData.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  return allData as InfrastructureFeature[]
}

// ── Fetch a single feature by ID ──

export async function fetchInfrastructureFeature(id: string): Promise<InfrastructureFeature | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('infrastructure_features')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as InfrastructureFeature
}

// ── Create a single feature ──

export async function createInfrastructureFeature(input: {
  baseId: string
  feature_type: InfrastructureFeatureType
  longitude: number
  latitude: number
  layer?: string
  block?: string
  label?: string
  notes?: string
  source?: 'import' | 'user'
}): Promise<InfrastructureFeature | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('infrastructure_features')
    .insert({
      base_id: input.baseId,
      feature_type: input.feature_type,
      longitude: input.longitude,
      latitude: input.latitude,
      layer: input.layer || null,
      block: input.block || null,
      label: input.label || null,
      notes: input.notes || null,
      source: input.source || 'user',
      created_by: user?.id || null,
    } as any)
    .select('*')
    .single()

  if (error) return null
  return data as InfrastructureFeature
}

// ── Update a feature (reposition, change type, etc.) ──

export async function updateInfrastructureFeature(
  id: string,
  updates: {
    longitude?: number
    latitude?: number
    feature_type?: InfrastructureFeatureType
    label?: string
    notes?: string
    rotation?: number
    system_component_id?: string | null
  }
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { data, error } = await supabase
    .from('infrastructure_features')
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
    .select('id')
    .single()

  return !error && !!data
}

// ── Delete a feature ──

export async function deleteInfrastructureFeature(id: string): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('infrastructure_features')
    .delete()
    .eq('id', id)

  return !error
}

// ── Update feature operational status ──

export async function updateFeatureStatus(
  id: string,
  status: 'operational' | 'inoperative',
): Promise<InfrastructureFeature | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('infrastructure_features')
    .update({
      status,
      status_changed_at: new Date().toISOString(),
      status_changed_by: user?.id || null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return null
  return data as InfrastructureFeature
}

// ── Bulk update status for multiple features ──

export async function bulkUpdateStatus(
  ids: string[],
  status: 'operational' | 'inoperative',
): Promise<number> {
  const supabase = createClient()
  if (!supabase || ids.length === 0) return 0

  const { data: { user } } = await supabase.auth.getUser()

  let updated = 0
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    const { error } = await supabase
      .from('infrastructure_features')
      .update({
        status,
        status_changed_at: new Date().toISOString(),
        status_changed_by: user?.id || null,
        updated_at: new Date().toISOString(),
      } as any)
      .in('id', batch)
    if (!error) updated += batch.length
  }

  return updated
}

// ── Bulk shift features by offset (for alignment corrections) ──

export async function bulkShiftFeatures(
  baseId: string,
  lngOffset: number,
  latOffset: number,
  filter?: { layer?: string; feature_type?: string }
): Promise<number> {
  const supabase = createClient()
  if (!supabase) return 0

  // Fetch matching features
  let query = supabase
    .from('infrastructure_features')
    .select('id, longitude, latitude')
    .eq('base_id', baseId)

  if (filter?.layer) query = query.eq('layer', filter.layer)
  if (filter?.feature_type) query = query.eq('feature_type', filter.feature_type)

  const { data: features, error: fetchError } = await query
  if (fetchError || !features || features.length === 0) return 0

  // Update in batches of 200
  let updated = 0
  for (let i = 0; i < features.length; i += 200) {
    const batch = features.slice(i, i + 200)
    const promises = batch.map(f =>
      supabase
        .from('infrastructure_features')
        .update({
          longitude: f.longitude + lngOffset,
          latitude: f.latitude + latOffset,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', f.id)
    )
    const results = await Promise.all(promises)
    updated += results.filter(r => !r.error).length
  }

  return updated
}

// ── Bulk shift by specific feature IDs ──

export async function bulkShiftByIds(
  ids: string[],
  lngOffset: number,
  latOffset: number,
): Promise<number> {
  const supabase = createClient()
  if (!supabase || ids.length === 0) return 0

  const { data: features, error: fetchError } = await supabase
    .from('infrastructure_features')
    .select('id, longitude, latitude')
    .in('id', ids)

  if (fetchError || !features || features.length === 0) return 0

  let updated = 0
  for (let i = 0; i < features.length; i += 200) {
    const batch = features.slice(i, i + 200)
    const promises = batch.map(f =>
      supabase
        .from('infrastructure_features')
        .update({
          longitude: f.longitude + lngOffset,
          latitude: f.latitude + latOffset,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', f.id)
    )
    const results = await Promise.all(promises)
    updated += results.filter(r => !r.error).length
  }

  return updated
}

// ── Bulk re-layer features by IDs ──

export async function bulkRelayerFeatures(
  ids: string[],
  newLayer: string,
): Promise<number> {
  const supabase = createClient()
  if (!supabase || ids.length === 0) return 0

  let updated = 0
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    const { error } = await supabase
      .from('infrastructure_features')
      .update({ layer: newLayer, updated_at: new Date().toISOString() } as any)
      .in('id', batch)
    if (!error) updated += batch.length
  }

  return updated
}

// ── Bulk create (for initial import) ──

export async function bulkCreateInfrastructureFeatures(
  baseId: string,
  features: {
    feature_type: InfrastructureFeatureType
    longitude: number
    latitude: number
    layer?: string
    block?: string
    label?: string
    rotation?: number
    source?: 'import' | 'user'
  }[]
): Promise<number> {
  const supabase = createClient()
  if (!supabase) return 0

  const { data: { user } } = await supabase.auth.getUser()

  const rows = features.map(f => ({
    base_id: baseId,
    feature_type: f.feature_type,
    longitude: f.longitude,
    latitude: f.latitude,
    layer: f.layer || null,
    block: f.block || null,
    label: f.label || null,
    rotation: f.rotation ?? 0,
    notes: null,
    source: f.source || 'import',
    created_by: user?.id || null,
  }))

  // Insert in batches of 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase
      .from('infrastructure_features')
      .insert(batch as any)
    if (!error) inserted += batch.length
  }

  return inserted
}

// ── Bulk prefix labels (prepend text to existing labels) ──

export async function bulkPrefixLabels(
  ids: string[],
  prefix: string,
): Promise<number> {
  const supabase = createClient()
  if (!supabase || ids.length === 0 || !prefix) return 0

  // Fetch current labels
  const { data: features, error: fetchError } = await supabase
    .from('infrastructure_features')
    .select('id, label')
    .in('id', ids)

  if (fetchError || !features) return 0

  let updated = 0
  const toUpdate = features.filter(f => {
    const current = f.label || ''
    return !current.startsWith(prefix) // Skip if already prefixed
  })

  for (let i = 0; i < toUpdate.length; i += 200) {
    const batch = toUpdate.slice(i, i + 200)
    const promises = batch.map(f =>
      supabase
        .from('infrastructure_features')
        .update({
          label: `${prefix}${f.label || ''}`.trim(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', f.id)
    )
    const results = await Promise.all(promises)
    updated += results.filter(r => !r.error).length
  }

  return updated
}

// ── Bulk update labels by ID ──

export async function bulkUpdateLabels(
  updates: { id: string; label: string }[],
): Promise<number> {
  const supabase = createClient()
  if (!supabase || updates.length === 0) return 0

  let updated = 0
  for (let i = 0; i < updates.length; i += 200) {
    const batch = updates.slice(i, i + 200)
    const promises = batch.map(u =>
      supabase
        .from('infrastructure_features')
        .update({ label: u.label, updated_at: new Date().toISOString() } as any)
        .eq('id', u.id)
    )
    const results = await Promise.all(promises)
    updated += results.filter(r => !r.error).length
  }

  return updated
}

// ── Bulk assign features to a system component ──

export async function bulkAssignComponent(
  filter: { baseId: string; layer?: string; feature_type?: string },
  componentId: string | null,
): Promise<number> {
  const supabase = createClient()
  if (!supabase) return 0

  // Build query to find matching feature IDs
  let query = supabase
    .from('infrastructure_features')
    .select('id')
    .eq('base_id', filter.baseId)

  if (filter.layer) query = query.eq('layer', filter.layer)
  if (filter.feature_type) query = query.eq('feature_type', filter.feature_type)

  const { data: features, error: fetchError } = await query
  if (fetchError || !features || features.length === 0) return 0

  const ids = features.map(f => f.id)
  let updated = 0
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    const { error } = await supabase
      .from('infrastructure_features')
      .update({
        system_component_id: componentId,
        updated_at: new Date().toISOString(),
      } as any)
      .in('id', batch)
    if (!error) updated += batch.length
  }

  return updated
}
