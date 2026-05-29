'use client'

import { UserCard, type UserCardData } from './user-card'

interface UserListProps {
  users: UserCardData[]
  loading: boolean
  showInstallation: boolean
  onSelectUser: (user: UserCardData) => void
}

function SkeletonCard() {
  return (
    <div
      className="card"
      style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg-elevated)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ width: '55%', height: 13, background: 'var(--color-bg-elevated)', borderRadius: 4 }} />
        <div style={{ width: '40%', height: 11, background: 'var(--color-bg-elevated)', borderRadius: 4 }} />
      </div>
      <div style={{ width: 56, height: 14, background: 'var(--color-bg-elevated)', borderRadius: 4 }} />
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '4px 2px',
        fontSize: 'var(--fs-2xs)',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-text-3)',
      }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--color-text-4)' }}>({count})</span>
      <span style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  )
}

// Pending first (it's the action queue), then active, then deactivated.
const SECTIONS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending Approval' },
  { key: 'active', label: 'Active' },
  { key: 'deactivated', label: 'Deactivated' },
]

export function UserList({ users, loading, showInstallation, onSelectUser }: UserListProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: '32px 20px',
          color: 'var(--color-text-3)',
          fontSize: 'var(--fs-md)',
        }}
      >
        No users found matching your search.
      </div>
    )
  }

  const groups = SECTIONS.map((s) => ({
    ...s,
    users: users.filter((u) => (u.status || 'active') === s.key),
  })).filter((g) => g.users.length > 0)

  // Defensive: any unexpected status falls into a trailing "Other" group so
  // a user is never silently dropped from the list.
  const known = new Set(SECTIONS.map((s) => s.key))
  const other = users.filter((u) => !known.has(u.status || 'active'))
  if (other.length > 0) groups.push({ key: 'other', label: 'Other', users: other })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {groups.map((group) => (
        <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionHeader label={group.label} count={group.users.length} />
          {group.users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              showInstallation={showInstallation}
              onSelect={onSelectUser}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
