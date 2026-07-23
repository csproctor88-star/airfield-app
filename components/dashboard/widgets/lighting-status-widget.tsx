'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { getLightingCompliance } from '@/lib/airport-mode'
import SystemHealthPanel from '@/components/infrastructure/system-health-panel'
import { fetchLightingSystems, fetchAllComponentsForBase } from '@/lib/supabase/lighting-systems'
import { fetchInfrastructureFeatures } from '@/lib/supabase/infrastructure-features'
import { fetchOutageEventsForBase, type EnrichedOutageEvent } from '@/lib/supabase/outage-events'
import { calculateAllSystemHealth, type SystemHealth } from '@/lib/outage-rules'
import type { LightingSystemComponent } from '@/lib/supabase/types'
import type { WidgetProps } from '@/lib/dashboard/widget-registry'

// Airfield-wide lighting status — the same category roll-up (Runway / Taxiway /
// Approach / Signage / Other) shown atop the Visual NAVAIDs page, as a widget
// for the top of a lighting dashboard. Reuses SystemHealthPanel so it always
// matches the infrastructure page.
export function LightingStatusWidget(_props: WidgetProps) {
  const { installationId, currentInstallation } = useInstallation()
  const lightingStandard = getLightingCompliance(currentInstallation).standard
  const [healths, setHealths] = useState<SystemHealth[]>([])
  const [events, setEvents] = useState<EnrichedOutageEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchLightingSystems(installationId),
      fetchAllComponentsForBase(installationId),
      fetchInfrastructureFeatures(installationId),
      fetchOutageEventsForBase(installationId),
    ])
      .then(([systems, components, features, outageEvents]) => {
        if (cancelled) return
        const bySystem = new Map<string, LightingSystemComponent[]>()
        for (const c of components) {
          const arr = bySystem.get(c.system_id) ?? []
          arr.push(c)
          bySystem.set(c.system_id, arr)
        }
        setHealths(calculateAllSystemHealth(systems, bySystem, features, lightingStandard))
        setEvents(outageEvents)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [installationId, lightingStandard])

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <SystemHealthPanel healths={healths} loading={loading} outageEvents={events} hideHeader />
    </div>
  )
}
