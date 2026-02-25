'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { fetchWaivers, type WaiverRow } from '@/lib/supabase/waivers'
import { DEMO_WAIVERS } from '@/lib/demo-data'
import { WAIVER_STATUS_CONFIG, WAIVER_TYPES } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'

const FILTERS = ['all', 'draft', 'submitted', 'approved', 'active', 'expired', 'denied'] as const
const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  active: 'Active',
  expired: 'Expired',
  denied: 'Denied',
}

export default function WaiversPage() {
  const { installationId } = useInstallation()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [waivers, setWaivers] = useState<WaiverRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setUsingDemo(true)
        setLoading(false)
        return
      }

      const data = await fetchWaivers(installationId)
      setWaivers(data)
      setLoading(false)
    }
    load()
  }, [installationId])

  const allItems = usingDemo ? DEMO_WAIVERS : waivers
  const q = search.toLowerCase()

  const matchesSearch = (w: { title: string; description: string; display_id: string; waiver_type: string }) =>
    !q || w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q) || w.display_id.toLowerCase().includes(q) || w.waiver_type.toLowerCase().includes(q)

  const activeCount = allItems.filter(w => w.status === 'active').length
  const pendingCount = allItems.filter(w => w.status === 'submitted').length
  const expiringCount = allItems.filter(w => {
    if (w.status !== 'active' || !w.effective_end) return false
    const daysLeft = Math.floor((new Date(w.effective_end).getTime() - Date.now()) / 86400000)
    return daysLeft >= 0 && daysLeft <= 30
  }).length
  const totalCount = allItems.length

  const filtered = allItems
    .filter(w => filter === 'all' || w.status === filter)
    .filter(matchesSearch)

  const getTypeInfo = (type: string) => WAIVER_TYPES.find(t => t.value === type)
  const getStatusConfig = (status: string) => WAIVER_STATUS_CONFIG[status as keyof typeof WAIVER_STATUS_CONFIG]

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Waivers</div>
        <Link
          href="/waivers/new"
          style={{
            background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
            border: 'none',
            borderRadius: 8,
            padding: '7px 12px',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          + New Waiver
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'ACTIVE', value: activeCount, color: '#8B5CF6' },
          { label: 'PENDING REVIEW', value: pendingCount, color: '#3B82F6' },
          { label: 'EXPIRING ≤30D', value: expiringCount, color: expiringCount > 0 ? '#F59E0B' : '#34D399' },
          { label: 'TOTAL', value: totalCount, color: '#64748B' },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: 'var(--color-bg-surface)',
              border: `1px solid var(--color-border)`,
              borderRadius: 10,
              padding: '10px 6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--color-text-3)', letterSpacing: '0.08em', fontWeight: 600 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map((v) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            style={{
              background: filter === v ? 'rgba(34,211,238,0.12)' : 'transparent',
              border: `1px solid ${filter === v ? 'rgba(34,211,238,0.3)' : 'var(--color-border)'}`,
              borderRadius: 5,
              padding: '4px 8px',
              color: filter === v ? 'var(--color-cyan)' : 'var(--color-text-3)',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {FILTER_LABELS[v]}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Search title, description, or waiver ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: 12,
          background: 'var(--color-search-bg)',
          border: '1px solid var(--color-search-border)',
          borderRadius: 8,
          color: 'var(--color-text-1)',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 13 }}>
          Loading...
        </div>
      ) : (
        <>
          {filtered.map((w) => {
            const typeInfo = getTypeInfo(w.waiver_type)
            const statusConf = getStatusConfig(w.status)
            return (
              <Link
                key={w.id}
                href={`/waivers/${w.id}`}
                className="card"
                style={{
                  cursor: 'pointer',
                  display: 'block',
                  marginBottom: 8,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>
                    {w.display_id}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {statusConf && <Badge label={statusConf.label} color={statusConf.color} />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {typeInfo && <Badge label={`${typeInfo.emoji} ${typeInfo.label}`} color="#64748B" />}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{w.title}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {w.location_text && <span>{w.location_text}</span>}
                  {w.effective_start && w.effective_end && (
                    <>
                      {w.location_text && <span>&bull;</span>}
                      <span>{formatDate(w.effective_start)} — {formatDate(w.effective_end)}</span>
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 13 }}>
          No waivers match this filter
        </div>
      )}
    </div>
  )
}
