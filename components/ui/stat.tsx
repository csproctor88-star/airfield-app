import type { CSSProperties, ReactNode } from 'react'

// Operational-data display: a quiet uppercase label over a value rendered in the
// mono face with tabular figures, so numbers/IDs/times read as instrument data
// distinct from prose. Under v2 the mono face is IBM Plex Mono.

type StatSize = 'sm' | 'lg' | 'xl'

const VALUE_FS: Record<StatSize, string> = {
  sm: 'var(--fs-lg)',
  lg: 'var(--fs-2xl)',
  xl: 'var(--fs-4xl)',
}

export function Stat({
  label,
  value,
  color = 'var(--color-text-1)',
  size = 'lg',
  mono = true,
  align = 'left',
  style,
}: {
  label?: ReactNode
  value: ReactNode
  color?: string
  size?: StatSize
  mono?: boolean
  align?: 'left' | 'center' | 'right'
  style?: CSSProperties
}) {
  return (
    <div style={{ textAlign: align, ...style }}>
      {label != null && (
        <div
          style={{
            fontSize: 'var(--fs-2xs)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-text-3)',
            marginBottom: 2,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          fontFamily: mono ? 'var(--font-family-mono)' : 'inherit',
          fontVariantNumeric: 'tabular-nums',
          fontSize: VALUE_FS[size],
          fontWeight: 600,
          lineHeight: 'var(--lh-tight)',
          color,
        }}
      >
        {value}
      </div>
    </div>
  )
}
