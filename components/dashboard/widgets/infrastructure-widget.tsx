'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { getLightingCompliance } from '@/lib/airport-mode'
import { fetchLightingSystems, fetchLightingSystemWithComponents } from '@/lib/supabase/lighting-systems'
import { fetchInfrastructureFeatures, formatFeatureType } from '@/lib/supabase/infrastructure-features'
import { calculateSystemHealth, SYSTEM_TYPE_LABELS } from '@/lib/outage-rules'
import type { LightingSystem, LightingSystemComponent, InfrastructureFeature } from '@/lib/supabase/types'
import type { WidgetProps } from '@/lib/dashboard/widget-registry'

export function InfrastructureWidget({ config, onConfigChange }: WidgetProps) {
  const { installationId, currentInstallation } = useInstallation()

  const [systems, setSystems] = useState<LightingSystem[]>([])
  const [components, setComponents] = useState<LightingSystemComponent[]>([])
  const [allFeatures, setAllFeatures] = useState<InfrastructureFeature[]>([])
  const [loadingSystems, setLoadingSystems] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Config-persisted system id — defaults to first system (no force-write on init)
  const configSystemId = typeof config.systemId === 'string' ? config.systemId : null

  // The effective selected system id (may be resolved from first system if config is unset)
  const [resolvedSystemId, setResolvedSystemId] = useState<string | null>(configSystemId)

  // Debounce ref for onConfigChange
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load all systems for this base once
  useEffect(() => {
    if (!installationId) return
    setLoadingSystems(true)
    fetchLightingSystems(installationId).then((data) => {
      setSystems(data)
      setLoadingSystems(false)
      // Default to first system if no config set yet — don't persist until user changes
      if (!configSystemId && data.length > 0) {
        setResolvedSystemId(data[0].id)
      } else if (configSystemId) {
        setResolvedSystemId(configSystemId)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId])

  // Load system components + all features whenever resolved system or base changes
  useEffect(() => {
    if (!installationId || !resolvedSystemId) {
      setComponents([])
      setAllFeatures([])
      return
    }
    setLoadingDetail(true)
    Promise.all([
      fetchLightingSystemWithComponents(resolvedSystemId),
      fetchInfrastructureFeatures(installationId),
    ]).then(([systemWithComps, features]) => {
      setComponents(systemWithComps?.components ?? [])
      setAllFeatures(features)
      setLoadingDetail(false)
    })
  }, [installationId, resolvedSystemId])

  const handleSystemChange = useCallback((systemId: string) => {
    setResolvedSystemId(systemId)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onConfigChange?.({ ...config, systemId })
    }, 400)
  }, [config, onConfigChange])

  // Compute derived data
  const selectedSystem = systems.find(s => s.id === resolvedSystemId) ?? null
  const systemHealth = selectedSystem
    ? calculateSystemHealth(selectedSystem, components, allFeatures, getLightingCompliance(currentInstallation).standard)
    : null

  // Filter features belonging to this system's component ids
  const componentIds = new Set(components.map(c => c.id))
  const systemFeatures = allFeatures.filter(
    f => f.system_component_id && componentIds.has(f.system_component_id),
  )
  const inoperativeFeatures = systemFeatures.filter(f => f.status === 'inoperative')

  const totalCount = systemHealth?.totalFeatures ?? systemFeatures.length
  const outageCount = systemHealth?.inoperativeFeatures ?? inoperativeFeatures.length
  const hasOutages = outageCount > 0

  const loading = loadingSystems || loadingDetail

  // System display label: name + system type suffix if different
  function systemLabel(s: LightingSystem): string {
    const typeLabel = SYSTEM_TYPE_LABELS[s.system_type] ?? s.system_type
    return s.name !== typeLabel ? `${s.name} (${typeLabel})` : s.name
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* System selector */}
      {loadingSystems ? (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 8 }}>Loading systems…</div>
      ) : systems.length === 0 ? (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 8 }}>No lighting systems configured.</div>
      ) : (
        <select
          className="input-dark"
          value={resolvedSystemId ?? ''}
          onChange={e => handleSystemChange(e.target.value)}
          style={{ marginBottom: 8, width: '100%' }}
        >
          {systems.map(s => (
            <option key={s.id} value={s.id}>{systemLabel(s)}</option>
          ))}
        </select>
      )}

      {/* Stats row */}
      {selectedSystem && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Lights</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              {loading ? '…' : totalCount}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Outages</div>
            <div style={{
              fontSize: 'var(--fs-lg)', fontWeight: 800, textAlign: 'right',
              color: hasOutages ? 'var(--color-danger)' : 'var(--color-text-3)',
            }}>
              {loading ? '…' : outageCount}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable feature list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' }}>Loading…</div>
        )}
        {!loading && selectedSystem && systemFeatures.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' }}>No lights assigned to this system.</div>
        )}
        {!loading && systemFeatures.length > 0 && (
          <>
            {inoperativeFeatures.length > 0 && (
              <div style={{
                fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-danger)',
                textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 0 4px',
              }}>
                Inoperative
              </div>
            )}
            {systemFeatures.map(f => {
              const isInop = f.status === 'inoperative'
              const displayLabel = f.label ?? formatFeatureType(f.feature_type)
              return (
                <div key={f.id} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: 'var(--fs-sm)',
                  color: isInop ? 'var(--color-danger)' : 'var(--color-text-1)',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayLabel}
                  </span>
                  {isInop && (
                    <span style={{ flexShrink: 0, fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-danger)', fontFamily: 'var(--font-family-mono)' }}>
                      INOP
                    </span>
                  )}
                </div>
              )
            })}
          </>
        )}
        {!loading && !selectedSystem && systems.length > 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' }}>Select a system above.</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/infrastructure" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View map →</Link>
      </div>
    </div>
  )
}
