'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { fetchWaivers, fetchAllWaiverCriteria, fetchAllWaiverReviews, type WaiverRow } from '@/lib/supabase/waivers'
import { DEMO_WAIVERS, DEMO_WAIVER_CRITERIA, DEMO_WAIVER_REVIEWS } from '@/lib/demo-data'
import { WAIVER_STATUS_CONFIG, WAIVER_CLASSIFICATIONS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { Map, List, FileWarning, Calendar, FileSpreadsheet, Plus, AlertCircle } from 'lucide-react'

// Classification → color map. Operationally the two big categories
// are temporary (time-bounded, requires annual review + corrective
// action) and permanent (stable, no review needed). Color them
// differently so the type is scannable at row level. Other
// classifications stay neutral.
const CLASSIFICATION_COLORS: Record<string, string> = {
  permanent: 'var(--color-success)',
  temporary: 'var(--color-warning)',
  construction: 'var(--color-cyan)',
  event: 'var(--color-purple)',
  extension: 'var(--color-text-3)',
  amendment: 'var(--color-text-3)',
}

// Expiration proximity → date color. Surfaces rows approaching
// their expiration without the user having to scan dates.
function expirationColor(expirationDate: string | null, status: string): string {
  if (!expirationDate || !['active', 'approved'].includes(status)) {
    return 'var(--color-text-3)'
  }
  const daysToExpire = Math.floor(
    (new Date(expirationDate).getTime() - Date.now()) / 86400000
  )
  if (daysToExpire <= 30) return 'var(--color-danger)'
  if (daysToExpire <= 90) return 'var(--color-warning)'
  if (daysToExpire <= 365) return 'var(--color-text-2)'
  return 'var(--color-text-3)'
}
import { formatZuluDate } from '@/lib/utils'

const WaiverMapView = lazy(() => import('@/components/waivers/waiver-map-view-google'))

const FILTERS = ['all', 'draft', 'pending', 'approved', 'active', 'completed', 'expired', 'cancelled'] as const
const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  active: 'Active',
  completed: 'Closed',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export default function WaiversPage() {
  const { installationId } = useInstallation()
  const [filter, setFilter] = useState<string>('all')
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
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

  const allItems = (usingDemo ? DEMO_WAIVERS : waivers) as WaiverRow[]
  const q = search.toLowerCase()

  const matchesSearch = (w: WaiverRow) =>
    !q || w.waiver_number.toLowerCase().includes(q) || w.description.toLowerCase().includes(q) ||
    (w.criteria_impact || '').toLowerCase().includes(q) || (w.proponent || '').toLowerCase().includes(q)

  const isPermanent = (w: WaiverRow) => w.classification === 'permanent' && (w.status === 'active' || w.status === 'approved')
  const isTemporary = (w: WaiverRow) => w.classification === 'temporary' && (w.status === 'active' || w.status === 'approved')
  const isExpiring = (w: WaiverRow) => {
    if (!['active', 'approved'].includes(w.status) || !w.expiration_date) return false
    const daysLeft = Math.floor((new Date(w.expiration_date).getTime() - Date.now()) / 86400000)
    return daysLeft >= 0 && daysLeft <= 365
  }
  const isOverdueReview = (w: WaiverRow) => {
    if (!['active', 'approved'].includes(w.status)) return false
    if (!w.next_review_due) return false
    return new Date(w.next_review_due).getTime() < Date.now()
  }

  const kpiPredicates: Record<string, (w: WaiverRow) => boolean> = {
    permanent: isPermanent,
    temporary: isTemporary,
    expiring: isExpiring,
    overdue: isOverdueReview,
  }

  const permanentCount = allItems.filter(isPermanent).length
  const temporaryCount = allItems.filter(isTemporary).length
  const expiringCount = allItems.filter(isExpiring).length
  const overdueReviewCount = allItems.filter(isOverdueReview).length

  const filtered = allItems
    .filter(w => kpiFilter ? kpiPredicates[kpiFilter](w) : (filter === 'all' || w.status === filter))
    .filter(matchesSearch)

  const getClassInfo = (c: string) => WAIVER_CLASSIFICATIONS.find(t => t.value === c)
  const getStatusConfig = (status: string) => WAIVER_STATUS_CONFIG[status as keyof typeof WAIVER_STATUS_CONFIG]
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return formatZuluDate(new Date(dateStr))
  }

  const handleExport = async () => {
    const { generateWaiverExcel } = await import('@/lib/waiver-export')
    let criteria, reviews
    if (usingDemo) {
      criteria = DEMO_WAIVER_CRITERIA
      reviews = DEMO_WAIVER_REVIEWS
    } else {
      ;[criteria, reviews] = await Promise.all([
        fetchAllWaiverCriteria(installationId || ''),
        fetchAllWaiverReviews(installationId || ''),
      ])
    }
    generateWaiverExcel(allItems, criteria, reviews, { name: 'Installation', icao: 'KMTC' })
  }

  return (
    <div className="page-container">
      {/* Page header — tertiary tier-label + amber accent rule (waiver
          = exception/risk semantic). */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, paddingBottom: 8, marginBottom: 14, flexWrap: 'wrap',
        borderBottom: '1px solid color-mix(in srgb, var(--color-amber) 30%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileWarning size={16} color="var(--color-amber)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Waivers</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link
            href={`/waivers/annual-review/${new Date().getFullYear()}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'color-mix(in srgb, var(--color-amber) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-amber) 35%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              color: 'var(--color-amber)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <Calendar size={14} /> Annual Review
          </Link>
          <button
            onClick={handleExport}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              color: 'var(--color-success)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>
          <Link
            href="/waivers/new"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              color: 'var(--color-cyan)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <Plus size={14} /> New Waiver
          </Link>
        </div>
      </div>

      <div className="kpi-grid-2" style={{ marginBottom: 12 }}>
        {[
          { label: 'PERMANENT', key: 'permanent', value: permanentCount, color: 'var(--color-purple)' },
          { label: 'TEMPORARY', key: 'temporary', value: temporaryCount, color: 'var(--color-blue)' },
          { label: 'EXPIRING ≤12MO', key: 'expiring', value: expiringCount, color: expiringCount > 0 ? 'var(--color-amber)' : 'var(--color-success)' },
          { label: 'OVERDUE REVIEW', key: 'overdue', value: overdueReviewCount, color: overdueReviewCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' },
        ].map((k) => {
          const active = kpiFilter === k.key
          return (
            <div
              key={k.label}
              className="kpi-badge"
              onClick={() => { setKpiFilter(active ? null : k.key); setFilter('all') }}
              style={{
                background: active
                  ? `color-mix(in srgb, ${k.color} 14%, transparent)`
                  : undefined,
                border: active
                  ? `1px solid color-mix(in srgb, ${k.color} 45%, transparent)`
                  : '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              <div className="kpi-label" style={{ color: active ? k.color : 'var(--color-text-3)' }}>
                {k.label}
              </div>
              <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div className="filter-bar" style={{ flex: 1 }}>
          {FILTERS.map((v) => {
            const selected = filter === v
            return (
              <button
                key={v}
                onClick={() => { setFilter(v); setKpiFilter(null) }}
                style={{
                  background: selected
                    ? 'color-mix(in srgb, var(--color-cyan) 14%, var(--color-bg-surface))'
                    : 'var(--color-bg-inset)',
                  border: selected
                    ? '1px solid var(--color-cyan)'
                    : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '5px 11px',
                  color: selected ? 'var(--color-cyan)' : 'var(--color-text-2)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {FILTER_LABELS[v]}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setViewMode('map')}
            title="Map view"
            aria-label="Map view"
            style={{
              background: viewMode === 'map'
                ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                : 'transparent',
              border: 'none',
              borderRight: '1px solid var(--color-border)',
              padding: '6px 10px',
              color: viewMode === 'map' ? 'var(--color-cyan)' : 'var(--color-text-3)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Map size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            aria-label="List view"
            style={{
              background: viewMode === 'list'
                ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                : 'transparent',
              border: 'none',
              padding: '6px 10px',
              color: viewMode === 'list' ? 'var(--color-cyan)' : 'var(--color-text-3)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search waiver number, description, proponent..."
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
          fontSize: 'var(--fs-md)',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
          Loading...
        </div>
      ) : (
        <>
          {/* Map — shown when viewMode is 'map' */}
          {viewMode === 'map' && (
            <Suspense
              fallback={
                <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
                  Loading map...
                </div>
              }
            >
              <WaiverMapView waivers={filtered} />
            </Suspense>
          )}

          {/* Card list — always shown (below map when in map mode) */}
          {viewMode === 'map' && filtered.length > 0 && (
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              All Waivers ({filtered.length})
            </div>
          )}
          {filtered.map((w) => {
            const classInfo = getClassInfo(w.classification)
            const statusConf = getStatusConfig(w.status)
            // Days-to-expire: drives both the rail color (urgency
            // override) and the inline expiration date color.
            const daysToExpire = w.expiration_date && ['active', 'approved'].includes(w.status)
              ? Math.floor((new Date(w.expiration_date).getTime() - Date.now()) / 86400000)
              : null
            // Rail color: urgency override (within 90 days) takes
            // precedence over status, matching the NOTAMs precedent.
            const railColor = daysToExpire != null && daysToExpire <= 30
              ? 'var(--color-danger)'
              : daysToExpire != null && daysToExpire <= 90
                ? 'var(--color-warning)'
                : statusConf?.color ?? 'var(--color-text-4)'
            const expColor = expirationColor(w.expiration_date, w.status)
            const expiringWithin30 = daysToExpire != null && daysToExpire <= 30
            const classColor = CLASSIFICATION_COLORS[w.classification] ?? 'var(--color-text-3)'
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
                  borderLeft: `3px solid ${railColor}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>
                    {w.waiver_number}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {statusConf && <Badge label={statusConf.label} color={statusConf.color} bg={statusConf.bg} />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                  {classInfo && <Badge label={`${classInfo.emoji} ${classInfo.label}`} color={classColor} />}
                </div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', lineHeight: 1.5, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {w.description}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {w.location_description && <span>{w.location_description}</span>}
                  {w.expiration_date && (
                    <>
                      {w.location_description && <span>&bull;</span>}
                      <span style={{
                        color: expColor,
                        fontWeight: expiringWithin30 ? 700 : 400,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        {expiringWithin30 && <AlertCircle size={12} />}
                        Expires {formatDate(w.expiration_date)}
                      </span>
                    </>
                  )}
                  {w.period_valid && !w.expiration_date && (
                    <>
                      {w.location_description && <span>&bull;</span>}
                      <span>{w.period_valid}</span>
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
          No waivers match this filter
        </div>
      )}
    </div>
  )
}
