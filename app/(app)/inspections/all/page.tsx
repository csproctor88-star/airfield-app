'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { fetchInspections, type InspectionRow } from '@/lib/supabase/inspections'
import { fetchAcsiInspections } from '@/lib/supabase/acsi-inspections'
import { DEMO_INSPECTIONS, DEMO_ACSI_INSPECTIONS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import type { AcsiInspection } from '@/lib/supabase/types'

type InspectionCategory = 'all' | 'daily' | 'acsi' | 'construction' | 'joint_monthly'

const CATEGORY_CONFIG: Record<InspectionCategory, { label: string; color: string; icon: string; description: string }> = {
  all:              { label: 'All',                   color: '#22D3EE', icon: '📋', description: 'All inspection types' },
  daily:            { label: 'Daily Airfield',        color: '#10B981', icon: '✈️', description: 'DAFI 13-213 daily airfield & lighting inspections' },
  acsi:             { label: 'ACSI',                  color: '#8B5CF6', icon: '🛡️', description: 'DAFMAN 13-204v2, Para 5.4.3 annual compliance inspection' },
  construction:     { label: 'Pre/Post Construction', color: '#F59E0B', icon: '🏗️', description: 'Construction zone safety coordination inspections' },
  joint_monthly:    { label: 'Joint Monthly',         color: '#3B82F6', icon: '🤝', description: 'Monthly joint airfield inspection with CE & Safety' },
}

export default function AllInspectionsPage() {
  const { installationId } = useInstallation()
  const [inspections, setInspections] = useState<InspectionRow[]>([])
  const [acsiInspections, setAcsiInspections] = useState<AcsiInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<InspectionCategory>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setInspections(DEMO_INSPECTIONS as unknown as InspectionRow[])
        setAcsiInspections(DEMO_ACSI_INSPECTIONS as unknown as AcsiInspection[])
        setLoading(false)
        return
      }
      const [insps, acsis] = await Promise.all([
        fetchInspections(installationId),
        fetchAcsiInspections(installationId),
      ])
      setInspections(insps)
      setAcsiInspections(acsis)
      setLoading(false)
    }
    load()
  }, [installationId])

  // Compute counts
  const dailyInspections = inspections.filter(i =>
    i.inspection_type === 'airfield' || i.inspection_type === 'lighting'
  )
  const constructionInspections = inspections.filter(i =>
    i.inspection_type === 'construction_meeting' || i.construction_meeting
  )
  const jointMonthlyInspections = inspections.filter(i =>
    i.inspection_type === 'joint_monthly' || i.joint_monthly
  )

  const counts: Record<InspectionCategory, number> = {
    all: inspections.length + acsiInspections.length,
    daily: dailyInspections.length,
    acsi: acsiInspections.length,
    construction: constructionInspections.length,
    joint_monthly: jointMonthlyInspections.length,
  }

  // Build unified list for display
  type UnifiedItem = {
    id: string
    displayId: string
    category: InspectionCategory
    date: string
    status: string
    completedBy: string
    detail: string
    href: string
    color: string
    icon: string
  }

  const items: UnifiedItem[] = []

  for (const insp of inspections) {
    let cat: InspectionCategory = 'daily'
    if (insp.inspection_type === 'construction_meeting' || insp.construction_meeting) cat = 'construction'
    else if (insp.inspection_type === 'joint_monthly' || insp.joint_monthly) cat = 'joint_monthly'

    if (filter !== 'all' && filter !== cat) continue

    const cfg = CATEGORY_CONFIG[cat]
    items.push({
      id: insp.id,
      displayId: insp.display_id,
      category: cat,
      date: insp.completed_at || insp.created_at,
      status: insp.status,
      completedBy: insp.completed_by_name || insp.saved_by_name || '',
      detail: `${insp.passed_count}Y / ${insp.failed_count}N / ${insp.na_count}NA — ${insp.completion_percent}%`,
      href: `/inspections/${insp.id}`,
      color: cfg.color,
      icon: cfg.icon,
    })
  }

  for (const acsi of acsiInspections) {
    if (filter !== 'all' && filter !== 'acsi') continue
    const cfg = CATEGORY_CONFIG.acsi
    items.push({
      id: acsi.id,
      displayId: acsi.display_id,
      category: 'acsi',
      date: acsi.inspection_date || acsi.created_at,
      status: acsi.status,
      completedBy: acsi.inspector_name || '',
      detail: `${acsi.passed_count}Y / ${acsi.failed_count}N / ${acsi.na_count}NA — FY${acsi.fiscal_year}`,
      href: `/acsi/${acsi.id}`,
      color: cfg.color,
      icon: cfg.icon,
    })
  }

  // Sort by date descending
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const statusColor = (s: string) => {
    if (s === 'completed' || s === 'staffed') return '#10B981'
    if (s === 'in_progress') return '#F59E0B'
    return '#6B7280'
  }

  return (
    <div className="page-container">
      {/* Header */}
      <Link href="/more" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Back to More
      </Link>

      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 4 }}>
        All Inspections
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
        Unified view of all inspection types
      </div>

      {/* KPI Badges */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}>
        {(Object.entries(CATEGORY_CONFIG) as [InspectionCategory, typeof CATEGORY_CONFIG[InspectionCategory]][])
          .filter(([key]) => key !== 'all')
          .map(([key, cfg]) => {
            const active = filter === key
            return (
              <div
                key={key}
                className="kpi-badge"
                onClick={() => setFilter(active ? 'all' : key)}
                style={{
                  cursor: 'pointer',
                  border: active ? `2px solid ${cfg.color}` : '1px solid var(--color-border)',
                  background: active ? `${cfg.color}12` : 'var(--color-bg-surface)',
                }}
              >
                <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 2 }}>{cfg.icon}</div>
                <div className="kpi-value" style={{ color: cfg.color }}>{counts[key]}</div>
                <div className="kpi-label">{cfg.label}</div>
              </div>
            )
          })
        }
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link href="/inspections" style={{
          flex: 1, minWidth: 120, padding: '10px 12px', borderRadius: 8, textAlign: 'center',
          background: `${CATEGORY_CONFIG.daily.color}14`, border: `1px solid ${CATEGORY_CONFIG.daily.color}33`,
          color: CATEGORY_CONFIG.daily.color, fontSize: 'var(--fs-sm)', fontWeight: 700,
          textDecoration: 'none',
        }}>
          + New Daily Inspection
        </Link>
        <Link href="/acsi/new" style={{
          flex: 1, minWidth: 120, padding: '10px 12px', borderRadius: 8, textAlign: 'center',
          background: `${CATEGORY_CONFIG.acsi.color}14`, border: `1px solid ${CATEGORY_CONFIG.acsi.color}33`,
          color: CATEGORY_CONFIG.acsi.color, fontSize: 'var(--fs-sm)', fontWeight: 700,
          textDecoration: 'none',
        }}>
          + New ACSI
        </Link>
      </div>

      {/* Filter active indicator */}
      {filter !== 'all' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          padding: '8px 12px', borderRadius: 8,
          background: `${CATEGORY_CONFIG[filter].color}10`,
          border: `1px solid ${CATEGORY_CONFIG[filter].color}22`,
        }}>
          <span style={{ fontSize: 'var(--fs-xl)' }}>{CATEGORY_CONFIG[filter].icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: CATEGORY_CONFIG[filter].color }}>
              {CATEGORY_CONFIG[filter].label}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              {CATEGORY_CONFIG[filter].description}
            </div>
          </div>
          <button
            onClick={() => setFilter('all')}
            style={{
              background: 'none', border: 'none', color: 'var(--color-text-3)',
              cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: '4px 8px',
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Inspection list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, color: 'var(--color-text-3)',
          border: '1px solid var(--color-border)', borderRadius: 10,
          background: 'var(--color-bg-surface)',
        }}>
          {filter !== 'all'
            ? `No ${CATEGORY_CONFIG[filter].label} inspections found.`
            : 'No inspections found.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(item => (
            <Link
              key={`${item.category}-${item.id}`}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', borderRadius: 10,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: `${item.color}14`, border: `1px solid ${item.color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--fs-xl)',
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 'var(--fs-base)', fontWeight: 700, fontFamily: 'monospace',
                    color: item.color,
                  }}>
                    {item.displayId}
                  </span>
                  <span style={{
                    fontSize: 'var(--fs-2xs)', fontWeight: 700,
                    padding: '1px 6px', borderRadius: 4,
                    background: `${statusColor(item.status)}18`,
                    color: statusColor(item.status),
                    textTransform: 'uppercase',
                  }}>
                    {item.status}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                  {item.detail}
                  {item.completedBy ? ` — ${item.completedBy}` : ''}
                </div>
              </div>
              <div style={{
                fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', whiteSpace: 'nowrap',
              }}>
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <span style={{ color: 'var(--color-text-4)', fontSize: 'var(--fs-lg)' }}>›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
