'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import {
  fetchLightingSystems,
  fetchAllComponentsForBase,
} from '@/lib/supabase/lighting-systems'
import { fetchInfrastructureFeatures, formatFeatureType } from '@/lib/supabase/infrastructure-features'
import {
  calculateSystemHealth,
  getAlertTier,
  ALERT_TIER_CONFIG,
  SYSTEM_TYPE_LABELS,
  type AlertTier,
  type OutageStatus,
} from '@/lib/outage-rules'
import { listAreas, systemsForArea } from '@/lib/infrastructure/areas'
import type { LightingSystem, LightingSystemComponent, InfrastructureFeature } from '@/lib/supabase/types'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type LightingScope = 'area' | 'system' | 'type'

const TIER_RANK: Record<AlertTier, number> = { green: 0, yellow: 1, red: 2, black: 3 }

/** Worst (highest-rank) tier across a list, defaulting to green. */
function worstTier(tiers: AlertTier[]): AlertTier {
  let worst: AlertTier = 'green'
  for (const t of tiers) {
    if (TIER_RANK[t] > TIER_RANK[worst]) worst = t
  }
  return worst
}

function TierDot({ tier }: { tier: AlertTier }) {
  return (
    <span style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
      background: ALERT_TIER_CONFIG[tier].color,
    }} />
  )
}

