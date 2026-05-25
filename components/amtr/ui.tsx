'use client'

import type { ReactNode, CSSProperties } from 'react'

// AMTR shared UI primitives — built on Glidepath tokens. The global
// .input-dark / .section-label classes are correct; buttons need a
// compact variant the global .btn-* classes don't provide, so Btn is
// inline-styled against the same tokens.

// ── Field: block label stacked above a control ─────────────
export function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <span className="section-label" style={{ marginBottom: 0 }}>{label}</span>
      {children}
    </div>
  )
}

// ── Btn: compact button with token-based variants ──────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANT_STYLE: Record<BtnVariant, CSSProperties> = {
  primary: { background: 'linear-gradient(135deg, var(--color-accent-dark), var(--color-accent-secondary))', color: '#fff', border: 'none' },
  secondary: { background: 'transparent', color: 'var(--color-text-1)', border: '1.5px solid var(--color-border-mid)' },
  ghost: { background: 'transparent', color: 'var(--color-text-2)', border: '1px solid var(--color-border)' },
  danger: { background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', border: '1.5px solid rgba(239,68,68,0.3)' },
}

export function Btn({
  children, onClick, variant = 'secondary', disabled, title, type = 'button', style,
}: {
  children: ReactNode; onClick?: () => void; variant?: BtnVariant
  disabled?: boolean; title?: string; type?: 'button' | 'submit'; style?: CSSProperties
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 600,
        fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
        ...VARIANT_STYLE[variant], ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── TabBar: pill segmented control ─────────────────────────
export function TabBar({
  tabs, active, onChange,
}: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, background: 'var(--color-bg-inset)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
      {tabs.map((t) => {
        const on = active === t.key
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 600, fontFamily: 'inherit',
              background: on ? 'var(--color-accent)' : 'transparent',
              color: on ? '#fff' : 'var(--color-text-3)',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Table chrome helpers (consistent header/cell styling) ──
export const thStyle: CSSProperties = {
  padding: '9px 14px', textAlign: 'left', fontSize: 'var(--fs-xs)',
  textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)',
  borderBottom: '1px solid var(--color-border)', fontWeight: 700,
}
export const tdStyle: CSSProperties = { padding: '9px 14px', fontSize: 'var(--fs-sm)' }
