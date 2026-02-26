'use client'

const ROLE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  sys_admin:   { bg: 'rgba(127,29,29,0.3)',  text: '#F87171', border: 'rgba(185,28,28,0.5)',  label: 'SYS ADMIN' },
  base_admin:  { bg: 'rgba(22,78,99,0.3)',   text: '#22D3EE', border: 'rgba(14,116,144,0.5)', label: 'BASE ADMIN' },
  airfield_manager: { bg: 'rgba(22,78,99,0.3)', text: '#22D3EE', border: 'rgba(14,116,144,0.5)', label: 'AFM' },
  namo:        { bg: 'rgba(22,78,99,0.3)',   text: '#22D3EE', border: 'rgba(14,116,144,0.5)', label: 'NAMO' },
  amops:       { bg: 'rgba(51,65,85,0.5)',   text: '#CBD5E1', border: 'rgba(71,85,105,0.5)',  label: 'AMOPS' },
  ces:         { bg: 'rgba(51,65,85,0.5)',   text: '#CBD5E1', border: 'rgba(71,85,105,0.5)',  label: 'CES' },
  safety:      { bg: 'rgba(51,65,85,0.5)',   text: '#CBD5E1', border: 'rgba(71,85,105,0.5)',  label: 'SAFETY' },
  atc:         { bg: 'rgba(51,65,85,0.5)',   text: '#CBD5E1', border: 'rgba(71,85,105,0.5)',  label: 'ATC' },
  read_only:   { bg: 'rgba(51,65,85,0.5)',   text: '#CBD5E1', border: 'rgba(71,85,105,0.5)',  label: 'READ ONLY' },
}

export function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLES[role] || ROLE_STYLES.read_only
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
