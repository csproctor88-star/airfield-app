'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DEMO_NOTAMS } from '@/lib/demo-data'

type FilterType = 'all' | 'faa' | 'local' | 'active' | 'expired'

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'faa', label: 'FAA' },
  { key: 'local', label: 'LOCAL' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
]

const SOURCE_COLORS: Record<string, string> = {
  faa: '#22D3EE',
  local: '#A78BFA',
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22C55E',
  expired: '#64748B',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function NotamsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = DEMO_NOTAMS.filter((n) => {
    if (filter === 'all') return true
    if (filter === 'faa') return n.source === 'faa'
    if (filter === 'local') return n.source === 'local'
    if (filter === 'active') return n.status === 'active'
    if (filter === 'expired') return n.status === 'expired'
    return true
  })

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>NOTAMs</div>
        <button
          onClick={() => router.push('/notams/new')}
          style={{
            background: 'linear-gradient(135deg, #0EA5E9, #22D3EE)',
            border: 'none',
            color: '#FFF',
            fontSize: 13,
            fontWeight: 700,
            padding: '7px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Draft
        </button>
      </div>

      {/* FAA Feed status card */}
      <div
        style={{
          background: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 6px rgba(34,197,94,0.5)',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1' }}>
            FAA Feed Connected
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#64748B' }}>Last: 06:50L</span>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              background: filter === f.key ? '#1E293B' : 'transparent',
              border: `1px solid ${filter === f.key ? '#334155' : '#1E293B'}`,
              color: filter === f.key ? '#F1F5F9' : '#64748B',
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: 20,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* NOTAM cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((notam) => {
          const isExpired = notam.status === 'expired'
          const borderLeftColor = SOURCE_COLORS[notam.source] || '#334155'

          return (
            <div
              key={notam.id}
              onClick={() => router.push(`/notams/${notam.id}`)}
              style={{
                background: '#0F172A',
                border: '1px solid #1E293B',
                borderLeft: `3px solid ${borderLeftColor}`,
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
                opacity: isExpired ? 0.5 : 1,
              }}
            >
              {/* Top row: source + type badges, status badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge
                    label={notam.source.toUpperCase()}
                    color={SOURCE_COLORS[notam.source] || '#94A3B8'}
                  />
                  <Badge label={notam.notam_type} color="#94A3B8" />
                </div>
                <Badge
                  label={notam.status.toUpperCase()}
                  color={STATUS_COLORS[notam.status] || '#94A3B8'}
                />
              </div>

              {/* Title */}
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#F1F5F9',
                  marginBottom: 4,
                }}
              >
                {notam.title}
              </div>

              {/* Effective dates */}
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {formatDate(notam.effective_start)} — {formatDate(notam.effective_end)}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 24,
              color: '#64748B',
              fontSize: 13,
            }}
          >
            No NOTAMs match the selected filter.
          </div>
        )}
      </div>
    </div>
  )
}
