import { createClient } from './client'
import type { TemplateCategory } from '@/lib/activity-templates'

/**
 * Load custom activity templates for an installation.
 * Returns null if no custom templates are saved (use hardcoded defaults).
 */
export async function loadCustomActivityTemplates(
  baseId: string
): Promise<TemplateCategory[] | null> {
  const supabase = createClient()
  if (!supabase) return null

  try {
    const { data, error } = await (supabase
      .from('bases')
      .select('*')
      .eq('id', baseId)
      .single() as any)

    if (error || !data?.activity_templates) return null

    return data.activity_templates as TemplateCategory[]
  } catch {
    return null
  }
}

/**
 * Save custom activity templates for an installation.
 * Pass null to reset to defaults.
 */
export async function saveCustomActivityTemplates(
  baseId: string,
  templates: TemplateCategory[] | null
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await (supabase
    .from('bases')
    .update({ activity_templates: templates } as any)
    .eq('id', baseId) as any)

  if (error) return { error: error.message }
  return { error: null }
}
