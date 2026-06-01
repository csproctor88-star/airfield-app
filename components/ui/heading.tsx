import type { CSSProperties, ReactNode } from 'react'

// Typographic heading primitive. Hierarchy comes from size + weight + line-height
// + tracking together (not 700-everywhere). Sizes resolve through the --fs-*
// tokens, so they scale with the v2 type scale automatically.

export type HeadingLevel = 'display' | 'h1' | 'h2' | 'h3'

const MAP: Record<HeadingLevel, { fs: string; weight: number; lh: string; ls: string }> = {
  display: { fs: 'var(--fs-5xl)', weight: 700, lh: 'var(--lh-tight)', ls: '-0.02em' },
  h1: { fs: 'var(--fs-4xl)', weight: 700, lh: 'var(--lh-tight)', ls: '-0.015em' },
  h2: { fs: 'var(--fs-2xl)', weight: 600, lh: 'var(--lh-snug)', ls: '-0.01em' },
  h3: { fs: 'var(--fs-lg)', weight: 600, lh: 'var(--lh-snug)', ls: '0' },
}

export function Heading({
  level = 'h1',
  children,
  color = 'var(--color-text-1)',
  style,
}: {
  level?: HeadingLevel
  children: ReactNode
  color?: string
  style?: CSSProperties
}) {
  const m = MAP[level]
  const base: CSSProperties = {
    margin: 0,
    fontSize: m.fs,
    fontWeight: m.weight,
    lineHeight: m.lh,
    letterSpacing: m.ls,
    color,
    ...style,
  }
  if (level === 'h2') return <h2 style={base}>{children}</h2>
  if (level === 'h3') return <h3 style={base}>{children}</h3>
  return <h1 style={base}>{children}</h1>
}
