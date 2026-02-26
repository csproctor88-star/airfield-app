'use client'

const STATUS_CLASSES: Record<string, { className: string; label: string }> = {
  active:      { className: 'badge-status-active', label: 'ACTIVE' },
  deactivated: { className: 'badge-status-deactivated', label: 'DEACTIVATED' },
  pending:     { className: 'badge-status-pending', label: 'PENDING' },
}

export function UserStatusBadge({ status }: { status: string }) {
  const config = STATUS_CLASSES[status] || STATUS_CLASSES.active
  return (
    <span
      className={config.className}
      style={{
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
      {config.label}
    </span>
  )
}