/** Small colored badge for a component / system tier. */
function TierBadge({ tier, label }: { tier: AlertTier; label: string }) {
  const cfg = ALERT_TIER_CONFIG[tier]
  return (
    <span style={{
      flexShrink: 0, fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '1px 6px',
      borderRadius: 999, color: cfg.color, background: cfg.bg,
      fontFamily: 'var(--font-family-mono)', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

/** Tier for a single component row (red exceeded, yellow approaching, else green). */
function componentTier(c: OutageStatus): AlertTier {
  if (c.isExceeded) return 'red'
  if (c.isApproaching) return 'yellow'
  return 'green'
}

/** Action tags for an exceeded component: requiredActions if any, else derived flags. */
function actionTags(c: OutageStatus): string[] {
  const ra = c.requiredActions
  const tags: string[] = []
  if (ra) {
    if (ra.notam) tags.push('NOTAM')
    if (ra.notifyCE) tags.push('Notify CE')
    if (ra.systemShutoff) tags.push('Shut off')
    if (ra.notifyTerps) tags.push('TERPS')
  }
  return tags
}

export function LightingWidget(props: WidgetProps) {
  const { installationId } = useInstallation()

  const scope = (props.config.scope as LightingScope) ?? 'area'
  const value = props.config.value as string | undefined

  const [systems, setSystems] = useState<LightingSystem[]>([])
  const [components, setComponents] = useState<LightingSystemComponent[]>([])
  const [features, setFeatures] = useState<InfrastructureFeature[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchLightingSystems(installationId),
      fetchAllComponentsForBase(installationId),
      fetchInfrastructureFeatures(installationId),
    ])
      .then(([sys, comps, feats]) => {
        if (cancelled) return
        setSystems(sys)
        setComponents(comps)
        setFeatures(feats)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [installationId, scope, value])

  // Systems selected by the configured scope.
  const selectedSystems = useMemo<LightingSystem[]>(() => {
    if (!value) return []
    if (scope === 'area') return systemsForArea(systems, value)
    if (scope === 'system') return systems.filter(s => s.id === value)
    if (scope === 'type') return systems.filter(s => s.system_type === value)
    return []
  }, [systems, scope, value])

  // Per-system health + tier + its source components, in sort order.
  const systemRows = useMemo(() => {
    return selectedSystems
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(s => {
        const comps = components.filter(c => c.system_id === s.id)
        const health = calculateSystemHealth(s, comps, features)
        return { system: s, health, tier: getAlertTier(health) }
      })
  }, [selectedSystems, components, features])

  // Inoperative features across the selected systems' components.
  const inopFeatures = useMemo(() => {
    const set = new Set<string>()
    for (const s of selectedSystems) {
      for (const c of components.filter(cc => cc.system_id === s.id)) set.add(c.id)
    }
    return features.filter(f => f.status === 'inoperative' && f.system_component_id && set.has(f.system_component_id))
  }, [selectedSystems, components, features])

  const overallTier = worstTier(systemRows.map(r => r.tier))

  const labelStyle = { fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' } as const

  function renderBody() {
    if (loading) return <div style={labelStyle}>…</div>
    if (!value) return <div style={labelStyle}>Choose a scope in this widget&apos;s settings.</div>
    if (systemRows.length === 0) return <div style={labelStyle}>No lighting systems for this selection.</div>

    const anyDirty = inopFeatures.length > 0 ||
      systemRows.some(r => r.health.exceededComponents.length > 0 || r.health.approachingComponents.length > 0)

    return (
      <>
        {!anyDirty && (
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: ALERT_TIER_CONFIG.green.color, padding: '2px 0 6px',
          }}>
            All operational
          </div>
        )}
        {systemRows.map(({ system, health, tier }) => (
          <div key={system.id} style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {system.name}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <TierBadge tier={tier} label={ALERT_TIER_CONFIG[tier].label} />
              </span>
            </div>
            {health.components.map(c => {
              const cTier = componentTier(c)
              const countText = c.totalBars && c.totalBars > 0
                ? `${c.barsOut ?? 0}/${c.totalBars} bars`
                : `${c.inoperativeCount}/${c.totalCount}`
              const tags = c.isExceeded ? actionTags(c) : []
              return (
                <div key={c.componentId} style={{ padding: '2px 0 3px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)',
                    color: 'var(--color-text-2)',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.componentLabel}
                    </span>
                    <span style={{
                      marginLeft: 'auto', flexShrink: 0, fontFamily: 'var(--font-family-mono)',
                      fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)',
                    }}>
                      {countText} · {c.outagePct}%
                    </span>
                    <TierBadge tier={cTier} label={ALERT_TIER_CONFIG[cTier].label} />
                  </div>
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 0 0' }}>
                      {tags.map(t => (
                        <span key={t} style={{
                          fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                          color: ALERT_TIER_CONFIG.yellow.color, background: ALERT_TIER_CONFIG.yellow.bg,
                          border: `1px solid ${ALERT_TIER_CONFIG.yellow.color}`,
                        }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </>
    )
  }

  // Footer: list of inoperative feature ids (labels), truncated.
  const footerIds = inopFeatures.slice(0, 12)
    .map(f => f.label ?? f.block ?? formatFeatureType(f.feature_type))
    .join(', ')
  const moreCount = Math.max(0, inopFeatures.length - 12)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary line */}
      {!loading && value && systemRows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <TierDot tier={overallTier} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>
            {selectedSystems.length} system{selectedSystems.length === 1 ? '' : 's'} · {inopFeatures.length} light{inopFeatures.length === 1 ? '' : 's'} out
          </span>
        </div>
      )}

      {/* Scrollable middle */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderBody()}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)',
        display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center',
      }}>
        <span style={{
          fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {footerIds}{moreCount > 0 ? ` +${moreCount} more` : ''}
        </span>
        <Link href="/infrastructure" style={{
          flexShrink: 0, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none',
        }}>
          View infra →
        </Link>
      </div>
    </div>
  )
}

export function LightingConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const { installationId } = useInstallation()

  const [systems, setSystems] = useState<LightingSystem[]>([])
  const [title, setTitle] = useState((config.title as string) ?? '')
  const [scope, setScope] = useState<LightingScope>((config.scope as LightingScope) ?? 'area')
  const [value, setValue] = useState<string | undefined>(config.value as string | undefined)

  useEffect(() => {
    if (!installationId) {
      setSystems([])
      return
    }
    let cancelled = false
    fetchLightingSystems(installationId).then(data => {
      if (!cancelled) setSystems(data)
    })
    return () => {
      cancelled = true
    }
  }, [installationId])

  // Options for the current scope.
  const options = useMemo<{ value: string; label: string }[]>(() => {
    if (scope === 'area') {
      return listAreas(systems).map(a => ({ value: a, label: a }))
    }
    if (scope === 'system') {
      return systems.map(s => {
        const typeLabel = SYSTEM_TYPE_LABELS[s.system_type] ?? s.system_type
        return { value: s.id, label: s.name !== typeLabel ? `${s.name} (${typeLabel})` : s.name }
      })
    }
    // type
    const seen = new Set<string>()
    const out: { value: string; label: string }[] = []
    for (const s of systems) {
      if (seen.has(s.system_type)) continue
      seen.add(s.system_type)
      out.push({ value: s.system_type, label: SYSTEM_TYPE_LABELS[s.system_type] ?? s.system_type })
    }
    return out
  }, [scope, systems])

  function handleScopeChange(next: LightingScope) {
    setScope(next)
    // Reset value to the first option of the new scope so it's never stale across scopes.
    if (next === 'area') {
      const areas = listAreas(systems)
      setValue(areas[0])
    } else if (next === 'system') {
      setValue(systems[0]?.id)
    } else {
      const firstType = systems.find(s => s.system_type)?.system_type
      setValue(firstType)
    }
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = {
    fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
  }

  const scopeButtons: { value: LightingScope; label: string }[] = [
    { value: 'area', label: 'Area' },
    { value: 'system', label: 'System' },
    { value: 'type', label: 'Type' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={label}>Title</span>
        <input style={input} placeholder="Widget title (optional)" value={title}
          onChange={e => setTitle(e.target.value)} />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={label}>Scope</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {scopeButtons.map(b => {
            const active = scope === b.value
            return (
              <button key={b.value} type="button" onClick={() => handleScopeChange(b.value)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--fs-sm)',
                  border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  background: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-2)',
                }}>
                {b.label}
              </button>
            )
          })}
        </div>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={label}>{scope === 'area' ? 'Area' : scope === 'system' ? 'System' : 'System Type'}</span>
        <select style={input} value={value ?? ''} onChange={e => setValue(e.target.value)}>
          {options.length === 0 && <option value="">No options</option>}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ ...config, title: title.trim() || undefined, scope, value })}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
