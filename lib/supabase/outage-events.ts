import { createClient } from './client'
import type { OutageEvent } from './types'

// ── Enriched outage event for timeline display ──

export type EnrichedOutageEvent = OutageEvent & {
  reporter_name: string
  reporter_rank: string | null
  feature_label: string | null
  feature_type: string | null
}

export async function fetchOutageEventsForBase(baseId: string, limit = 20): Promise<EnrichedOutageEvent[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('outage_events')
    .select('*, profiles:reported_by(name, rank), infrastructure_features:feature_id(label, feature_type)')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as OutageEvent),
    reporter_name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
    reporter_rank: (row.profiles as { rank?: string } | null)?.rank || null,
    feature_label: (row.infrastructure_features as { label?: string } | null)?.label || null,
    feature_type: (row.infrastructure_features as { feature_type?: string } | null)?.feature_type || null,
  })) as EnrichedOutageEvent[]
}

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
