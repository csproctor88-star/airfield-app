import { createClient } from './client'
import type { OutageEvent } from './types'

// ── Create an outage event ──

export async function createOutageEvent(input: {
  base_id: string
  feature_id: string
  system_component_id?: string | null
  event_type: 'reported' | 'resolved'
  discrepancy_id?: string | null
  notes?: string
}): Promise<OutageEvent | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('outage_events')
    .insert({
      base_id: input.base_id,
      feature_id: input.feature_id,
      system_component_id: input.system_component_id || null,
      event_type: input.event_type,
      reported_by: user?.id || null,
      discrepancy_id: input.discrepancy_id || null,
      notes: input.notes || null,
    } as any)
    .select('*')
    .single()

  if (error) return null
  return data as OutageEvent
}

// ── Fetch outage events for a feature ──

export async function fetchOutageEventsForFeature(featureId: string): Promise<OutageEvent[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('outage_events')
    .select('*')
    .eq('feature_id', featureId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data as OutageEvent[]
}

// ── Fetch recent outage events for a base ──

export async function fetchRecentOutageEvents(baseId: string, limit = 50): Promise<OutageEvent[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('outage_events')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return data as OutageEvent[]
}
