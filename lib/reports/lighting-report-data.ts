import { fetchLightingSystems, fetchAllComponentsForBase } from '@/lib/supabase/lighting-systems'
import { fetchInfrastructureFeatures } from '@/lib/supabase/infrastructure-features'
import { calculateAllSystemHealth, type SystemHealth } from '@/lib/outage-rules'
import { fetchOutageEventsForBase, type EnrichedOutageEvent } from '@/lib/supabase/outage-events'

export type LightingReportData = {
  totalFeatures: number
  totalInoperative: number
  systemHealths: SystemHealth[]
  featuresByType: Record<string, { total: number; inop: number }>
  featuresByLayer: Record<string, { total: number; inop: number }>
  recentOutageEvents: EnrichedOutageEvent[]
}

export async function fetchLightingReportData(installationId: string | null): Promise<LightingReportData> {
  if (!installationId) {
    return {
      totalFeatures: 0,
      totalInoperative: 0,
      systemHealths: [],
      featuresByType: {},
      featuresByLayer: {},
      recentOutageEvents: [],
    }
  }

  const [systems, components, features, recentOutageEvents] = await Promise.all([
    fetchLightingSystems(installationId),
    fetchAllComponentsForBase(installationId),
    fetchInfrastructureFeatures(installationId),
    fetchOutageEventsForBase(installationId, 50),
  ])

  // Build componentsBySystem map
  const componentsBySystem = new Map<string, typeof components>()
  for (const comp of components) {
    const list = componentsBySystem.get(comp.system_id) || []
    list.push(comp)
    componentsBySystem.set(comp.system_id, list)
  }

  const systemHealths = calculateAllSystemHealth(systems, componentsBySystem, features)

  // Build featuresByType
  const featuresByType: Record<string, { total: number; inop: number }> = {}
  for (const f of features) {
    if (!featuresByType[f.feature_type]) {
      featuresByType[f.feature_type] = { total: 0, inop: 0 }
    }
    featuresByType[f.feature_type].total++
    if (f.status === 'inoperative') {
      featuresByType[f.feature_type].inop++
    }
  }

  // Build featuresByLayer
  const featuresByLayer: Record<string, { total: number; inop: number }> = {}
  for (const f of features) {
    const layer = f.layer || 'Unassigned'
    if (!featuresByLayer[layer]) {
      featuresByLayer[layer] = { total: 0, inop: 0 }
    }
    featuresByLayer[layer].total++
    if (f.status === 'inoperative') {
      featuresByLayer[layer].inop++
    }
  }

  const totalFeatures = features.length
  const totalInoperative = features.filter((f) => f.status === 'inoperative').length

  return {
    totalFeatures,
    totalInoperative,
    systemHealths,
    featuresByType,
    featuresByLayer,
    recentOutageEvents,
  }
}
