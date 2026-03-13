'use client'

import { useState } from 'react'
import type { SystemHealth, OutageStatus, AlertTier } from '@/lib/outage-rules'
import { getAlertTier, ALERT_TIER_CONFIG, DAFMAN_NOTES } from '@/lib/outage-rules'
import type { EnrichedOutageEvent } from '@/lib/supabase/outage-events'
import { formatZuluDateTime } from '@/lib/utils'

// ── Status badge colors ──

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  operational: { color: '#22C55E', bg: 'rgba(34,197,94,0.12)', label: 'OPERATIONAL' },
  degraded: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'DEGRADED' },
  exceeded: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'EXCEEDED' },
  inoperative: { color: '#EF4444', bg: 'rgba(239,68,68,0.2)', label: 'INOPERATIVE' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.operational
  return (
    <span
      style={{
        fontSize: 'var(--fs-xs)',
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        padding: '2px 8px',
        borderRadius: 4,
        letterSpacing: '0.05em',
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── Component row ──

function ComponentRow({ cs }: { cs: OutageStatus }) {
  const pctStr = cs.totalCount > 0 ? `${cs.outagePct}%` : '—'
  let icon = '  '
  let iconColor = 'var(--color-text-3)'
  if (cs.isExceeded) {
    icon = '!!'
    iconColor = '#EF4444'
  } else if (cs.isApproaching) {
    icon = '! '
    iconColor = '#F59E0B'
  } else if (cs.inoperativeCount === 0) {
    icon = '  '
    iconColor = '#22C55E'
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0 4px 24px',
        fontSize: 'var(--fs-sm)',
        color: cs.isExceeded ? '#EF4444' : cs.isApproaching ? '#F59E0B' : 'var(--color-text-2)',
      }}
    >
      <span style={{ color: iconColor, fontWeight: 700, width: 16, textAlign: 'center' }}>
        {cs.isExceeded ? '\u26D4' : cs.isApproaching ? '\u26A0' : cs.inoperativeCount === 0 ? '\u2713' : '\u25CB'}
      </span>
      <span style={{ flex: 1 }}>{cs.componentLabel}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'right' }}>
        {cs.inoperativeCount}/{cs.totalCount} ({pctStr})
      </span>
      {cs.allowableOutageText && (
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-3)',
            maxWidth: 140,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={`Allowable: ${cs.allowableOutageText}`}
        >
          max: {cs.allowablePct != null ? `${cs.allowablePct}%` : cs.allowableCount != null ? `${cs.allowableCount}` : cs.isZeroTolerance ? 'None' : '—'}
        </span>
      )}
    </div>
  )
}

// ── Exceeded alert box ──

function ExceededAlert({ cs }: { cs: OutageStatus }) {
  return (
    <div
      style={{
        margin: '4px 0 4px 24px',
        padding: '8px 12px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 8,
        fontSize: 'var(--fs-sm)',
      }}
    >
      <div style={{ color: '#EF4444', fontWeight: 700, marginBottom: 4 }}>
        OUTAGE EXCEEDS ALLOWABLE LIMIT
      </div>
      <div style={{ color: 'var(--color-text-2)', marginBottom: 4 }}>
        {cs.componentLabel}: {cs.inoperativeCount}/{cs.totalCount} out ({cs.outagePct}%)
        {cs.allowableOutageText && (
          <span style={{ color: 'var(--color-text-3)' }}>
            {' '}&mdash; Allowable: {cs.allowableOutageText}
          </span>
        )}
      </div>
      {cs.hasAdjacentViolation && (
        <div style={{ color: '#EF4444', fontSize: 'var(--fs-xs)' }}>
          Adjacent lamp violation detected
        </div>
      )}
      {cs.hasConsecutiveViolation && (
        <div style={{ color: '#EF4444', fontSize: 'var(--fs-xs)' }}>
          Consecutive lamp violation detected ({cs.allowableConsecutive} max)
        </div>
      )}
      <div style={{ marginTop: 6, color: 'var(--color-text-2)', fontWeight: 600, fontSize: 'var(--fs-xs)' }}>
        REQUIRED ACTIONS:
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 2 }}>
        {cs.requiredActions.notam && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 2 }}>
            <span style={{ color: 'var(--color-text-3)' }}>{'\u2610'}</span>
            <span>Issue NOTAM{cs.qCode ? ` (${cs.qCode})` : ''}{cs.notamTemplate ? ` — ${cs.notamTemplate}` : ''}</span>
          </div>
        )}
        {cs.requiredActions.notifyCE && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 2 }}>
            <span style={{ color: 'var(--color-text-3)' }}>{'\u2610'}</span>
            <span>Notify CE Electrical / Airfield Lighting</span>
          </div>
        )}
        {cs.requiredActions.notifyTerps && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 2 }}>
            <span style={{ color: 'var(--color-text-3)' }}>{'\u2610'}</span>
            <span>Notify TERPs — may impact instrument procedures</span>
          </div>
        )}
        {cs.requiredActions.systemShutoff && (
          <div
            style={{
              marginTop: 6,
              padding: '6px 8px',
              background: 'rgba(239,68,68,0.12)',
              borderRadius: 6,
              color: '#EF4444',
              fontWeight: 600,
            }}
          >
            SYSTEM SHUTOFF MAY BE REQUIRED
            <div style={{ fontWeight: 400, marginTop: 2 }}>
              Waiver: Installation Commander (&le;24hr) / MAJCOM/A3 (&gt;24hr)
            </div>
            <div style={{ fontWeight: 400 }}>Civil aircraft operations PROHIBITED</div>
          </div>
        )}
        {cs.requiredActions.obstructionNotamAttrs && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 2 }}>
            <span style={{ color: 'var(--color-text-3)' }}>{'\u2610'}</span>
            <span>NOTAM must include obstruction attributes (FAAO JO 7930.2)</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Approaching warning box ──

