'use client'

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active:      { bg: 'rgba(20,83,45,0.3)',   text: '#4ADE80', border: 'rgba(21,128,61,0.5)',  label: 'ACTIVE' },
  deactivated: { bg: 'rgba(127,29,29,0.3)',  text: '#F87171', border: 'rgba(185,28,28,0.5)',  label: 'DEACTIVATED' },
  pending:     { bg: 'rgba(120,53,15,0.3)',  text: '#FBBF24', border: 'rgba(161,98,7,0.5)',   label: 'PENDING' },
}

export function UserStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.active
  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        lineHeight: '16px',
        display: 'inline-block',
      }}
    >
      {style.label}
    </span>
  )
}
