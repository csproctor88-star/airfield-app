import { createClient } from './client'
import type { InspectionSection } from '@/lib/constants'

// ── Types ──

export interface TemplateSection {
  id: string
  template_id: string
  section_id: string
  title: string
  guidance: string | null
  conditional: string | null
  sort_order: number
  items: TemplateItem[]
}

export interface TemplateItem {
  id: string
  section_id: string
  item_key: string
  item_number: number
  item_text: string
  item_type: 'pass_fail' | 'bwc'
  sort_order: number
}

// ── Fetch template sections + items for a base ──

export async function fetchInspectionTemplate(
  baseId: string,
  templateType: 'airfield' | 'lighting'
): Promise<TemplateSection[]> {
  const supabase = createClient()
  if (!supabase) return []

  // Find the template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tmpl, error: tmplErr } = await (supabase as any)
    .from('base_inspection_templates')
    .select('id')
    .eq('base_id', baseId)
    .eq('template_type', templateType)
    .single()

  if (tmplErr || !tmpl) return []

  // Fetch sections
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sections, error: secErr } = await (supabase as any)
    .from('base_inspection_sections')
    .select('*')
    .eq('template_id', tmpl.id)
    .order('sort_order')

  if (secErr || !sections) return []

  // Fetch all items for these sections
  const sectionIds = sections.map((s: { id: string }) => s.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items, error: itemErr } = await (supabase as any)
    .from('base_inspection_items')
    .select('*')
    .in('section_id', sectionIds)
    .order('sort_order')

  if (itemErr) return []

  // Group items by section
  const itemsBySection: Record<string, TemplateItem[]> = {}
  for (const item of (items ?? [])) {
    if (!itemsBySection[item.section_id]) itemsBySection[item.section_id] = []
    itemsBySection[item.section_id].push(item as TemplateItem)
  }

  return sections.map((s: Record<string, unknown>) => ({
    ...s,
    items: itemsBySection[s.id as string] ?? [],
  })) as TemplateSection[]
}

// ── Convert DB template sections to the InspectionSection format used by the UI ──

export function toInspectionSections(templateSections: TemplateSection[]): InspectionSection[] {
  return templateSections.map(s => ({
    id: s.section_id,
    title: s.title,
    guidance: s.guidance ?? undefined,
    conditional: s.conditional ?? undefined,
    items: s.items.map(i => ({
      id: i.item_key,
      itemNumber: i.item_number,
      item: i.item_text,
      type: i.item_type === 'bwc' ? 'bwc' as const : undefined,
    })),
  }))
}

// ── Create default template for a new base (clone from any existing template) ──

export async function createDefaultTemplate(
  baseId: string,
  templateType: 'airfield' | 'lighting',
  sourceBaseId?: string
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  // If no source specified, find any base that has this template type
  let resolvedSourceId = sourceBaseId
  if (!resolvedSourceId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('base_inspection_templates')
      .select('base_id')
      .eq('template_type', templateType)
      .neq('base_id', baseId)
      .limit(1)
      .single()
    if (!existing) return false
    resolvedSourceId = existing.base_id as string
  }

  // Fetch source template
  const sourceSections = await fetchInspectionTemplate(resolvedSourceId, templateType)
  if (sourceSections.length === 0) return false

  // Create new template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newTmpl, error: tmplErr } = await (supabase as any)
    .from('base_inspection_templates')
    .insert({ base_id: baseId, template_type: templateType })
    .select('id')
    .single()

  if (tmplErr || !newTmpl) return false

  // Clone sections and items
  for (const section of sourceSections) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newSec, error: secErr } = await (supabase as any)
      .from('base_inspection_sections')
      .insert({
        template_id: newTmpl.id,
        section_id: section.section_id,
        title: section.title,
        guidance: section.guidance,
        conditional: section.conditional,
        sort_order: section.sort_order,
      })
      .select('id')
      .single()

    if (secErr || !newSec) continue

    if (section.items.length > 0) {
      const itemInserts = section.items.map(i => ({
        section_id: newSec.id,
        item_key: i.item_key,
        item_number: i.item_number,
        item_text: i.item_text,
        item_type: i.item_type,
        sort_order: i.sort_order,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('base_inspection_items').insert(itemInserts)
    }
  }

  return true
}

// ── Update a single item ──

export async function updateTemplateItem(
  itemId: string,
  updates: { item_text?: string; item_type?: 'pass_fail' | 'bwc'; item_number?: number }
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('base_inspection_items')
    .update(updates)
    .eq('id', itemId)

  return !error
}

// ── Add item to a section ──

export async function addTemplateItem(
  sectionId: string,
  item: { item_key: string; item_number: number; item_text: string; item_type?: 'pass_fail' | 'bwc'; sort_order: number }
): Promise<TemplateItem | null> {
  const supabase = createClient()
  if (!supabase) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_inspection_items')
    .insert({ section_id: sectionId, ...item, item_type: item.item_type ?? 'pass_fail' })
    .select('*')
    .single()

  if (error) return null
  return data as TemplateItem
}

// ── Delete an item ──

export async function deleteTemplateItem(itemId: string): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('base_inspection_items')
    .delete()
    .eq('id', itemId)

  return !error
}

// ── Add a section to a template ──

export async function addTemplateSection(
  baseId: string,
  templateType: 'airfield' | 'lighting',
  section: { section_id: string; title: string; guidance?: string; conditional?: string; sort_order: number }
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null

  // Find template
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tmpl } = await (supabase as any)
    .from('base_inspection_templates')
    .select('id')
    .eq('base_id', baseId)
    .eq('template_type', templateType)
    .single()

  if (!tmpl) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('base_inspection_sections')
    .insert({ template_id: tmpl.id, ...section })
    .select('id')
    .single()

  if (error) return null
  return data.id as string
}

// ── Delete a section (cascades items) ──

export async function deleteTemplateSection(sectionId: string): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('base_inspection_sections')
    .delete()
    .eq('id', sectionId)

  return !error
}

// ── Update section title/guidance ──

export async function updateTemplateSection(
  sectionId: string,
  updates: { title?: string; guidance?: string; conditional?: string }
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('base_inspection_sections')
    .update(updates)
    .eq('id', sectionId)

  return !error
}

// ── Reorder items within a section (also renumbers item_number sequentially) ──

export async function reorderTemplateItems(
  items: { id: string; sort_order: number; item_number: number }[]
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('base_inspection_items')
      .update({ sort_order: item.sort_order, item_number: item.item_number })
      .eq('id', item.id)
    if (error) return false
  }

  return true
}

// ── Reorder sections within a template ──

export async function reorderTemplateSections(
  sections: { id: string; sort_order: number }[]
): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  for (const section of sections) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('base_inspection_sections')
      .update({ sort_order: section.sort_order })
      .eq('id', section.id)
    if (error) return false
  }

  return true
}
