'use client'

import { RoleBadge, getRoleRailColor } from './role-badge'
import { UserStatusBadge } from './status-badge'
import { formatRelativeTime } from '@/lib/utils'

export interface UserCardData {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  rank: string | null
  role: string
  status: string
  last_seen_at: string | null
  primary_base_id: string | null
  edipi: string | null
  operating_initials: string | null
  unit: string | null
  office_symbol: string | null
  created_at: string
  bases?: { name: string; icao: string } | null
}

interface UserCardProps {
  user: UserCardData
  showInstallation: boolean
  onSelect: (user: UserCardData) => void
}

/** Two-letter initials from first/last name, falling back to the full
 *  name, then the email. Drives the avatar monogram. */
function initialsFor(user: UserCardData): string {
  const f = (user.first_name || '').trim()
  const l = (user.last_name || '').trim()
  if (f || l) return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase() || '—'
  const parts = (user.email || '').replace(/@.*/, '').split(/[._-]/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

export function UserCard({ user, showInstallation, onSelect }: UserCardProps) {
  const railColor = getRoleRailColor(user.role)
  const displayName = [user.rank, user.first_name, user.last_name].filter(Boolean).join(' ')
  const lastActive = user.last_seen_at ? formatRelativeTime(user.last_seen_at) : 'Never'

  // Identity line: prefer Unit · Office Symbol; fall back to the
  // installation when neither is set (e.g. civilian-airport accounts).
  const unitOffice = [user.unit, user.office_symbol].filter(Boolean).join(' · ')
  const installation = user.bases ? `${user.bases.name} · ${user.bases.icao}` : ''
  const identity = unitOffice || installation
  // When viewing All Installations, show the base as a second line if the
  // identity line is already taken by Unit/Office.
  const showBaseSubline = showInstallation && !!installation && !!unitOffice

  return (
    <button
      type="button"
      onClick={() => onSelect(user)}
      className="card"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${railColor}`,
        fontFamily: 'inherit',
      }}
    >
      {/* Avatar monogram, tinted by role */}
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--fs-sm)',
          fontWeight: 800,
          letterSpacing: '0.02em',
          color: railColor,
          background: `color-mix(in srgb, ${railColor} 16%, transparent)`,
          border: `1px solid color-mix(in srgb, ${railColor} 35%, transparent)`,
        }}
      >
        {initialsFor(user)}
      </div>

      {/* Name + identity meta */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 'var(--fs-md)',
            fontWeight: 700,
            color: 'var(--color-text-1)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayName || 'Unnamed User'}
        </div>
        <div
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--color-text-3)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {identity ? `${identity}  ·  ` : ''}
          <span style={{ color: 'var(--color-text-4)' }}>seen {lastActive}</span>
        </div>
        {showBaseSubline && (
          <div
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--color-text-4)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {installation}
          </div>
        )}
      </div>

      {/* Role + status chips */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
        }}
      >
        <RoleBadge role={user.role} />
        <UserStatusBadge status={user.status || 'active'} />
      </div>
    </button>
  )
}
