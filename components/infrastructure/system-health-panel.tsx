'use client'

import { useState, useMemo } from 'react'
import type { SystemHealth, AlertTier } from '@/lib/outage-rules'
import { getAlertTier, ALERT_TIER_CONFIG } from '@/lib/outage-rules'
import type { EnrichedOutageEvent } from '@/lib/supabase/outage-events'
import { formatZuluDateTime } from '@/lib/utils'

// ── Category definitions ──

type CategoryKey = 'runway' | 'taxiway' | 'approach' | 'signage' | 'other'

const CATEGORY_CONFIG: Record<CategoryKey, { label: string; systemTypes: string[] }> = {
  runway: {
    label: 'Runway',
    systemTypes: [
      'threshold', 'end_lights', 'runway_edge', 'runway_centerline', 'tdz',
      'rdr_signs', 'reil', 'elevated_guard', 'inpavement_guard', 'stop_bar',
    ],
  },
  taxiway: {
    label: 'Taxiways',
    systemTypes: ['taxiway_edge', 'taxiway_centerline', 'taxiway_end', 'clearance_bar'],
  },
  approach: {
    label: 'Approach',
    systemTypes: ['alsf1', 'alsf2', 'ssalr', 'malsr', 'sals', 'eals', 'papi', 'chapi'],
  },
  signage: {
    label: 'Signage',
    systemTypes: ['signage'],
  },
  other: {
    label: 'Other',
    systemTypes: ['beacon', 'obstruction_fixed', 'hazard_flashing', 'hazard_rotating', 'windcone', 'stadium_light'],
  },
}

const CATEGORY_ORDER: CategoryKey[] = ['runway', 'taxiway', 'approach', 'signage', 'other']

type CategorySummary = {
  key: CategoryKey
  label: string
  systems: SystemHealth[]
  totalFeatures: number
  inopFeatures: number
  worstTier: AlertTier
  worstStatus: string
  exceededCount: number
  approachingCount: number
}

// ── Status colors ──

const TIER_COLORS: Record<AlertTier, string> = {
  green: '#22C55E',
  yellow: '#F59E0B',
  red: '#EF4444',
  black: '#EF4444',
}

// ── Category card ──

