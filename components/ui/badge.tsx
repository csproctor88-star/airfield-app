'use client'

// Badge matching prototype: tiny colored pill (9px, 700 weight)
// Usage: <Badge label="Critical" color="#EF4444" />

interface BadgeProps {
  label: string
  color: string
  bg?: string
}

export function Badge({ label, color, bg }: BadgeProps) {
  return (
    <span
      className="badge-pill"
      style={{
        background: bg || `${color}1A`,
        color,
      }}
    >
      {label}
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  open: '#3B82F6',
  completed: '#10B981',
  cancelled: '#9CA3AF',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/ /g, '_')
  const color = STATUS_COLORS[key] || '#94A3B8'
  const label = STATUS_LABELS[key] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return <Badge label={label} color={color} />
}
