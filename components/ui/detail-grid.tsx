'use client'

import type { ReactNode } from 'react'

interface DetailItem {
  label: string
  value: ReactNode
  color?: string
  span?: boolean
}

interface DetailGridProps {
  items: DetailItem[]
  columns?: 1 | 2 | 3
  gap?: number
}

export function DetailGrid({ items, columns = 2, gap = 10 }: DetailGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns === 1 ? '1fr' : `repeat(${columns}, 1fr)`,
        gap,
        fontSize: 'var(--fs-base)',
      }}
    >
      {items.map((item, i) => (
        <div key={i} style={item.span ? { gridColumn: `1 / -1` } : undefined}>
          <div className="section-label">{item.label}</div>
          <div style={{ fontWeight: 500, marginTop: 2, color: item.color || 'var(--color-text-1)' }}>
            {item.value ?? 'N/A'}
          </div>
        </div>
      ))}
    </div>
  )
}
