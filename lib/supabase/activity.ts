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