function CategoryCard({ category }: { category: CategorySummary }) {
  const [expanded, setExpanded] = useState(false)
  const tierColor = TIER_COLORS[category.worstTier]
  const hasIssues = category.inopFeatures > 0

  return (
    <div
      style={{
        background: 'var(--color-surface-1)',
        border: `1px solid ${hasIssues ? tierColor + '40' : 'var(--color-border)'}`,
        borderRadius: 10,
        overflow: 'hidden',
        flex: '1 1 0',
        minWidth: 140,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 10px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          gap: 6,
        }}
      >
        {/* Status dot */}
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: tierColor,
            boxShadow: hasIssues ? `0 0 8px ${tierColor}60` : 'none',
          }}
        />
        {/* Category label */}
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
          {category.label}
        </span>
        {/* Only show count when there are issues */}
        {hasIssues && (
          <span style={{ fontSize: 'var(--fs-xs)', color: tierColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {category.inopFeatures} inop
          </span>
        )}
      </button>

      {/* Expanded detail — system-level only */}
      {expanded && category.systems.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)', padding: '6px 8px 8px' }}>
          {category.systems.map(sys => {
            const tier = getAlertTier(sys)
            const sysColor = TIER_COLORS[tier]
            return (
              <div key={sys.systemId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 'var(--fs-xs)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sysColor, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600, color: 'var(--color-text-1)' }}>{sys.systemName}</span>
                {sys.inoperativeFeatures > 0 && (
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: sysColor, fontWeight: 600 }}>
                    {sys.inoperativeFeatures} inop
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ──

export default function SystemHealthPanel({
  healths,
  loading,
  outageEvents,
}: {
  healths: SystemHealth[]
  loading?: boolean
  compact?: boolean
  outageEvents?: EnrichedOutageEvent[]
}) {
  const [activityExpanded, setActivityExpanded] = useState(false)

  // Build category summaries
  const categories = useMemo(() => {
    const typeToCategory = new Map<string, CategoryKey>()
    for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
      for (const t of cfg.systemTypes) typeToCategory.set(t, key as CategoryKey)
    }

    const catMap: Record<CategoryKey, CategorySummary> = {} as any
    for (const key of CATEGORY_ORDER) {
      catMap[key] = {
        key,
        label: CATEGORY_CONFIG[key].label,
        systems: [],
        totalFeatures: 0,
        inopFeatures: 0,
        worstTier: 'green',
        worstStatus: 'operational',
        exceededCount: 0,
        approachingCount: 0,
      }
    }

    const tierRank: Record<AlertTier, number> = { green: 0, yellow: 1, red: 2, black: 3 }

    for (const h of healths) {
      const catKey = typeToCategory.get(h.systemType) || 'other'
      const cat = catMap[catKey]
      cat.systems.push(h)
      cat.totalFeatures += h.totalFeatures
      cat.inopFeatures += h.inoperativeFeatures
      cat.exceededCount += h.exceededComponents.length
      cat.approachingCount += h.approachingComponents.length
      const tier = getAlertTier(h)
      if (tierRank[tier] > tierRank[cat.worstTier]) {
        cat.worstTier = tier
        cat.worstStatus = h.status
      }
    }

    // Only return categories that have systems
    return CATEGORY_ORDER.map(k => catMap[k]).filter(c => c.systems.length > 0)
  }, [healths])

  if (loading) {
    return (
      <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
        <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading lighting system status...</div>
      </div>
    )
  }

  if (healths.length === 0) {
    return (
      <div style={{ background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
        <div style={{ fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4, fontSize: 'var(--fs-md)' }}>LIGHTING SYSTEM STATUS</div>
        <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          No lighting systems configured. Set up systems in Base Configuration.
        </div>
      </div>
    )
  }

  const totalInop = healths.reduce((s, h) => s + h.inoperativeFeatures, 0)
  const totalFeatures = healths.reduce((s, h) => s + h.totalFeatures, 0)

  return (
    <div>
      {/* Summary header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', flex: 1 }}>
          LIGHTING STATUS
        </span>
        {totalInop > 0 && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: 4 }}>
            {totalInop} INOP
          </span>
        )}
      </div>

      {/* Category cards */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <CategoryCard key={cat.key} category={cat} />
        ))}
      </div>

      {/* Recent Activity */}
      {outageEvents && outageEvents.length > 0 && (
        <div style={{ marginTop: 8, background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
          <button
            onClick={() => setActivityExpanded(!activityExpanded)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-2)', flex: 1 }}>
              Recent Activity ({outageEvents.length})
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', transform: activityExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
              {'\u25BC'}
            </span>
          </button>
          {activityExpanded && (
            <div style={{ padding: '0 12px 10px' }}>
              {outageEvents.map((evt) => {
                const isResolved = evt.event_type === 'resolved'
                const label = evt.feature_label || evt.feature_type || 'Unknown feature'
                const name = evt.reporter_rank ? `${evt.reporter_rank} ${evt.reporter_name}` : evt.reporter_name
                return (
                  <div
                    key={evt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '4px 0',
                      fontSize: 'var(--fs-xs)',
                      borderBottom: '1px solid rgba(148,163,184,0.08)',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: isResolved ? '#22C55E' : '#EF4444', flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--color-text-2)', fontWeight: 600 }}>
                        {label}
                        <span style={{ fontWeight: 400, color: isResolved ? '#22C55E' : '#EF4444', marginLeft: 6 }}>
                          {isResolved ? 'Resolved' : 'Reported'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--color-text-3)' }}>
                        {formatZuluDateTime(new Date(evt.created_at))} &mdash; {name}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
