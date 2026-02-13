'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DiscrepancyCard } from '@/components/discrepancies/discrepancy-card'
import { DEMO_DISCREPANCIES } from '@/lib/demo-data'

const FILTERS = ['all', 'open', 'assigned', 'in_progress', 'critical'] as const

export default function DiscrepanciesPage() {
  const [filter, setFilter] = useState<string>('all')

  const filtered = filter === 'all'
    ? DEMO_DISCREPANCIES
    : DEMO_DISCREPANCIES.filter(d => d.status === filter || d.severity === filter)

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Discrepancies</div>
        <Link
          href="/discrepancies/new"
          style={{
            background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
            border: 'none',
            borderRadius: 8,
            padding: '7px 12px',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          + New
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            style={{
              background: filter === v ? 'rgba(34,211,238,0.12)' : 'transparent',
              border: `1px solid ${filter === v ? 'rgba(34,211,238,0.3)' : 'rgba(56,189,248,0.06)'}`,
              borderRadius: 5,
              padding: '4px 8px',
              color: filter === v ? '#22D3EE' : '#64748B',
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {v === 'all' ? 'All' : v === 'in_progress' ? 'In Progress' : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {filtered.map((d) => (
        <DiscrepancyCard
          key={d.id}
          id={d.id}
          displayId={d.display_id}
          title={d.title}
          severity={d.severity}
          status={d.status}
          locationText={d.location_text}
          assignedShop={d.assigned_shop}
          daysOpen={d.days_open}
          photoCount={d.photo_count}
        />
      ))}

      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
          No discrepancies match this filter
        </div>
      )}
    </div>
  )
}
