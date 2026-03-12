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
