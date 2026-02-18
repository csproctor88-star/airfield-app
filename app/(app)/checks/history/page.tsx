'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { CHECK_TYPE_CONFIG } from '@/lib/constants'
import { DEMO_CHECKS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { fetchChecks, type CheckRow } from '@/lib/supabase/checks'

export default function CheckHistoryPage() {
  const [liveChecks, setLiveChecks] = useState<CheckRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setUsingDemo(true)
        setLoading(false)
        return
      }
      const { data, error } = await fetchChecks()
      if (error) {
        toast.error(`DB error: ${error}`)
        setUsingDemo(true)
      } else {
        setLiveChecks(data)
      }
      setLoading(false)
    }
    load()
  }, [])

  const checks = usingDemo ? DEMO_CHECKS : liveChecks

  // Filter
  const filtered = checks.filter((c) => {
    if (typeFilter !== 'all' && c.check_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const typeLabel = CHECK_TYPE_CONFIG[c.check_type as keyof typeof CHECK_TYPE_CONFIG]?.label || c.check_type
      const areas = (c.areas || []).join(' ')
      const searchable = `${c.display_id} ${typeLabel} ${c.completed_by || ''} ${areas}`.toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })

  // Count by type
  const typeCounts = Object.keys(CHECK_TYPE_CONFIG).reduce((acc, key) => {
    acc[key] = checks.filter((c) => c.check_type === key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Check History</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>{checks.length} completed check{checks.length !== 1 ? 's' : ''}</div>
        </div>
        <Link
          href="/checks"
          style={{
            background: '#22C55E14', border: '1px solid #22C55E33', borderRadius: 8,
            padding: '8px 14px', color: '#22C55E', fontSize: 11, fontWeight: 600,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          + New Check
        </Link>
      </div>

      {/* Type Filter Chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          style={{
            padding: '6px 12px', borderRadius: 16, fontSize: 10, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap',
            background: typeFilter === 'all' ? '#22D3EE22' : '#1E293B',
            color: typeFilter === 'all' ? '#22D3EE' : '#64748B',
          }}
        >
          All ({checks.length})
        </button>
        {Object.entries(CHECK_TYPE_CONFIG).map(([key, cfg]) => {
          const count = typeCounts[key] || 0
          const active = typeFilter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(active ? 'all' : key)}
              style={{
                padding: '6px 12px', borderRadius: 16, fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap',
                background: active ? `${cfg.color}22` : '#1E293B',
                color: active ? cfg.color : '#64748B',
              }}
            >
              {cfg.icon} {cfg.label.replace(' Check', '').replace(' Reading', '')} ({count})
            </button>
          )
        })}
      </div>

      {/* Search */}
      <input
        className="input-dark"
        placeholder="Search checks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 10, fontSize: 12 }}
      />

      {/* Loading */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          Loading...
        </div>
      )}

      {/* Check Cards */}
      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          {search || typeFilter !== 'all' ? 'No checks match your filter.' : 'No checks completed yet.'}
        </div>
      )}

      {!loading && filtered.map((check) => {
        const cfg = CHECK_TYPE_CONFIG[check.check_type as keyof typeof CHECK_TYPE_CONFIG]
        const data = check.data as Record<string, unknown>

        // Build a summary line based on check type
        let summary = ''
        if (check.check_type === 'rcr' && data.rcr_value) summary = `RCR: ${data.rcr_value} — ${data.condition_type || 'N/A'}`
        else if (check.check_type === 'rsc' && data.condition) summary = `Condition: ${data.condition}`
        else if (check.check_type === 'bash' && data.condition_code) summary = `${data.condition_code}${data.species_observed ? ` — ${(data.species_observed as string).slice(0, 50)}` : ''}`
        else if ((check.check_type === 'ife' || check.check_type === 'ground_emergency') && data.nature) summary = `${data.aircraft_type || ''} ${data.callsign || ''} — ${data.nature}`.trim()
        else if (check.check_type === 'heavy_aircraft' && data.aircraft_type) summary = data.aircraft_type as string

        return (
          <Link
            key={check.id}
            href={`/checks/${check.id}`}
            className="card"
            style={{
              display: 'block', marginBottom: 6, cursor: 'pointer',
              textDecoration: 'none', color: 'inherit',
              borderLeft: `3px solid ${cfg?.color || '#64748B'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: '#22D3EE' }}>
                {check.display_id}
              </span>
              <Badge label={cfg?.label || check.check_type} color={cfg?.color || '#64748B'} />
            </div>

            {summary && (
              <div style={{ fontSize: 11, color: '#CBD5E1', marginBottom: 6, lineHeight: 1.4 }}>
                {summary}
              </div>
            )}

            {/* Areas */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              {(check.areas || []).map((area: string) => (
                <span key={area} style={{ fontSize: 9, color: '#64748B', background: '#1E293B', padding: '2px 6px', borderRadius: 4 }}>
                  {area}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#64748B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{check.completed_by || 'Unknown'}</span>
                {check.photo_count > 0 && (
                  <>
                    <span>&bull;</span>
                    <span>📷 {check.photo_count}</span>
                  </>
                )}
              </div>
              <span>
                {check.completed_at
                  ? `${new Date(check.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date(check.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                  : 'N/A'}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
