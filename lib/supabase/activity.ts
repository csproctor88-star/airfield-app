import { createClient } from './client'

export async function logActivity(
  action: string,
  entity_type: string,
  entity_id: string,
  entity_display_id?: string,
  metadata?: Record<string, unknown>,
  baseId?: string | null
) {
  const supabase = createClient()
  if (!supabase) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const row: Record<string, unknown> = {
    user_id: user.id,
    action,
    entity_type,
    entity_id,
    entity_display_id: entity_display_id ?? null,
    metadata: metadata ?? {},
  }
  if (baseId) row.base_id = baseId

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('activity_log').insert(row)
}

export async function logManualEntry(text: string, baseId?: string | null): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const row: Record<string, unknown> = {
    user_id: user.id,
    action: 'noted',
    entity_type: 'manual',
    entity_id: crypto.randomUUID(),
    entity_display_id: 'Manual',
    metadata: { notes: text },
  }
  if (baseId) row.base_id = baseId

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('activity_log').insert(row)

  if (error) {
    console.error('Manual activity entry failed:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

export async function updateActivityEntry(id: string, notes: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any).from('activity_log').select('metadata').eq('id', id).single()
  const currentMeta = (existing?.metadata as Record<string, unknown>) || {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('activity_log')
    .update({ metadata: { ...currentMeta, notes } })
    .eq('id', id)

  if (error) {
    console.error('Update activity entry failed:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export async function deleteActivityEntry(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('activity_log')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('Delete activity entry failed:', error.message)
    return { error: error.message }
  }
  if (!data || data.length === 0) {
    return { error: 'Delete failed — row not found or permission denied' }
  }
  return { error: null }
}
