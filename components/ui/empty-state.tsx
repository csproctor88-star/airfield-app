'use client'

interface EmptyStateProps {
  message: string
  icon?: string
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 24 }}>
      {icon && <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)' }}>
        {message}
      </div>
    </div>
  )
}
