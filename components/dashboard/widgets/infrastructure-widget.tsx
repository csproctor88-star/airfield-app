'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchInfrastructureFeatures } from '@/lib/supabase/infrastructure-features'
import type { InfrastructureFeature } from '@/lib/supabase/types'

const FEATURE_TYPE_LABEL: Record<string, string> = {
  runway_edge_light: 'Runway Edge Light',
  taxiway_light: 'Taxiway Light',
  taxiway_end_light: 'Taxiway End Light',
  approach_light: 'Approach Light',
  papi: 'PAPI',
  reil: 'REIL',
  windcone: 'Windcone',
  rotating_beacon: 'Rotating Beacon',
  obstruction_light: 'Obstruction Light',
  runway_end_light: 'Runway End Light',
}

function featureLabel(type: string): string {
  return FEATURE_TYPE_LABEL[type] ?? type.replace(/_/g, ' ')
}

export function InfrastructureWidget() {
  const { installationId } = useInstallation()
  const [features, setFeatures] = useState<InfrastructureFeature[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchInfrastructureFeatures(installationId).then((data) => {
      setFeatures(data)
      setLoading(false)
    })
  }, [installationId])

  const inoperative = features.filter((f) => f.status === 'inoperative')
  const operational = features.filter((f) => f.status === 'operational')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inoperative</div>
          <div style={{
            fontSize: 'var(--fs-lg)', fontWeight: 800,
            color: inoperative.length > 0 ? 'var(--color-danger)' : 'var(--color-text-3)',
          }}>
            {loading ? '…' : inoperative.length}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Total</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', textAlign: 'right' }}>
            {loading ? '…' : features.length}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && features.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' }}>No infrastructure features on file.</div>
        )}
        {inoperative.length > 0 && (
          <>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 0 4px' }}>
              Inoperative
            </div>
            {inoperative.slice(0, 8).map((f) => (
              <div key={f.id} style={{
                display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0',
                borderBottom: '1px solid var(--color-border)',
                fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.label ?? featureLabel(f.feature_type)}
                </span>
                <span style={{ flexShrink: 0, fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontFamily: 'var(--font-family-mono)' }}>
                  {f.block ?? f.layer ?? ''}
                </span>
              </div>
            ))}
            {inoperative.length > 8 && (
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', padding: '2px 0' }}>
                +{inoperative.length - 8} more inoperative
              </div>
            )}
          </>
        )}
        {inoperative.length === 0 && !loading && features.length > 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-status-pass)', padding: '4px 0' }}>
            All {operational.length} features operational.
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/infrastructure" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View map →</Link>
      </div>
    </div>
  )
}
