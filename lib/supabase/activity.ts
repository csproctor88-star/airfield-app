import { createClient } from './client'

export async function logActivity(
  action: string,
  entity_type: string,
  entity_id: string,
  entity_display_id?: string,
  metadata?: Record<string, unknown>
) {
  const supabase = createClient()
  if (!supabase) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('activity_log').insert({
    user_id: user.id,
    action,
    entity_type,
    entity_id,
    entity_display_id: entity_display_id ?? null,
    metadata: metadata ?? {},
  })
}
