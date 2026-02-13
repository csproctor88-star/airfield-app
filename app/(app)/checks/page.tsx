'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DEMO_CHECKS } from '@/lib/demo-data'

const CHECK_TYPES = [
  { key: 'fod', label: 'FOD', color: '#FBBF24', icon: '🔍' },
  { key: 'bash', label: 'BASH', color: '#A78BFA', icon: '🦅' },
  { key: 'rcr', label: 'RCR', color: '#22D3EE', icon: '📏' },
  { key: 'rsc', label: 'RSC', color: '#38BDF8', icon: '❄️' },
  { key: 'emergency', label: 'Emergency', color: '#EF4444', icon: '🚨' },
] as const

const TYPE_COLORS: Record<string, string> = {
  fod: '#FBBF24',
  bash: '#A78BFA',
  rcr: '#22D3EE',
  rsc: '#38BDF8',
  emergency: '#EF4444',
}

const RESULT_COLORS: Record<string, string> = {
  LOW: '#34D399',
  MODERATE: '#FBBF24',
  SEVERE: '#EF4444',
  IFE: '#EF4444',
  GE: '#EF4444',
}

export default function ChecksPage() {
  const [filter, setFilter] = useState<string | null>(null)

  const filtered = filter
    ? DEMO_CHECKS.filter((c) => c.check_type === filter)
    : DEMO_CHECKS

  const counts = CHECK_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t.key] = DEMO_CHECKS.filter((c) => c.check_type === t.key).length
    return acc
  }, {})

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Airfield Checks</div>
      </div>

      {/* Type filter tiles */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {CHECK_TYPES.map((t) => {
          const isActive = filter === t.key
          return (
            <button
              key={t.key}
              onClick={() => setFilter(isActive ? null : t.key)}
              style={{
                flex: '1 1 0',
                minWidth: 56,
                background: isActive ? `${t.color}1A` : 'rgba(10, 16, 28, 0.92)',
                border: `1px solid ${isActive ? `${t.color}55` : 'rgba(56, 189, 248, 0.06)'}`,
                borderRadius: 8,
                padding: '8px 4px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: t.color }}>{counts[t.key]}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: isActive ? t.color : '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* New check buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {CHECK_TYPES.map((t) => (
          <Link
            key={t.key}
            href={`/checks/${t.key}`}
            style={{
              background: `${t.color}14`,
              border: `1px solid ${t.color}33`,
              borderRadius: 8,
              padding: '6px 10px',
              color: t.color,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            + {t.label}
          </Link>
        ))}
      </div>

      {/* Check cards */}
      {filtered.map((c) => {
        const color = TYPE_COLORS[c.check_type] || '#94A3B8'
        const resultColor = RESULT_COLORS[c.result] || color
        return (
          <Link
            key={c.id}
            href={`/checks/${c.id}`}
            className="card"
            style={{
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              borderLeft: `3px solid ${color}`,
              marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22D3EE', fontFamily: 'monospace' }}>
                {c.display_id}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <Badge label={c.check_type.toUpperCase()} color={color} />
                <Badge label={c.result} color={resultColor} />
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{c.area}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#64748B' }}>
                {new Date(c.check_date).toLocaleDateString()} &middot; {c.performed_by}
              </span>
            </div>
          </Link>
        )
      })}

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
          No checks match this filter
        </div>
      )}
    </div>
  )
}
