'use client'

import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  count?: { value: number; label?: string; color?: string; bg?: string }
}

export function PageHeader({ title, subtitle, actions, count }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      flexWrap: 'wrap',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
          {title}
        </h1>
        {count && count.value > 0 && (
          <span style={{
            background: count.bg || 'var(--color-cyan-btn-bg)',
            color: count.color || 'var(--color-cyan-btn-text)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 700,
            padding: '2px 10px',
            borderRadius: 12,
          }}>
            {count.value} {count.label || ''}
          </span>
        )}
        {subtitle && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}
