import type { CSSProperties, ReactNode } from 'react'

// Calmer section header: a quiet uppercase eyebrow + optional normal-case title
// and a right-aligned slot (count, action). No cyan underline — hierarchy comes
// from whitespace and weight, not a hairline on every section.

export function SectionHeader({
  eyebrow,
  title,
  right,
  style,
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  right?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow != null && (
          <div
            style={{
              fontSize: 'var(--fs-2xs)',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-text-3)',
            }}
          >
            {eyebrow}
          </div>
        )}
        {title != null && (
          <div
            style={{
              fontSize: 'var(--fs-lg)',
              fontWeight: 600,
              color: 'var(--color-text-1)',
              lineHeight: 'var(--lh-snug)',
            }}
          >
            {title}
          </div>
        )}
      </div>
      {right != null && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}
