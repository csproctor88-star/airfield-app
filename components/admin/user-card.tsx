'use client'

import { RoleBadge } from './role-badge'
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
  created_at: string
  bases?: { name: string; icao: string } | null
}

interface UserCardProps {
  user: UserCardData
  showInstallation: boolean
  onSelect: (user: UserCardData) => void
}

export function UserCard({ user, showInstallation, onSelect }: UserCardProps) {
  const displayName = [user.rank, user.first_name, user.last_name]
    .filter(Boolean)
    .join(' ')
  const lastActive = user.last_seen_at
    ? formatRelativeTime(user.last_seen_at)
    : 'Never'

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
        flexDirection: 'column',
        gap: 4,
        border: '1px solid var(--color-border)',
        fontFamily: 'inherit',
      }}
    >
      {/* Row 1: Name + Role badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
          {displayName || 'Unnamed User'}
        </div>
        <RoleBadge role={user.role} />
      </div>

      {/* Row 2: Status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div />
        <UserStatusBadge status={user.status || 'active'} />
      </div>

      {/* Row 3: Installation + Last active */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {showInstallation && user.bases ? (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
            {user.bases.name} · {user.bases.icao}
          </div>
        ) : (
          <div />
        )}
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
          Last Seen: {lastActive}
        </div>
      </div>
    </button>
  )
}
