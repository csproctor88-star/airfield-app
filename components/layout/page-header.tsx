'use client'

import { useRouter } from 'next/navigation'

// Page header with back button and optional right action
// Matches prototype: cyan back link + bold title + optional button

interface PageHeaderProps {
  title: string
  backHref?: string
  action?: React.ReactNode
}

export function PageHeader({ title, backHref, action }: PageHeaderProps) {
  const router = useRouter()

  return (
    <div>
      {backHref && (
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: '#22D3EE',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 12,
            fontFamily: 'inherit',
          }}
        >
          ← Back
        </button>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: action ? 4 : 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
        {action}
      </div>
    </div>
  )
}
