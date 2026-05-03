'use client'

import { ROLE_LABELS, type TrainingRole } from '@/lib/training/modules'

const ALL_ROLES: TrainingRole[] = [
  'airfield_manager',
  'namo',
  'amops',
  'ces',
  'safety',
  'majcom_rfm',
  'ppr',
  'read_only',
  'base_admin',
  'sys_admin',
]

/**
 * Multi-select role filter shown above the modules grid. "All" chip
 * clears the selection (shows everything); selecting one or more roles
 * filters the grid to modules that include any of the selected roles.
 */
export function RoleChipFilter({
  selected,
  onChange,
}: {
  selected: TrainingRole[]
  onChange: (next: TrainingRole[]) => void
}) {
  const showingAll = selected.length === 0

  function toggle(role: TrainingRole) {
    if (selected.includes(role)) {
      onChange(selected.filter(r => r !== role))
    } else {
      onChange([...selected, role])
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => onChange([])}
        style={chipStyle(showingAll)}
      >
        All
      </button>
      <div style={{ width: 1, height: 18, background: 'var(--color-border)', margin: '0 4px' }} />
      {ALL_ROLES.map(role => (
        <button
          key={role}
          type="button"
          onClick={() => toggle(role)}
          style={chipStyle(selected.includes(role))}
        >
          {ROLE_LABELS[role]}
        </button>
      ))}
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 999,
    border: active ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
    background: active ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)' : 'var(--color-bg-surface)',
    color: active ? 'var(--color-cyan)' : 'var(--color-text-2)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  }
}
