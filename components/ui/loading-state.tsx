'use client'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>
      {message}
    </div>
  )
}
