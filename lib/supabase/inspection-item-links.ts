import { createClient } from './client'

// ── Link shape: system_id + optional component_id ──

export type ItemLink = {
  system_id: string
  component_id: string | null
}

// ── Fetch all system/component links for a template (by template ID) ──
// Returns a map: itemId → ItemLink[]

export async function fetchLinksForTemplate(
  templateId: string
): Promise<Record<string, ItemLink[]>> {
  const supabase = createClient()
  if (!supabase) return {}

  // Get all section IDs for this template
  const { data: sections, error: secErr } = await supabase
    .from('base_inspection_sections')
    .select('id')
    .eq('template_id', templateId)

  if (secErr || !sections || sections.length === 0) return {}

  const sectionIds = (sections as { id: string }[]).map(s => s.id)

  // Get all item IDs for these sections
  const { data: items, error: itemErr } = await supabase
    .from('base_inspection_items')
    .select('id')
    .in('section_id', sectionIds)

  if (itemErr || !items || items.length === 0) return {}

  const itemIds = (items as { id: string }[]).map(i => i.id)

  // Fetch links for these items
  const { data: links, error: linkErr } = await supabase
    .from('inspection_item_system_links')
    .select('item_id, system_id, component_id')
    .in('item_id', itemIds)

  if (linkErr || !links) return {}

  const result: Record<string, ItemLink[]> = {}
  for (const link of links as unknown as { item_id: string; system_id: string; component_id: string | null }[]) {
    if (!result[link.item_id]) result[link.item_id] = []
    result[link.item_id].push({ system_id: link.system_id, component_id: link.component_id })
  }
  return result
}

// ── Convenience: extract just system IDs from links (for backward compat) ──

export function systemIdsFromLinks(links: ItemLink[]): string[] {
  return [...new Set(links.map(l => l.system_id))]
}

// ── Convenience: extract component IDs from links (null-filtered) ──

export function componentIdsFromLinks(links: ItemLink[]): string[] {
  return links.map(l => l.component_id).filter((id): id is string => id !== null)
}

// ── Fetch template ID for a base + type ──

export async function fetchTemplateId(
  baseId: string,
  templateType: 'airfield' | 'lighting'
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('base_inspection_templates')
    .select('id')
    .eq('base_id', baseId)
    .eq('template_type', templateType)
    .single()

  if (error || !data) return null
  return (data as { id: string }).id
}

// ── Set links for a single item (delete existing + insert new) ──

export async function setLinksForItem(
  itemId: string,
  links: ItemLink[]
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  // Delete existing links for this item
  const { error: delErr } = await supabase
    .from('inspection_item_system_links')
    .delete()
    .eq('item_id', itemId)

  if (delErr) {
    console.error('[setLinksForItem] delete failed:', delErr.message)
    return false
  }

  // Insert new links
  if (links.length === 0) return true

  const rows = links.map(l => ({
    item_id: itemId,
    system_id: l.system_id,
    component_id: l.component_id,
  }))
  const { error: insErr } = await supabase
    .from('inspection_item_system_links')
    .insert(rows as any)

  if (insErr) {
    console.error('[setLinksForItem] insert failed:', insErr.message)
    return false
  }
  return true
}
