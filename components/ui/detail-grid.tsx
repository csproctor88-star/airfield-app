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

// Tile-based label/value grid. Each cell is its own bordered tile so
// label/value pairs are visually contained and the section doesn't
// read as a wall of text. Recipe matches the discrepancy-detail
// refresh in commit 20688a8: tiny dim uppercase labels, weight-500
// values, cyan color-mix() left rule, label clipped to a single line.
export function DetailGrid({ items, columns = 2, gap = 8 }: DetailGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns === 1 ? '1fr' : `repeat(${columns}, minmax(0, 1fr))`,
        gap,
        fontSize: 'var(--fs-base)',
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-inset)',
            borderLeft: '2px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
            ...(item.span ? { gridColumn: '1 / -1' } : null),
          }}
        >
          <div style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{item.label}</div>
          <div style={{
            fontSize: 'var(--fs-md)', fontWeight: 500,
            color: item.color || 'var(--color-text-1)',
            lineHeight: 1.3,
          }}>
            {item.value ?? 'N/A'}
          </div>
        </div>
      ))}
    </div>
  )
}
