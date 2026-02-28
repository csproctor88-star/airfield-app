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
    entity_id: null,
    entity_display_id: null,
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