function ApproachingWarning({ cs }: { cs: OutageStatus }) {
  const remaining = cs.allowablePct != null
    ? `${Math.round(cs.allowablePct - cs.outagePct)}% remaining`
    : cs.allowableCount != null
    ? `${cs.allowableCount - cs.inoperativeCount} remaining`
    : ''
  return (
    <div
      style={{
        margin: '4px 0 4px 24px',
        padding: '6px 10px',
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 8,
        fontSize: 'var(--fs-xs)',
        color: '#F59E0B',
      }}
    >
      Approaching limit — {remaining}{remaining ? '. ' : ''}Monitor closely.
    </div>
  )
}

// ── System row (expandable) ──

function SystemRow({ health }: { health: SystemHealth }) {
  const [expanded, setExpanded] = useState(health.status !== 'operational')
  const tier = getAlertTier(health)
  const tierConfig = ALERT_TIER_CONFIG[tier]

  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* System header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--fs-md)',
          fontFamily: 'inherit',
          color: 'var(--color-text-1)',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: tierConfig.color,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, fontWeight: 600 }}>{health.systemName}</span>
        <StatusBadge status={health.status} />
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: 'var(--fs-sm)',
            color: 'var(--color-text-3)',
            minWidth: 60,
            textAlign: 'right',
          }}
        >
          {health.inoperativeFeatures}/{health.totalFeatures} out
        </span>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-3)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
          }}
        >
          {'\u25BC'}
        </span>
      </button>

      {/* Expanded component list */}
      {expanded && (
        <div style={{ paddingBottom: 8 }}>
          {health.components.map((cs) => (
            <div key={cs.componentId}>
              <ComponentRow cs={cs} />
              {cs.isExceeded && <ExceededAlert cs={cs} />}
              {cs.isApproaching && <ApproachingWarning cs={cs} />}
            </div>
          ))}
          {health.components.length === 0 && (
            <div style={{ padding: '8px 24px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              No components configured. Set up components in Base Configuration.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ──

export default function SystemHealthPanel({
  healths,
  loading,
  compact,
  outageEvents,
}: {
  healths: SystemHealth[]
  loading?: boolean
  compact?: boolean
  outageEvents?: EnrichedOutageEvent[]
}) {
  const [collapsed, setCollapsed] = useState(true)
  const [activityExpanded, setActivityExpanded] = useState(false)

  if (loading) {
    return (
      <div
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          Loading lighting system status...
        </div>
      </div>
    )
  }

  if (healths.length === 0) {
    return (
      <div
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4, fontSize: 'var(--fs-lg)' }}>
          LIGHTING SYSTEM STATUS
        </div>
        <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          No lighting systems configured. Set up systems in Base Configuration &rarr; Lighting Systems.
        </div>
      </div>
    )
  }

  // Summary counts
  const exceeded = healths.filter((h) => h.status === 'exceeded' || h.status === 'inoperative')
  const approaching = healths.filter((h) => h.approachingComponents.length > 0 && h.status === 'degraded')
  const totalInop = healths.reduce((sum, h) => sum + h.inoperativeFeatures, 0)
  const totalFeatures = healths.reduce((sum, h) => sum + h.totalFeatures, 0)

  return (
    <div
      style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid var(--color-border)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', flex: 1 }}>
          LIGHTING SYSTEM STATUS
        </span>
        {exceeded.length > 0 && (
          <span
            style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              color: '#EF4444',
              background: 'rgba(239,68,68,0.12)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {exceeded.length} EXCEEDED
          </span>
        )}
        {approaching.length > 0 && (
          <span
            style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              color: '#F59E0B',
              background: 'rgba(245,158,11,0.12)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {approaching.length} APPROACHING
          </span>
        )}
        <span
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--color-text-3)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {totalInop}/{totalFeatures} inop
        </span>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-3)',
            transform: collapsed ? 'rotate(0)' : 'rotate(180deg)',
            transition: 'transform 0.15s',
          }}
        >
          {'\u25BC'}
        </span>
      </button>

      {/* System list */}
      {!collapsed && (
        <div>
          {healths.map((h) => (
            <SystemRow key={h.systemId} health={h} />
          ))}
        </div>
      )}

      {/* Recent Activity */}
      {!collapsed && outageEvents && outageEvents.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setActivityExpanded(!activityExpanded)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
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
            <span
              style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--color-text-3)',
                transform: activityExpanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.15s',
              }}
            >
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
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: isResolved ? '#22C55E' : '#EF4444',
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
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
