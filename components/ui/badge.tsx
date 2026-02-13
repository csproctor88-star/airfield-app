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
      style={{
        background: bg || `${color}1A`,
        color,
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        lineHeight: '16px',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  )
}

// Preset badges from SRS Section 6.2
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#FBBF24',
  low: '#38BDF8',
}

const STATUS_COLORS: Record<string, string> = {
  open: '#EF4444',
  assigned: '#F97316',
  in_progress: '#FBBF24',
  resolved: '#34D399',
  closed: '#64748B',
}

export function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLORS[severity.toLowerCase()] || '#94A3B8'
  return <Badge label={severity.toUpperCase()} color={color} />
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status.toLowerCase().replace(/ /g, '_')] || '#94A3B8'
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return <Badge label={label} color={color} />
}
