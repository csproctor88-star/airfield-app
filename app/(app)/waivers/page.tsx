'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { fetchWaivers, fetchAllWaiverCriteria, fetchAllWaiverReviews, type WaiverRow } from '@/lib/supabase/waivers'
import { DEMO_WAIVERS, DEMO_WAIVER_CRITERIA, DEMO_WAIVER_REVIEWS } from '@/lib/demo-data'
import { WAIVER_STATUS_CONFIG, WAIVER_CLASSIFICATIONS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'

const FILTERS = ['all', 'draft', 'pending', 'approved', 'active', 'completed', 'expired', 'cancelled'] as const
const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  active: 'Active',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export default function WaiversPage() {
  const { installationId } = useInstallation()
  const [filter, setFilter] = useState<string>('all')
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)
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
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Waivers</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link
            href="/waivers/annual-review"
            style={{
              background: '#F59E0B14',
              border: '1px solid #F59E0B33',
              borderRadius: 8,
              padding: '7px 10px',
              color: '#F59E0B',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Annual Review
          </Link>
          <button
            onClick={handleExport}
            style={{
              background: '#10B98114',
              border: '1px solid #10B98133',
              borderRadius: 8,
              padding: '7px 10px',
              color: '#10B981',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Export Excel
          </button>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'PERMANENT', key: 'permanent', value: permanentCount, color: '#8B5CF6' },
          { label: 'TEMPORARY', key: 'temporary', value: temporaryCount, color: '#3B82F6' },
          { label: 'EXPIRING ≤12MO', key: 'expiring', value: expiringCount, color: expiringCount > 0 ? '#F59E0B' : '#34D399' },
          { label: 'OVERDUE REVIEW', key: 'overdue', value: overdueReviewCount, color: overdueReviewCount > 0 ? '#EF4444' : '#34D399' },
        ].map((k) => {
          const active = kpiFilter === k.key
          return (
            <div
              key={k.label}
              onClick={() => { setKpiFilter(active ? null : k.key); setFilter('all') }}
              style={{
                background: active ? `${k.color}14` : 'var(--color-bg-surface)',
                border: `1px solid ${active ? `${k.color}44` : 'var(--color-border)'}`,
                borderRadius: 10,
                padding: '10px 6px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 10, color: active ? k.color : 'var(--color-text-3)', letterSpacing: '0.08em', fontWeight: 600 }}>
                {k.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTERS.map((v) => (
          <button
            key={v}
            onClick={() => { setFilter(v); setKpiFilter(null) }}
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
            const classInfo = getClassInfo(w.classification)
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
                    {w.waiver_number}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {statusConf && <Badge label={statusConf.label} color={statusConf.color} bg={statusConf.bg} />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                  {classInfo && <Badge label={`${classInfo.emoji} ${classInfo.label}`} color="#64748B" />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {w.description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {w.location_description && <span>{w.location_description}</span>}
                  {w.expiration_date && (
                    <>
                      {w.location_description && <span>&bull;</span>}
                      <span>Expires {formatDate(w.expiration_date)}</span>
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
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 13 }}>
          No waivers match this filter
        </div>
      )}
    </div>
  )
}
