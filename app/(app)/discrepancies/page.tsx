'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DiscrepancyCard } from '@/components/discrepancies/discrepancy-card'
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { DEMO_DISCREPANCIES } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'

const FILTERS = ['open', 'completed', 'cancelled', 'all'] as const
const FILTER_LABELS: Record<string, string> = {
  open: 'Open',
  completed: 'Completed',
  cancelled: 'Cancelled',
  all: 'All',
}

export default function DiscrepanciesPage() {
  const [filter, setFilter] = useState<string>('open')
  const [over30Only, setOver30Only] = useState(false)
  const [search, setSearch] = useState('')
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRow[]>([])
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

      const data = await fetchDiscrepancies()
      if (data.length === 0) {
        // Could be empty table or fetch error — check if Supabase is reachable
        setDiscrepancies([])
      } else {
        setDiscrepancies(data)
      }
      setLoading(false)
    }
    load()
  }, [])

  // Compute days_open for live data
  const daysOpen = (createdAt: string) => {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))
  }

  // Use demo data as fallback when Supabase isn't configured
  const q = search.toLowerCase()
  const matchesSearch = (d: { title: string; description: string; work_order_number?: string | null }) =>
    !q || d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || (d.work_order_number?.toLowerCase().includes(q) ?? false)

  // Counters: open work orders and >30 days open
  const allItems = usingDemo ? DEMO_DISCREPANCIES : discrepancies
  const openCount = allItems.filter(d => d.status === 'open').length
  const over30Count = allItems.filter(d => {
    const days = Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000))
    return d.status === 'open' && days > 30
  }).length

  const demoFiltered = DEMO_DISCREPANCIES
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => !over30Only || (d.status === 'open' && daysOpen(d.created_at) > 30))
    .filter(matchesSearch)

  const liveFiltered = discrepancies
    .filter(d => filter === 'all' || d.status === filter)
    .filter(d => !over30Only || (d.status === 'open' && daysOpen(d.created_at) > 30))
    .filter(matchesSearch)

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
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          + New
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'OPEN', value: openCount, color: '#FBBF24', active: filter === 'open' && !over30Only,
            onClick: () => { setFilter('open'); setOver30Only(false) } },
          { label: '> 30 DAYS', value: over30Count, color: over30Count > 0 ? '#EF4444' : '#34D399', active: over30Only,
            onClick: () => { setFilter('open'); setOver30Only(!over30Only) } },
        ].map((k) => (
          <div
            key={k.label}
            onClick={k.onClick}
            style={{
              background: 'rgba(10,16,28,0.92)',
              border: `1px solid ${k.active ? k.color + '44' : 'rgba(56,189,248,0.06)'}`,
              borderRadius: 10,
              padding: '10px 6px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.08em', fontWeight: 600 }}>
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
            onClick={() => { setFilter(v); setOver30Only(false) }}
            style={{
              background: filter === v ? 'rgba(34,211,238,0.12)' : 'transparent',
              border: `1px solid ${filter === v ? 'rgba(34,211,238,0.3)' : 'rgba(56,189,248,0.06)'}`,
              borderRadius: 5,
              padding: '4px 8px',
              color: filter === v ? '#22D3EE' : '#64748B',
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
        placeholder="Search title, description, or work order..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: 12,
          background: 'rgba(15,23,42,0.6)',
          border: '1px solid #1E293B',
          borderRadius: 8,
          color: '#E2E8F0',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13 }}>
          Loading...
        </div>
      ) : usingDemo ? (
        <>
          {demoFiltered.map((d) => (
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
              workOrderNumber={d.work_order_number}
            />
          ))}
        </>
      ) : (
        <>
          {(liveFiltered as DiscrepancyRow[]).map((d) => (
            <DiscrepancyCard
              key={d.id}
              id={d.id}
              displayId={d.display_id}
              title={d.title}
              severity={d.severity}
              status={d.status}
              locationText={d.location_text}
              assignedShop={d.assigned_shop}
              daysOpen={daysOpen(d.created_at)}
              photoCount={d.photo_count}
              workOrderNumber={d.work_order_number}
            />
          ))}
        </>
      )}

      {!loading && (usingDemo ? demoFiltered : liveFiltered).length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13 }}>
          No discrepancies match this filter
        </div>
      )}
    </div>
  )
}
