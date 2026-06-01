import type { CSSProperties, ReactNode } from 'react'
import { Heading } from './heading'

// Page header: a real, sized title with a quiet uppercase eyebrow and optional
// subtitle + actions. Replaces the old pattern of a tiny uppercase label that
// looked like every other label on the page. Uppercase is reserved for the
// eyebrow role only.

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  style,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 18,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow != null && (
          <div
            style={{
              fontSize: 'var(--fs-2xs)',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-text-3)',
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </div>
        )}
        <Heading level="h1">{title}</Heading>
        {subtitle != null && (
          <div
            style={{
              fontSize: 'var(--fs-sm)',
              color: 'var(--color-text-3)',
              marginTop: 4,
              lineHeight: 'var(--lh-snug)',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {actions != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{actions}</div>
      )}
    </div>
  )
}
