import type { CSSProperties, ReactNode, HTMLAttributes } from 'react'

// Surface primitive. Grouping reads through elevation (bg ladder) + a single
// neutral hairline, not a cyan-tinted border on everything. An optional accent
// left-rule carries status/category color.

type CardVariant = 'surface' | 'elevated'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  /** Optional left-rule color (e.g. a status token) for category/status cards. */
  accent?: string
  children?: ReactNode
  style?: CSSProperties
}

export function Card({ variant = 'surface', accent, children, style, ...rest }: CardProps) {
  const bg = variant === 'elevated' ? 'var(--color-bg-elevated)' : 'var(--color-bg-surface)'
  return (
    <div
      style={{
        background: bg,
        border: '1px solid var(--color-border)',
        borderLeft: accent ? `3px solid ${accent}` : undefined,
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
