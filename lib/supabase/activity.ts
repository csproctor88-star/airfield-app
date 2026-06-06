import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import { resolveBaseId } from './resolve-base-id'

export async function logActivity(
  action: string,
  entity_type: string,
  entity_id: string,
  entity_display_id?: string,
  metadata?: Record<string, unknown>,
  baseId?: string | null,
  createdAt?: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const row: Record<string, unknown> = {
    user_id: user.id,
    action,
    entity_type,
    entity_id,
    entity_display_id: entity_display_id ?? null,
    metadata: metadata ?? {},
  }
  row.base_id = await resolveBaseId(supabase, baseId, user.id)
  // Preserve the originating timestamp when the insert is replayed from
  // the offline queue. Without it, an "AFLD3 off airfield at 14:32Z"
  // entry that drains an hour later would carry the drain timestamp
  // and be misleading on the events log.
  if (createdAt) row.created_at = createdAt

  const { error } = await supabase.from('activity_log').insert(row as never)
  return { error: error ? error.message : null }
}

export async function logManualEntry(text: string, baseId?: string | null, category?: string, templateLabel?: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const row: Record<string, unknown> = {
    user_id: user.id,
    action: 'noted',
    entity_type: 'manual',
    entity_id: crypto.randomUUID(),
    entity_display_id: null,
    metadata: { details: text, ...(category ? { template_category: category } : {}), ...(templateLabel ? { template_label: templateLabel } : {}) },
  }
  row.base_id = await resolveBaseId(supabase, baseId, user.id)

  const { error } = await supabase.from('activity_log').insert(row as never)

  if (error) {
    console.error('Manual activity entry failed:', error.message)
    return { error: friendlyError(error.message) }
  }

  return { error: null }
}

export async function updateActivityEntry(id: string, notes: string, createdAt?: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // Fetch existing metadata to preserve template_label/template_category
  const { data: existing } = await supabase.from('activity_log').select('metadata').eq('id', id).single()
  const existingMeta = (existing?.metadata as Record<string, unknown>) || {}
  const mergedMeta = { ...existingMeta, details: notes }

  const updates: Record<string, unknown> = { metadata: mergedMeta }
  if (createdAt) updates.created_at = createdAt

  const { data, error } = await supabase
    .from('activity_log')
    .update(updates as never)
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('Update activity entry failed:', error.message)
    return { error: friendlyError(error.message) }
  }
  if (!data || data.length === 0) {
    return { error: 'Update failed — permission denied. Run the activity_log RLS migration.' }
  }
  return { error: null }
}

export async function deleteActivityEntry(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('activity_log')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('Delete activity entry failed:', error.message)
    return { error: friendlyError(error.message) }
  }
  if (!data || data.length === 0) {
    return { error: 'Delete failed — row not found or permission denied' }
  }
  return { error: null }
}
