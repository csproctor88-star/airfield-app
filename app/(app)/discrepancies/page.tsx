'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DiscrepancyCard } from '@/components/discrepancies/discrepancy-card'
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { DEMO_DISCREPANCIES } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'

const FILTERS = ['all', 'open', 'assigned', 'in_progress', 'completed'] as const

export default function DiscrepanciesPage() {
  const [filter, setFilter] = useState<string>('all')
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
  const daysOpen = (createdAt: string, status: string) => {
    if (['resolved', 'closed'].includes(status)) return 0
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))
  }

  // Use demo data as fallback when Supabase isn't configured
  const q = search.toLowerCase()
  const matchesSearch = (d: { title: string; description: string }) =>
    !q || d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)

  const demoFiltered = DEMO_DISCREPANCIES
    .filter(d => filter === 'all' || d.status === filter)
    .filter(matchesSearch)

  const liveFiltered = discrepancies
    .filter(d => filter === 'all' || d.status === filter)
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

      <input
        type="text"
        placeholder="Search title or description..."
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
          fontSize: 12,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
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
              daysOpen={daysOpen(d.created_at, d.status)}
              photoCount={d.photo_count}
            />
          ))}
        </>
      )}

      {!loading && (usingDemo ? demoFiltered : liveFiltered).length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 12 }}>
          No discrepancies match this filter
        </div>
      )}
    </div>
  )
}
