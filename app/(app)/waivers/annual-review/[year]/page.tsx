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
import {
  ArrowLeft, Calendar as CalendarIcon, FileSpreadsheet,
  ChevronLeft, ChevronRight, Trash2,
  Lock, Clock, Construction, Calendar, RefreshCw, FileEdit,
} from 'lucide-react'

const CLASSIFICATION_ICON: Record<string, typeof Lock> = {
  lock: Lock,
  clock: Clock,
  construction: Construction,
  calendar: Calendar,
  refresh: RefreshCw,
  edit: FileEdit,
}

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
      {/* Back link */}
      <Link href="/waivers" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)',
        textDecoration: 'none', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Waivers
      </Link>

      {/* Page header — tertiary tier-label + amber accent rule */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, paddingBottom: 8, marginBottom: 14, flexWrap: 'wrap',
        borderBottom: '1px solid color-mix(in srgb, var(--color-amber) 30%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarIcon size={16} color="var(--color-amber)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Annual Review</div>
        </div>
        <button onClick={handleExport}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
            borderRadius: 'var(--radius-md)', padding: '6px 12px',
            color: 'var(--color-success)', fontSize: 'var(--fs-sm)', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <FileSpreadsheet size={14} /> Export Year Review
        </button>
      </div>

      {/* Year nav — outlined-pill arrows + cyan year label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, justifyContent: 'center' }}>
        <button onClick={() => { router.push(`/waivers/annual-review/${year - 1}`); setKpiFilter(null) }}
          aria-label="Previous year"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px',
            color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{year} Review</span>
        <button onClick={() => { router.push(`/waivers/annual-review/${year + 1}`); setKpiFilter(null) }} disabled={year >= currentYear}
          aria-label="Next year"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '6px 10px',
            color: year >= currentYear ? 'var(--color-text-4)' : 'var(--color-text-2)',
            cursor: year >= currentYear ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            opacity: year >= currentYear ? 0.5 : 1,
          }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'ACTIVE', key: 'active', value: activeWaivers.length, color: 'var(--color-purple)' },
          { label: 'REVIEWED', key: 'reviewed', value: reviewedCount, color: 'var(--color-success)' },
          { label: 'NOT REVIEWED', key: 'not_reviewed', value: notReviewedCount, color: notReviewedCount > 0 ? 'var(--color-danger)' : 'var(--color-success)' },
          { label: 'TO BOARD', key: 'to_board', value: boardCount, color: 'var(--color-blue)' },
        ].map(k => {
          const active = kpiFilter === k.key
          return (
            <div
              key={k.label}
              className="kpi-badge"
              onClick={() => setKpiFilter(active ? null : k.key)}
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
              <div className="kpi-label" style={{ color: active ? k.color : 'var(--color-text-3)' }}>{k.label}</div>
              <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
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
              <div key={w.id} className="card" style={{ marginBottom: 8, borderLeft: `3px solid ${reviewed ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
                <button
                  type="button"
                  onClick={() => setExpandedWaiver(isExpanded ? null : w.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <div>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{w.waiver_number}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {classInfo && (() => {
                        const Icon = CLASSIFICATION_ICON[classInfo.iconKey]
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 'var(--radius-full)',
                            background: 'color-mix(in srgb, var(--color-text-3) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--color-text-3) 30%, transparent)',
                            color: 'var(--color-text-2)',
                            fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.04em',
                          }}>
                            {Icon && <Icon size={10} />}
                            {classInfo.label.toUpperCase()}
                          </span>
                        )
                      })()}
                      <Badge label={reviewed ? 'Reviewed' : 'Not Reviewed'} color={reviewed ? 'var(--color-success)' : 'var(--color-danger)'} />
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
                      <div style={{
                        marginBottom: 8, padding: '6px 10px',
                        background: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--fs-sm)', color: 'var(--color-success)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span>Reviewed for {year}</span>
                        <button
                          onClick={() => review && handleDeleteReview(review.id, w.id)}
                          disabled={saving === w.id}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
                            borderRadius: 'var(--radius-md)',
                            padding: '3px 9px', color: 'var(--color-danger)',
                            fontSize: 'var(--fs-2xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            letterSpacing: '0.04em',
                          }}
                        >
                          <Trash2 size={11} /> REMOVE
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
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)', fontSize: 'var(--fs-base)', fontWeight: 600, textDecoration: 'none' }}>
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
