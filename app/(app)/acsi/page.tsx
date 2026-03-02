'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ACSI_STATUS_CONFIG } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { fetchAcsiInspections } from '@/lib/supabase/acsi-inspections'
import { DEMO_ACSI_INSPECTIONS } from '@/lib/demo-data'
import { useInstallation } from '@/lib/installation-context'
import type { AcsiInspection, AcsiStatus } from '@/lib/supabase/types'
import { Plus, ShieldCheck } from 'lucide-react'

const FILTERS = ['all', 'draft', 'in_progress', 'completed', 'staffed'] as const
const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  staffed: 'Staffed',
}

export default function AcsiListPage() {
  const { installationId } = useInstallation()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [inspections, setInspections] = useState<AcsiInspection[]>([])
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

      const data = await fetchAcsiInspections(installationId)
      setInspections(data)
      setLoading(false)
    }
    load()
  }, [installationId])

  const allItems = (usingDemo ? DEMO_ACSI_INSPECTIONS : inspections) as AcsiInspection[]
  const q = search.toLowerCase()

  const filtered = allItems.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (q && !item.display_id.toLowerCase().includes(q) && !item.airfield_name.toLowerCase().includes(q) && !(item.inspector_name || '').toLowerCase().includes(q)) return false
    return true
  })

  // KPI counts
  const totalCount = allItems.length
  const completedCount = allItems.filter(i => i.status === 'completed' || i.status === 'staffed').length
  const inProgressCount = allItems.filter(i => i.status === 'in_progress').length
  const draftCount = allItems.filter(i => i.status === 'draft').length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
            ACSI — Annual Compliance & Safety Inspection
          </h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', margin: '4px 0 0' }}>
            DAFMAN 13-204v2, Para 5.4.3
          </p>
        </div>
        <Link href="/acsi/new" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 18px',
          borderRadius: 8,
          background: 'var(--color-accent)',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 'var(--fs-base)',
        }}>
          <Plus size={16} /> Start New ACSI
        </Link>
      </div>

      {/* KPI Badges */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: totalCount, color: 'var(--color-text-1)' },
          { label: 'Completed', value: completedCount, color: '#10B981' },
          { label: 'In Progress', value: inProgressCount, color: '#3B82F6' },
          { label: 'Drafts', value: draftCount, color: '#9CA3AF' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '12px 20px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)',
            textAlign: 'center',
            minWidth: 100,
          }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: kpi.color }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search inspections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-input)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--fs-sm)',
            flex: 1,
            minWidth: 200,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: filter === f ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                background: filter === f ? 'var(--color-accent-glow)' : 'transparent',
                color: filter === f ? 'var(--color-accent)' : 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)',
                fontWeight: filter === f ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>
          Loading inspections...
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 60,
          color: 'var(--color-text-3)',
          border: '1px dashed var(--color-border)',
          borderRadius: 8,
        }}>
          <ShieldCheck size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 500 }}>No ACSI inspections found</div>
          <div style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>Click &ldquo;Start New ACSI&rdquo; to begin the annual inspection</div>
        </div>
      )}

      {/* Card list */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(insp => {
            const statusCfg = ACSI_STATUS_CONFIG[insp.status as AcsiStatus] || ACSI_STATUS_CONFIG.draft
            const total = insp.passed_count + insp.failed_count + insp.na_count
            const pct = insp.total_items > 0 ? Math.round((total / insp.total_items) * 100) : 0

            return (
              <Link
                key={insp.id}
                href={insp.status === 'draft' || insp.status === 'in_progress' ? `/acsi/new?resume=${insp.id}` : `/acsi/${insp.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-surface)',
                  textDecoration: 'none',
                  color: 'var(--color-text-1)',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Display ID + airfield */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-base)' }}>
                    {insp.display_id}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    {insp.airfield_name || 'Unnamed'} — {insp.fiscal_year}
                  </div>
                </div>

                {/* Date */}
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
                  {insp.inspection_date}
                </div>

                {/* Progress */}
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', whiteSpace: 'nowrap', minWidth: 50, textAlign: 'right' }}>
                  {pct}%
                </div>

                {/* Counts */}
                <div style={{ display: 'flex', gap: 6, fontSize: 'var(--fs-xs)' }}>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>{insp.passed_count}P</span>
                  <span style={{ color: '#EF4444', fontWeight: 600 }}>{insp.failed_count}F</span>
                  <span style={{ color: '#6B7280', fontWeight: 600 }}>{insp.na_count}NA</span>
                </div>

                {/* Status badge */}
                <Badge
                  label={statusCfg.label}
                  color={statusCfg.color}
                  bg={statusCfg.bg}
                />

                {/* Inspector */}
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', whiteSpace: 'nowrap', minWidth: 80 }}>
                  {insp.inspector_name || '—'}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
