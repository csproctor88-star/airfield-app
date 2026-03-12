import { createClient } from './client'
import type { LightingSystem, LightingSystemComponent, OutageRuleTemplate } from './types'

// ── Fetch all lighting systems for a base ──

export async function fetchLightingSystems(baseId: string): Promise<LightingSystem[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('lighting_systems')
    .select('*')
    .eq('base_id', baseId)
    .order('name')

  if (error) return []
  return data as LightingSystem[]
}

// ── Fetch a single system with its components ──

export async function fetchLightingSystemWithComponents(systemId: string): Promise<{
  system: LightingSystem
  components: LightingSystemComponent[]
} | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data: system, error: sysErr } = await supabase
    .from('lighting_systems')
    .select('*')
    .eq('id', systemId)
    .single()

  if (sysErr || !system) return null

  const { data: components, error: compErr } = await supabase
    .from('lighting_system_components')
    .select('*')
    .eq('system_id', systemId)
    .order('sort_order')

  if (compErr) return null

  return {
    system: system as LightingSystem,
    components: (components || []) as LightingSystemComponent[],
  }
}

// ── Fetch all components for a base (joins through systems) ──

export async function fetchAllComponentsForBase(baseId: string): Promise<LightingSystemComponent[]> {
  const supabase = createClient()
  if (!supabase) return []

  const systems = await fetchLightingSystems(baseId)
  if (systems.length === 0) return []

  const systemIds = systems.map(s => s.id)
  const { data, error } = await supabase
    .from('lighting_system_components')
    .select('*')
    .in('system_id', systemIds)
    .order('sort_order')

  if (error) return []
  return data as LightingSystemComponent[]
}

// ── Create a lighting system ──

export async function createLightingSystem(input: {
  base_id: string
  system_type: string
  name: string
  runway_or_taxiway?: string
  is_precision?: boolean
  notes?: string
}): Promise<LightingSystem | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('lighting_systems')
    .insert({
      base_id: input.base_id,
      system_type: input.system_type,
      name: input.name,
      runway_or_taxiway: input.runway_or_taxiway || null,
      is_precision: input.is_precision || false,
      notes: input.notes || null,
    } as any)
    .select('*')
    .single()

  if (error) return null
  return data as LightingSystem
}

// ── Update a lighting system ──

export async function updateLightingSystem(
  id: string,
  updates: Partial<Pick<LightingSystem, 'name' | 'runway_or_taxiway' | 'is_precision' | 'notes'>>
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('lighting_systems')
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq('id', id)

  return !error
}

// ── Delete a lighting system ──

export async function deleteLightingSystem(id: string): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('lighting_systems')
    .delete()
    .eq('id', id)

  return !error
}

// ── Create a component within a system ──

export async function createSystemComponent(input: {
  system_id: string
  component_type: string
  label: string
  total_count: number
  allowable_outage_pct?: number | null
  allowable_outage_count?: number | null
  allowable_outage_consecutive?: number | null
  allowable_no_adjacent?: boolean
  allowable_outage_text?: string
  is_zero_tolerance?: boolean
  requires_notam?: boolean
  requires_ce_notification?: boolean
  requires_system_shutoff?: boolean
  requires_terps_notification?: boolean
  requires_obstruction_notam_attrs?: boolean
  q_code?: string
  notam_text_template?: string
  sort_order?: number
}): Promise<LightingSystemComponent | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('lighting_system_components')
    .insert({
      system_id: input.system_id,
      component_type: input.component_type,
      label: input.label,
      total_count: input.total_count,
      allowable_outage_pct: input.allowable_outage_pct ?? null,
      allowable_outage_count: input.allowable_outage_count ?? null,
      allowable_outage_consecutive: input.allowable_outage_consecutive ?? null,
      allowable_no_adjacent: input.allowable_no_adjacent ?? false,
      allowable_outage_text: input.allowable_outage_text || null,
      is_zero_tolerance: input.is_zero_tolerance ?? false,
      requires_notam: input.requires_notam ?? true,
      requires_ce_notification: input.requires_ce_notification ?? true,
      requires_system_shutoff: input.requires_system_shutoff ?? false,
      requires_terps_notification: input.requires_terps_notification ?? false,
      requires_obstruction_notam_attrs: input.requires_obstruction_notam_attrs ?? false,
      q_code: input.q_code || null,
      notam_text_template: input.notam_text_template || null,
      sort_order: input.sort_order ?? 0,
    } as any)
    .select('*')
    .single()

  if (error) return null
  return data as LightingSystemComponent
}

// ── Update a component ──

export async function updateSystemComponent(
  id: string,
  updates: Partial<Omit<LightingSystemComponent, 'id' | 'system_id' | 'created_at'>>
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('lighting_system_components')
    .update(updates as any)
    .eq('id', id)

  return !error
}

// ── Delete a component ──

export async function deleteSystemComponent(id: string): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('lighting_system_components')
    .delete()
    .eq('id', id)

  return !error
}

// ── Fetch outage rule templates (for system setup cloning) ──

export async function fetchOutageRuleTemplates(systemType?: string): Promise<OutageRuleTemplate[]> {
  const supabase = createClient()
  if (!supabase) return []

  let query = supabase
    .from('outage_rule_templates')
    .select('*')
    .order('system_type')
    .order('sort_order')

  if (systemType) {
    query = query.eq('system_type', systemType)
  }

  const { data, error } = await query
  if (error) return []
  return data as OutageRuleTemplate[]
}

// ── Clone components from templates into a system ──

export async function cloneComponentsFromTemplates(
  systemId: string,
  systemType: string,
  totalCounts: Record<string, number>  // component_type → total_count
): Promise<LightingSystemComponent[]> {
  const templates = await fetchOutageRuleTemplates(systemType)
  if (templates.length === 0) return []

  const created: LightingSystemComponent[] = []
  for (const t of templates) {
    const comp = await createSystemComponent({
      system_id: systemId,
      component_type: t.component_type,
      label: t.label,
      total_count: totalCounts[t.component_type] || 0,
      allowable_outage_pct: t.allowable_outage_pct,
      allowable_outage_count: t.allowable_outage_count,
      allowable_outage_consecutive: t.allowable_outage_consecutive,
      allowable_no_adjacent: t.allowable_no_adjacent,
      allowable_outage_text: t.allowable_outage_text || undefined,
      is_zero_tolerance: t.is_zero_tolerance,
      requires_notam: t.requires_notam,
      requires_ce_notification: t.requires_ce_notification,
      requires_system_shutoff: t.requires_system_shutoff,
      requires_terps_notification: t.requires_terps_notification,
      requires_obstruction_notam_attrs: t.requires_obstruction_notam_attrs,
      q_code: t.q_code || undefined,
      notam_text_template: t.notam_text_template || undefined,
      sort_order: t.sort_order,
    })
    if (comp) created.push(comp)
  }

  return created
}
