'use client'

const ROLE_CLASSES: Record<string, { className: string; label: string }> = {
  sys_admin:        { className: 'badge-role-sysadmin', label: 'SYS ADMIN' },
  base_admin:       { className: 'badge-role-baseadmin', label: 'BASE ADMIN' },
  airfield_manager: { className: 'badge-role-baseadmin', label: 'AFM' },
  namo:             { className: 'badge-role-baseadmin', label: 'NAMO' },
  amops:            { className: 'badge-role-user', label: 'AMOPS' },
  ces:              { className: 'badge-role-user', label: 'CES' },
  safety:           { className: 'badge-role-user', label: 'SAFETY' },
  atc:              { className: 'badge-role-user', label: 'ATC' },
  read_only:        { className: 'badge-role-user', label: 'READ ONLY' },
  observer:         { className: 'badge-role-user', label: 'READ ONLY' },
}

export function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CLASSES[role] || ROLE_CLASSES.read_only
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
