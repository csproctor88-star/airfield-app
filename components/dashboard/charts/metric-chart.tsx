'use client'
export function MetricChart({ value, label }: { value: number; label?: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--color-text-1)', lineHeight: 1 }}>{value}</div>
      {label && <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>}
    </div>
  )
}
