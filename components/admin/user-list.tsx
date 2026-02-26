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
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ width: '60%', height: 14, background: 'var(--color-bg-elevated)', borderRadius: 4 }} />
        <div style={{ width: 60, height: 14, background: 'var(--color-bg-elevated)', borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ width: '45%', height: 12, background: 'var(--color-bg-elevated)', borderRadius: 4 }} />
        <div style={{ width: 50, height: 12, background: 'var(--color-bg-elevated)', borderRadius: 4 }} />
      </div>
      <div style={{ width: '30%', height: 10, background: 'var(--color-bg-elevated)', borderRadius: 4 }} />
    </div>
  )
}

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
          fontSize: 13,
        }}
      >
        No users found matching your search.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          showInstallation={showInstallation}
          onSelect={onSelectUser}
        />
      ))}
    </div>
  )
}
