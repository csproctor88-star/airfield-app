'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { fetchWaivers, fetchReviewsByYear, type WaiverRow, type WaiverReviewRow } from '@/lib/supabase/waivers'
import { DEMO_WAIVERS, DEMO_WAIVER_REVIEWS } from '@/lib/demo-data'
import { WAIVER_STATUS_CONFIG, WAIVER_CLASSIFICATIONS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'

export default function AnnualReviewPage() {
  const { installationId } = useInstallation()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [waivers, setWaivers] = useState<WaiverRow[]>([])
  const [reviews, setReviews] = useState<WaiverReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setUsingDemo(true)
        setLoading(false)
        return
      }

      const [w, r] = await Promise.all([
        fetchWaivers(installationId),
        fetchReviewsByYear(installationId || '', year),
      ])
      setWaivers(w)
      setReviews(r)
      setLoading(false)
    }
    load()
  }, [installationId, year])

  const allWaivers = (usingDemo ? DEMO_WAIVERS : waivers) as WaiverRow[]
  const allReviews = (usingDemo ? DEMO_WAIVER_REVIEWS.filter(r => r.review_year === year) : reviews) as WaiverReviewRow[]

  // Only active/approved waivers need review
  const activeWaivers = allWaivers.filter(w => ['active', 'approved'].includes(w.status))
  const reviewedIds = new Set(allReviews.map(r => r.waiver_id))
  const reviewedCount = activeWaivers.filter(w => reviewedIds.has(w.id)).length
  const notReviewedCount = activeWaivers.length - reviewedCount
  const boardCount = allReviews.filter(r => r.presented_to_facilities_board).length

  const kpiPredicates: Record<string, (w: WaiverRow) => boolean> = {
    active: () => true,
    reviewed: (w) => reviewedIds.has(w.id),
    not_reviewed: (w) => !reviewedIds.has(w.id),
    to_board: (w) => allReviews.some(r => r.waiver_id === w.id && r.presented_to_facilities_board),
  }

  const filteredWaivers = kpiFilter ? activeWaivers.filter(kpiPredicates[kpiFilter]) : activeWaivers

  const handleExport = async () => {
    const { generateAnnualReviewExcel } = await import('@/lib/waiver-export')
    generateAnnualReviewExcel(activeWaivers, allReviews, year, { name: 'Installation', icao: 'KMTC' })
  }

  const getClassInfo = (c: string) => WAIVER_CLASSIFICATIONS.find(t => t.value === c)
  const getStatusConfig = (s: string) => WAIVER_STATUS_CONFIG[s as keyof typeof WAIVER_STATUS_CONFIG]

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Link href="/waivers" style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'none' }}>
          &larr; Waivers
        </Link>
        <button onClick={handleExport}
          style={{ background: '#10B98114', border: '1px solid #10B98133', borderRadius: 8, padding: '6px 10px', color: '#10B981', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Export Year Review
        </button>
      </div>

      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Annual Waiver Review</div>

      {/* Year Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, justifyContent: 'center' }}>
        <button onClick={() => { setYear(y => y - 1); setKpiFilter(null) }} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--color-text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          &larr;
        </button>
        <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{year}</span>
        <button onClick={() => { setYear(y => y + 1); setKpiFilter(null) }} disabled={year >= currentYear}
          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', color: year >= currentYear ? 'var(--color-text-4)' : 'var(--color-text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          &rarr;
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'ACTIVE', key: 'active', value: activeWaivers.length, color: '#8B5CF6' },
          { label: 'REVIEWED', key: 'reviewed', value: reviewedCount, color: '#22C55E' },
          { label: 'NOT REVIEWED', key: 'not_reviewed', value: notReviewedCount, color: notReviewedCount > 0 ? '#EF4444' : '#22C55E' },
          { label: 'TO BOARD', key: 'to_board', value: boardCount, color: '#3B82F6' },
        ].map(k => {
          const active = kpiFilter === k.key
          return (
            <div
              key={k.label}
              onClick={() => setKpiFilter(active ? null : k.key)}
              style={{
                background: active ? `${k.color}14` : 'var(--color-bg-surface)',
                border: `1px solid ${active ? `${k.color}44` : 'var(--color-border)'}`,
                borderRadius: 10, padding: '8px 4px', textAlign: 'center', cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 9, color: active ? k.color : 'var(--color-text-3)', letterSpacing: '0.08em', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 13 }}>Loading...</div>
      ) : (
        <>
          {filteredWaivers.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 13 }}>
              {activeWaivers.length === 0 ? 'No active waivers for review' : 'No waivers match this filter'}
            </div>
          )}

          {filteredWaivers.map(w => {
            const reviewed = reviewedIds.has(w.id)
            const review = allReviews.find(r => r.waiver_id === w.id)
            const classInfo = getClassInfo(w.classification)
            const statusConf = getStatusConfig(w.status)

            return (
              <Link
                key={w.id}
                href={`/waivers/annual-review/${year}?highlight=${w.id}`}
                className="card"
                style={{ display: 'block', marginBottom: 8, textDecoration: 'none', color: 'inherit', borderLeft: `3px solid ${reviewed ? '#22C55E' : '#EF4444'}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{w.waiver_number}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Badge label={reviewed ? 'Reviewed' : 'Not Reviewed'} color={reviewed ? '#22C55E' : '#EF4444'} />
                    {statusConf && <Badge label={statusConf.label} color={statusConf.color} bg={statusConf.bg} />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {classInfo && <Badge label={`${classInfo.emoji} ${classInfo.label}`} color="#64748B" />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {w.description}
                </div>
                {review && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 4 }}>
                    Recommendation: {review.recommendation} {review.presented_to_facilities_board ? '• Board briefed' : ''}
                  </div>
                )}
              </Link>
            )
          })}
        </>
      )}
    </div>
  )
}
