'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  fetchWaivers, fetchReviewsByYear, createWaiverReview, deleteWaiverReview,
  type WaiverRow, type WaiverReviewRow,
} from '@/lib/supabase/waivers'
import { DEMO_WAIVERS, DEMO_WAIVER_REVIEWS } from '@/lib/demo-data'
import { WAIVER_CLASSIFICATIONS, WAIVER_REVIEW_RECOMMENDATIONS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { toast } from 'sonner'
import type { WaiverReviewRecommendation } from '@/lib/supabase/types'

type ReviewFormState = {
  recommendation: WaiverReviewRecommendation
  mitigation_verified: boolean
  project_status_update: string
  notes: string
  presented_to_facilities_board: boolean
  facilities_board_date: string
}

const defaultReviewForm: ReviewFormState = {
  recommendation: 'retain',
  mitigation_verified: false,
  project_status_update: '',
  notes: '',
  presented_to_facilities_board: false,
  facilities_board_date: '',
}

export default function AnnualReviewYearPage() {
  const params = useParams()
  const router = useRouter()
  const { installationId } = useInstallation()
  const year = parseInt(params.year as string)
  const currentYear = new Date().getFullYear()
  const [waivers, setWaivers] = useState<WaiverRow[]>([])
  const [reviews, setReviews] = useState<WaiverReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [expandedWaiver, setExpandedWaiver] = useState<string | null>(null)
  const [reviewForms, setReviewForms] = useState<Record<string, ReviewFormState>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)

  const loadData = async () => {
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

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, year])

  const allWaivers = (usingDemo ? DEMO_WAIVERS : waivers) as WaiverRow[]
  const allReviews = (usingDemo ? DEMO_WAIVER_REVIEWS.filter(r => r.review_year === year) : reviews) as WaiverReviewRow[]

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

  const getForm = (waiverId: string): ReviewFormState => {
    if (reviewForms[waiverId]) return reviewForms[waiverId]
    const existing = allReviews.find(r => r.waiver_id === waiverId)
    if (existing) {
      return {
        recommendation: existing.recommendation || 'retain',
        mitigation_verified: existing.mitigation_verified,
        project_status_update: existing.project_status_update || '',
        notes: existing.notes || '',
        presented_to_facilities_board: existing.presented_to_facilities_board,
        facilities_board_date: existing.facilities_board_date || '',
      }
    }
    return defaultReviewForm
  }

  const updateForm = (waiverId: string, field: keyof ReviewFormState, value: unknown) => {
    setReviewForms(prev => ({
      ...prev,
      [waiverId]: { ...getForm(waiverId), [field]: value },
    }))
  }

  const handleSaveReview = async (waiverId: string) => {
    if (usingDemo) {
      toast.success('Review saved (demo mode)')
      setExpandedWaiver(null)
      return
    }

    setSaving(waiverId)
    const form = getForm(waiverId)
    const { error } = await createWaiverReview({
      waiver_id: waiverId,
      review_year: year,
      recommendation: form.recommendation,
      mitigation_verified: form.mitigation_verified,
      project_status_update: form.project_status_update || undefined,
      notes: form.notes || undefined,
      presented_to_facilities_board: form.presented_to_facilities_board,
      facilities_board_date: form.facilities_board_date || undefined,
    })

    if (error) {
      if (error.includes('waiver_reviews_waiver_id_review_year_key') || error.includes('duplicate key')) {
        toast.error(`This waiver has already been reviewed for ${year}`)
      } else {
        toast.error(error)
      }
    } else {
      toast.success('Review saved')
      await loadData()
    }
    setSaving(null)
    setExpandedWaiver(null)
  }

  const handleDeleteReview = async (reviewId: string, waiverId: string) => {
    if (usingDemo) {
      toast.success('Review removed (demo mode)')
      return
    }
    if (!confirm('Remove this review? This will also clear the waiver\'s last reviewed date.')) return

    setSaving(waiverId)
    const { error } = await deleteWaiverReview(reviewId, waiverId)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Review removed')
      setReviewForms(prev => { const next = { ...prev }; delete next[waiverId]; return next })
      await loadData()
    }
    setSaving(null)
  }

  const handleExport = async () => {
    const { generateAnnualReviewExcel } = await import('@/lib/waiver-export')
    generateAnnualReviewExcel(activeWaivers, allReviews, year, { name: 'Installation', icao: 'KMTC' })
  }

  const getClassInfo = (c: string) => WAIVER_CLASSIFICATIONS.find(t => t.value === c)

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Link href="/waivers" style={{ color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, textDecoration: 'none' }}>
          &larr; Waivers
        </Link>
        <button onClick={handleExport}
          style={{ background: '#10B98114', border: '1px solid #10B98133', borderRadius: 8, padding: '6px 10px', color: '#10B981', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Export Year Review
        </button>
      </div>

      {/* Year Header with Nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, justifyContent: 'center' }}>
        <button onClick={() => { router.push(`/waivers/annual-review/${year - 1}`); setKpiFilter(null) }}
          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', cursor: 'pointer', fontFamily: 'inherit' }}>
          &larr;
        </button>
        <span style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{year} Review</span>
        <button onClick={() => { router.push(`/waivers/annual-review/${year + 1}`); setKpiFilter(null) }} disabled={year >= currentYear}
          style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', color: year >= currentYear ? 'var(--color-text-4)' : 'var(--color-text-2)', fontSize: 'var(--fs-md)', cursor: 'pointer', fontFamily: 'inherit' }}>
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
              <div style={{ fontSize: 'var(--fs-2xs)', color: active ? k.color : 'var(--color-text-3)', letterSpacing: '0.08em', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', textAlign: 'center', marginBottom: 12 }}>
        {reviewedCount} of {activeWaivers.length} waivers reviewed
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading...</div>
      ) : (
        <>
          {filteredWaivers.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
              {activeWaivers.length === 0 ? 'No active waivers for review' : 'No waivers match this filter'}
            </div>
          )}

          {filteredWaivers.map(w => {
            const reviewed = reviewedIds.has(w.id)
            const review = allReviews.find(r => r.waiver_id === w.id)
            const isExpanded = expandedWaiver === w.id
            const classInfo = getClassInfo(w.classification)
            const form = getForm(w.id)

            return (
              <div key={w.id} className="card" style={{ marginBottom: 8, borderLeft: `3px solid ${reviewed ? '#22C55E' : '#EF4444'}` }}>
                <button
                  type="button"
                  onClick={() => setExpandedWaiver(isExpanded ? null : w.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{w.waiver_number}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {classInfo && <Badge label={`${classInfo.emoji} ${classInfo.label}`} color="#64748B" />}
                      <Badge label={reviewed ? 'Reviewed' : 'Not Reviewed'} color={reviewed ? '#22C55E' : '#EF4444'} />
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4, maxWidth: 280 }}>
                      {w.description.slice(0, 100)}{w.description.length > 100 ? '...' : ''}
                    </div>
                    {review && !isExpanded && (
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4 }}>
                        Recommendation: {review.recommendation ? review.recommendation.charAt(0).toUpperCase() + review.recommendation.slice(1) : ''} {review.presented_to_facilities_board ? '\u2022 Board briefed' : ''}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
                </button>

                {isExpanded && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                    {reviewed && (
                      <div style={{ marginBottom: 8, padding: '6px 8px', background: '#22C55E11', borderRadius: 6, fontSize: 'var(--fs-sm)', color: '#22C55E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Reviewed for {year}</span>
                        <button
                          onClick={() => review && handleDeleteReview(review.id, w.id)}
                          disabled={saving === w.id}
                          style={{ background: '#EF444414', border: '1px solid #EF444433', borderRadius: 4, padding: '2px 8px', color: '#EF4444', fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Remove Review
                        </button>
                      </div>
                    )}

                    {!reviewed && (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <span className="section-label">Recommendation</span>
                          <select className="input-dark" value={form.recommendation}
                            onChange={(e) => updateForm(w.id, 'recommendation', e.target.value)} style={{ width: '100%' }}>
                            {WAIVER_REVIEW_RECOMMENDATIONS.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.mitigation_verified}
                              onChange={(e) => updateForm(w.id, 'mitigation_verified', e.target.checked)} />
                            Mitigation measures verified
                          </label>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <span className="section-label">Project Status Update</span>
                          <input type="text" className="input-dark" placeholder="Current project status..."
                            value={form.project_status_update}
                            onChange={(e) => updateForm(w.id, 'project_status_update', e.target.value)} />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <span className="section-label">Notes</span>
                          <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }}
                            value={form.notes}
                            onChange={(e) => updateForm(w.id, 'notes', e.target.value)} />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.presented_to_facilities_board}
                              onChange={(e) => updateForm(w.id, 'presented_to_facilities_board', e.target.checked)} />
                            Presented to Facilities Board
                          </label>
                        </div>

                        {form.presented_to_facilities_board && (
                          <div style={{ marginBottom: 12 }}>
                            <span className="section-label">Board Date</span>
                            <input type="date" className="input-dark" value={form.facilities_board_date}
                              onChange={(e) => updateForm(w.id, 'facilities_board_date', e.target.value)} />
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Link href={`/waivers/${w.id}`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', color: 'var(--color-text-2)', fontSize: 'var(--fs-base)', fontWeight: 600, textDecoration: 'none' }}>
                        View Detail
                      </Link>
                      {!reviewed && (
                        <button className="btn-primary" onClick={() => handleSaveReview(w.id)} disabled={saving === w.id}
                          style={{ opacity: saving === w.id ? 0.7 : 1 }}>
                          {saving === w.id ? 'Saving...' : 'Mark Reviewed'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
