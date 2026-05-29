'use client'

import { Users, Clock, CheckCircle2, UserX } from 'lucide-react'

export interface UserStatusCounts {
  total: number
  pending: number
  active: number
  deactivated: number
}

interface UserStatsHeaderProps {
  counts: UserStatusCounts
  /** Current status filter ('' = all). Drives the highlighted segment. */
  statusFilter: string
  /** Toggle a status filter; passing '' clears it (Total segment). */
  onSelectStatus: (status: string) => void
}

/**
 * A single bordered chip-cluster summarizing the user population. Each
 * segment doubles as a status filter — clicking toggles `statusFilter`
 * on the page. Reads as one widget (per the chip-cluster convention),
 * not four loose pills. Pending uses the outlined-amber recipe (tinted
 * bg + amber border + amber text) and is emphasized whenever > 0.
 */
export function UserStatsHeader({ counts, statusFilter, onSelectStatus }: UserStatsHeaderProps) {
  const segments = [
    { key: '', label: 'Total', value: counts.total, color: 'var(--color-text-2)', Icon: Users },
    { key: 'pending', label: 'Pending', value: counts.pending, color: 'var(--color-warning)', Icon: Clock },
    { key: 'active', label: 'Active', value: counts.active, color: 'var(--color-success)', Icon: CheckCircle2 },
    { key: 'deactivated', label: 'Deactivated', value: counts.deactivated, color: 'var(--color-text-3)', Icon: UserX },
  ] as const

  return (
    <div
      role="group"
      aria-label="User counts and status filter"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        border: '1px solid var(--color-border-mid)',
        borderRadius: 'var(--radius-lg, 12px)',
        background: 'var(--color-bg-elevated)',
        overflow: 'hidden',
      }}
    >
      {segments.map((seg, i) => {
        const selected = statusFilter === seg.key
        // Pending always draws attention when there's a queue, even unselected.
        const emphasize = selected || (seg.key === 'pending' && counts.pending > 0)
        return (
          <button
            key={seg.key || 'total'}
            type="button"
            onClick={() => onSelectStatus(selected ? '' : seg.key)}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '10px 6px',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--color-border)',
              background: selected
                ? `color-mix(in srgb, ${seg.color} 14%, transparent)`
                : 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 120ms ease',
            }}
            aria-pressed={selected}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <seg.Icon size={13} style={{ color: emphasize ? seg.color : 'var(--color-text-4)' }} />
              <span
                style={{
                  fontSize: 'var(--fs-xl)',
                  fontWeight: 800,
                  lineHeight: 1,
                  color: emphasize ? seg.color : 'var(--color-text-1)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {seg.value}
              </span>
            </div>
            <span
              style={{
                fontSize: 'var(--fs-2xs)',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: emphasize ? seg.color : 'var(--color-text-3)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {seg.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
