'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { DEMO_INSPECTIONS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { fetchInspections, type InspectionRow } from '@/lib/supabase/inspections'

export default function InspectionsPage() {
  const [liveInspections, setLiveInspections] = useState<InspectionRow[]>([])
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
      const data = await fetchInspections()
      if (data.length === 0) {
        // May not have any yet — check if Supabase is really working
        setLiveInspections(data)
      } else {
        setLiveInspections(data)
      }
      setLoading(false)
    }
    load()
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inspections: any[] = usingDemo ? DEMO_INSPECTIONS : liveInspections

  const filtered = inspections.filter((insp) => {
    if (typeFilter !== 'all' && insp.inspection_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const searchable = `${insp.display_id} ${insp.inspector_name || ''} ${insp.inspection_type} ${insp.weather_conditions || ''}`.toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })

  const airfieldCount = inspections.filter((i) => i.inspection_type === 'airfield').length
  const lightingCount = inspections.filter((i) => i.inspection_type === 'lighting').length

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Inspections</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>
            {inspections.length} completed inspection{inspections.length !== 1 ? 's' : ''}
          </div>
        </div>
        <Link
          href="/inspections/new"
          style={{
            background: '#22C55E14', border: '1px solid #22C55E33', borderRadius: 8,
            padding: '8px 14px', color: '#22C55E', fontSize: 11, fontWeight: 600,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          + New Inspection
        </Link>
      </div>

      {/* Type Filter Chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[
          { key: 'all', label: `All (${inspections.length})`, color: '#22D3EE' },
          { key: 'airfield', label: `Airfield (${airfieldCount})`, color: '#34D399' },
          { key: 'lighting', label: `Lighting (${lightingCount})`, color: '#FBBF24' },
        ].map((chip) => {
          const active = typeFilter === chip.key
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setTypeFilter(active && chip.key !== 'all' ? 'all' : chip.key)}
              style={{
                padding: '6px 12px', borderRadius: 16, fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap',
                background: active ? `${chip.color}22` : '#1E293B',
                color: active ? chip.color : '#64748B',
              }}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <input
        className="input-dark"
        placeholder="Search inspections..."
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

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
          {search || typeFilter !== 'all' ? 'No inspections match your filter.' : 'No inspections completed yet.'}
        </div>
      )}

      {/* Inspection Cards */}
      {!loading && filtered.map((insp) => {
        const isAirfield = insp.inspection_type === 'airfield'
        const borderColor = isAirfield ? '#34D399' : '#FBBF24'
        const typeLabel = isAirfield ? 'Airfield' : 'Lighting'
        const typeColor = isAirfield ? '#34D399' : '#FBBF24'

        return (
          <Link
            key={insp.id}
            href={`/inspections/${insp.id}`}
            className="card"
            style={{
              display: 'block', marginBottom: 6, cursor: 'pointer',
              textDecoration: 'none', color: 'inherit',
              borderLeft: `3px solid ${borderColor}`,
            }}
          >
            {/* Row 1: Display ID + Type Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: '#22D3EE' }}>
                {insp.display_id}
              </span>
              <Badge label={typeLabel} color={typeColor} />
            </div>

            {/* Row 2: Results summary */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11 }}>
              <span style={{ color: '#22C55E', fontWeight: 700 }}>{insp.passed_count} Pass</span>
              {insp.failed_count > 0 && (
                <span style={{ color: '#EF4444', fontWeight: 700 }}>{insp.failed_count} Fail</span>
              )}
              {insp.na_count > 0 && (
                <span style={{ color: '#64748B', fontWeight: 600 }}>{insp.na_count} N/A</span>
              )}
              <span style={{ color: '#475569' }}>/ {insp.total_items} items</span>
            </div>

            {/* Row 3: BWC if applicable */}
            {insp.bwc_value && (
              <div style={{ marginBottom: 6 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  color: insp.bwc_value === 'LOW' ? '#22C55E' : insp.bwc_value === 'MOD' ? '#EAB308' : insp.bwc_value === 'SEV' ? '#F97316' : '#EF4444',
                  background: insp.bwc_value === 'LOW' ? 'rgba(34,197,94,0.1)' : insp.bwc_value === 'MOD' ? 'rgba(234,179,8,0.1)' : insp.bwc_value === 'SEV' ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)',
                }}>
                  BWC: {insp.bwc_value}
                </span>
              </div>
            )}

            {/* Row 4: Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#64748B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{insp.inspector_name || 'Unknown'}</span>
                {insp.weather_conditions && (
                  <>
                    <span>&bull;</span>
                    <span>{insp.weather_conditions}{insp.temperature_f != null ? ` ${insp.temperature_f}°F` : ''}</span>
                  </>
                )}
              </div>
              <span>
                {insp.completed_at
                  ? `${new Date(insp.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date(insp.completed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                  : insp.inspection_date}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
