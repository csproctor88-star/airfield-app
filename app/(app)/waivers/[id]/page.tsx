'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ActionButton } from '@/components/ui/button'
import {
  fetchWaiver, updateWaiverStatus, deleteWaiver,
  fetchWaiverCriteria, fetchWaiverAttachments, fetchWaiverReviews, fetchWaiverCoordination,
  uploadWaiverAttachment, createWaiverReview, deleteWaiverReview, upsertWaiverCoordination,
  updateWaiverCoordination, deleteWaiverCoordination,
  type WaiverRow, type WaiverCriteriaRow, type WaiverAttachmentRow, type WaiverReviewRow, type WaiverCoordinationRow,
} from '@/lib/supabase/waivers'
import { createClient } from '@/lib/supabase/client'
import { DEMO_WAIVERS, DEMO_WAIVER_CRITERIA, DEMO_WAIVER_REVIEWS, DEMO_WAIVER_COORDINATION } from '@/lib/demo-data'
import {
  WAIVER_STATUS_CONFIG, WAIVER_CLASSIFICATIONS, WAIVER_HAZARD_RATINGS, WAIVER_TRANSITIONS,
  WAIVER_COORDINATION_OFFICES, WAIVER_REVIEW_RECOMMENDATIONS, WAIVER_CRITERIA_SOURCES,
} from '@/lib/constants'
import { useInstallation } from '@/lib/installation-context'
import { toast } from 'sonner'
import type { WaiverStatus, WaiverCoordinationOffice, WaiverCoordinationStatus, WaiverAttachmentType, WaiverReviewRecommendation } from '@/lib/supabase/types'

type ModalType = 'approve' | 'coordination' | 'review' | 'attachment' | null

export default function WaiverDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { userRole } = useInstallation()
  const [waiver, setWaiver] = useState<WaiverRow | null>(null)
  const [criteria, setCriteria] = useState<WaiverCriteriaRow[]>([])
  const [attachments, setAttachments] = useState<WaiverAttachmentRow[]>([])
  const [reviews, setReviews] = useState<WaiverReviewRow[]>([])
  const [coordination, setCoordination] = useState<WaiverCoordinationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    criteria: false,
    coordination: false,
    attachments: false,
    reviews: false,
    notes: false,
  })

  // Approve modal state
  const [approveDate, setApproveDate] = useState('')
  const [approveExpiration, setApproveExpiration] = useState('')

  // Coordination modal state
  const [coordOffice, setCoordOffice] = useState<WaiverCoordinationOffice>('civil_engineer')
  const [coordLabel, setCoordLabel] = useState('')
  const [coordStatus, setCoordStatus] = useState<WaiverCoordinationStatus>('concur')
  const [coordComments, setCoordComments] = useState('')

  // Review modal state
  const [reviewRecommendation, setReviewRecommendation] = useState<WaiverReviewRecommendation>('retain')
  const [reviewMitigation, setReviewMitigation] = useState(false)
  const [reviewProjectUpdate, setReviewProjectUpdate] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewBoard, setReviewBoard] = useState(false)
  const [reviewBoardDate, setReviewBoardDate] = useState('')

  // Attachment modal state
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [attachType, setAttachType] = useState<WaiverAttachmentType>('photo')
  const [attachCaption, setAttachCaption] = useState('')
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false)
  const touchStartX = useRef(0)
  const touchDeltaX = useRef(0)
  const didSwipe = useRef(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }

    const id = params.id as string
    const [w, cr, at, rv, co] = await Promise.all([
      fetchWaiver(id),
      fetchWaiverCriteria(id),
      fetchWaiverAttachments(id),
      fetchWaiverReviews(id),
      fetchWaiverCoordination(id),
    ])
    setWaiver(w)
    setCriteria(cr)
    setAttachments(at)
    setReviews(rv)
    setCoordination(co)
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Generate signed URLs for all attachments
  useEffect(() => {
    if (attachments.length === 0) return
    const supabase = createClient()
    if (!supabase) return

    Promise.all(
      attachments.map(async (a) => {
        const { data } = await supabase.storage
          .from('waiver-attachments')
          .createSignedUrl(a.file_path, 3600)
        return { id: a.id, url: data?.signedUrl || '' }
      })
    ).then(results => {
      const urls: Record<string, string> = {}
      for (const r of results) {
        if (r.url) urls[r.id] = r.url
      }
      setAttachmentUrls(urls)
    })
  }, [attachments])

  const isManager = !userRole || userRole === 'airfield_manager' || userRole === 'sys_admin'

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleStatusChange = async (newStatus: WaiverStatus, extra?: { date_approved?: string; expiration_date?: string }) => {
    if (usingDemo) {
      toast.success(`Status updated to ${newStatus} (demo mode)`)
      setActiveModal(null)
      return
    }

    setActionLoading(true)
    const { error } = await updateWaiverStatus(params.id as string, newStatus, extra)
    if (error) {
      toast.error(error)
    } else {
      toast.success(`Waiver ${newStatus}`)
      await loadData()
    }
    setActionLoading(false)
    setActiveModal(null)
  }

  const handleDelete = async () => {
    if (usingDemo) {
      toast.success('Waiver deleted (demo mode)')
      router.push('/waivers')
      return
    }

    if (!confirm('Delete this waiver? This cannot be undone.')) return
    setActionLoading(true)
    const { error } = await deleteWaiver(params.id as string)
    if (error) {
      toast.error(error)
      setActionLoading(false)
    } else {
      toast.success('Waiver deleted')
      router.push('/waivers')
    }
  }

  // handleAddCoordination is now replaced by handleSaveCoordination above

  const handleAddReview = async () => {
    if (usingDemo) {
      toast.success('Review added (demo mode)')
      setActiveModal(null)
      return
    }

    setActionLoading(true)
    const { error } = await createWaiverReview({
      waiver_id: params.id as string,
      review_year: new Date().getFullYear(),
      recommendation: reviewRecommendation,
      mitigation_verified: reviewMitigation,
      project_status_update: reviewProjectUpdate || undefined,
      notes: reviewNotes || undefined,
      presented_to_facilities_board: reviewBoard,
      facilities_board_date: reviewBoardDate || undefined,
    })
    if (error) {
      if (error.includes('waiver_reviews_waiver_id_review_year_key') || error.includes('duplicate key')) {
        toast.error(`This waiver has already been reviewed for ${new Date().getFullYear()}`)
      } else {
        toast.error(error)
      }
    } else {
      toast.success('Review recorded')
      await loadData()
    }
    setActionLoading(false)
    setActiveModal(null)
  }

  const handleUploadAttachment = async () => {
    if (!attachFile) return
    if (usingDemo) {
      toast.success('Attachment uploaded (demo mode)')
      setActiveModal(null)
      return
    }

    setActionLoading(true)
    const { error } = await uploadWaiverAttachment({
      waiver_id: params.id as string,
      file: attachFile,
      file_type: attachType,
      caption: attachCaption || undefined,
    })
    if (error) {
      toast.error(error)
    } else {
      toast.success('Attachment uploaded')
      await loadData()
    }
    setActionLoading(false)
    setActiveModal(null)
    setAttachFile(null)
    setAttachCaption('')
  }

  const handleDeleteReview = async (reviewId: string, waiverId: string, year: number) => {
    if (usingDemo) {
      toast.success('Review removed (demo mode)')
      return
    }
    if (!confirm(`Remove the ${year} review? This will also clear the waiver's last reviewed date.`)) return

    setActionLoading(true)
    const { error } = await deleteWaiverReview(reviewId, waiverId)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Review removed')
      await loadData()
    }
    setActionLoading(false)
  }

  const [editingCoordId, setEditingCoordId] = useState<string | null>(null)

  const handleEditCoordination = (c: WaiverCoordinationRow) => {
    setEditingCoordId(c.id)
    setCoordOffice(c.office)
    setCoordLabel(c.office_label || '')
    setCoordStatus(c.status)
    setCoordComments(c.comments || '')
    setActiveModal('coordination')
  }

  const handleDeleteCoordination = async (id: string) => {
    if (usingDemo) {
      toast.success('Coordination entry removed (demo mode)')
      return
    }
    if (!confirm('Delete this coordination entry?')) return

    setActionLoading(true)
    const { error } = await deleteWaiverCoordination(id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Coordination entry removed')
      await loadData()
    }
    setActionLoading(false)
  }

  const handleSaveCoordination = async () => {
    if (usingDemo) {
      toast.success('Coordination saved (demo mode)')
      setActiveModal(null)
      setEditingCoordId(null)
      return
    }

    setActionLoading(true)

    if (editingCoordId) {
      // Update existing entry
      const { error } = await updateWaiverCoordination(editingCoordId, {
        office: coordOffice,
        office_label: coordOffice === 'other' ? coordLabel : null,
        status: coordStatus,
        comments: coordComments || null,
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Coordination entry updated')
        await loadData()
      }
    } else {
      // Add new entry (auto-pull user name)
      let coordinatorName = ''
      const supabase = createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('name, rank').eq('id', user.id).single()
          coordinatorName = profile?.rank ? `${profile.rank} ${profile.name}` : (profile?.name || user.email || '')
        }
      }

      const newEntry = {
        office: coordOffice,
        office_label: coordOffice === 'other' ? coordLabel : undefined,
        coordinator_name: coordinatorName,
        coordinated_date: new Date().toISOString().split('T')[0],
        status: coordStatus,
        comments: coordComments || undefined,
      }
      const existing = coordination.map(c => ({
        office: c.office,
        office_label: c.office_label || undefined,
        coordinator_name: c.coordinator_name || undefined,
        coordinated_date: c.coordinated_date || undefined,
        status: c.status,
        comments: c.comments || undefined,
      }))
      const { error } = await upsertWaiverCoordination(params.id as string, [...existing, newEntry])
      if (error) {
        toast.error(error)
      } else {
        toast.success('Coordination entry added')
        await loadData()
      }
    }

    setActionLoading(false)
    setActiveModal(null)
    setEditingCoordId(null)
    setCoordComments('')
  }

  if (loading) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
      </div>
    )
  }

  const demoData = DEMO_WAIVERS.find(x => x.id === params.id) as WaiverRow | undefined
  const w = (usingDemo ? demoData : waiver) as WaiverRow | undefined
  const demoCriteria = usingDemo ? DEMO_WAIVER_CRITERIA.filter(c => c.waiver_id === params.id) : criteria
  const demoReviews = usingDemo ? DEMO_WAIVER_REVIEWS.filter(r => r.waiver_id === params.id) : reviews
  const demoCoordination = usingDemo ? DEMO_WAIVER_COORDINATION.filter(c => c.waiver_id === params.id) : coordination
  const allAttachments = usingDemo ? [] : attachments

  if (!w) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Waiver not found</div>
      </div>
    )
  }

  const statusConf = WAIVER_STATUS_CONFIG[w.status as keyof typeof WAIVER_STATUS_CONFIG]
  const classInfo = WAIVER_CLASSIFICATIONS.find(c => c.value === w.classification)
  const hazardConf = w.hazard_rating ? WAIVER_HAZARD_RATINGS.find(h => h.value === w.hazard_rating) : null
  const allowedTransitions = WAIVER_TRANSITIONS[w.status] || []

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const sectionHeader = (key: string, title: string, count?: number) => (
    <button
      type="button"
      onClick={() => toggleSection(key)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        padding: '10px 0', background: 'none', border: 'none',
        color: 'var(--color-text-1)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        marginBottom: expandedSections[key] ? 8 : 0,
      }}
    >
      <span>{title}{count !== undefined ? ` (${count})` : ''}</span>
      <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{expandedSections[key] ? '▲' : '▼'}</span>
    </button>
  )

  const fieldRow = (label: string, value: string | number | null | undefined) => (
    <div>
      <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, color: 'var(--color-text-2)' }}>{value || 'N/A'}</div>
    </div>
  )

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        {(w.status === 'draft' || w.status === 'pending') && (
          <Link
            href={`/waivers/${params.id}/edit`}
            style={{
              background: '#3B82F614', border: '1px solid #3B82F633', borderRadius: 8, padding: '6px 12px',
              color: '#3B82F6', fontSize: 12, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Edit
          </Link>
        )}
      </div>

      {/* Header Card */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{w.waiver_number}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {statusConf && <Badge label={statusConf.label} color={statusConf.color} bg={statusConf.bg} />}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {classInfo && <Badge label={`${classInfo.emoji} ${classInfo.label}`} color="#64748B" />}
          {hazardConf && <Badge label={hazardConf.label} color={hazardConf.color} bg={hazardConf.bg} />}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.6 }}>{w.description}</div>
      </div>

      {/* Photo Carousel */}
      {(() => {
        const photos = allAttachments.filter(a => a.mime_type?.startsWith('image/'))
        if (photos.length === 0) return null
        const currentPhoto = photos[carouselIndex]
        const currentUrl = currentPhoto ? attachmentUrls[currentPhoto.id] : null
        return (
          <div style={{ marginBottom: 8, position: 'relative' }}>
            <div
              style={{
                borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)',
                background: 'var(--color-bg-elevated)', aspectRatio: '16/10', position: 'relative',
                touchAction: 'pan-y', cursor: currentUrl ? 'pointer' : 'default',
              }}
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchDeltaX.current = 0; didSwipe.current = false }}
              onTouchMove={(e) => { touchDeltaX.current = e.touches[0].clientX - touchStartX.current }}
              onTouchEnd={() => {
                if (touchDeltaX.current < -50 && carouselIndex < photos.length - 1) {
                  setCarouselIndex(carouselIndex + 1); didSwipe.current = true
                } else if (touchDeltaX.current > 50 && carouselIndex > 0) {
                  setCarouselIndex(carouselIndex - 1); didSwipe.current = true
                }
                touchDeltaX.current = 0
              }}
              onClick={() => { if (!didSwipe.current && currentUrl) setFullscreenPhoto(true) }}
            >
              {currentUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUrl}
                  alt={currentPhoto?.caption || currentPhoto?.file_name || 'Photo'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-3)', fontSize: 12 }}>
                  Loading photo...
                </div>
              )}
              {currentPhoto?.caption && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '16px 12px 8px',
                  fontSize: 12, color: '#fff',
                }}>
                  {currentPhoto.caption}
                </div>
              )}
            </div>
            {photos.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIndex(i)}
                    style={{
                      width: i === carouselIndex ? 16 : 6, height: 6, borderRadius: 3,
                      background: i === carouselIndex ? 'var(--color-cyan)' : 'var(--color-text-4)',
                      border: 'none', padding: 0, cursor: 'pointer',
                      transition: 'width 0.2s, background 0.2s',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Overview Section */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('overview', 'Overview')}
        {expandedSections.overview && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {fieldRow('Classification', classInfo?.label)}
            {fieldRow('Hazard Rating', hazardConf?.label)}
            {fieldRow('Action Requested', w.action_requested ? titleCase(w.action_requested) : null)}
            {fieldRow('Period Valid', w.period_valid)}
            {fieldRow('Date Submitted', formatDate(w.date_submitted))}
            {fieldRow('Date Approved', formatDate(w.date_approved))}
            {fieldRow('Expiration Date', formatDate(w.expiration_date))}
            {fieldRow('Last Reviewed', formatDate(w.last_reviewed_date))}
            {fieldRow('Next Review Due', formatDate(w.next_review_due))}
            {fieldRow('Location', w.location_description)}
            {fieldRow('Proponent', w.proponent)}
            {fieldRow('Project Number', w.project_number)}
            {fieldRow('Program FY', w.program_fy?.toString())}
            {fieldRow('Estimated Cost', w.estimated_cost ? `$${Number(w.estimated_cost).toLocaleString()}` : null)}
            {fieldRow('Project Status', w.project_status)}
            {fieldRow('FAA Case #', w.faa_case_number)}
            {w.justification && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Justification</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5, marginTop: 2 }}>{w.justification}</div>
              </div>
            )}
            {w.corrective_action && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Corrective Action</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5, marginTop: 2 }}>{w.corrective_action}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Criteria & Standards */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('criteria', 'Criteria & Standards', demoCriteria.length)}
        {expandedSections.criteria && (
          <>
            {demoCriteria.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', padding: '8px 0' }}>No criteria recorded</div>
            ) : (
              demoCriteria.map((c, i) => {
                const sourceInfo = WAIVER_CRITERIA_SOURCES.find(s => s.value === c.criteria_source)
                return (
                  <div key={c.id || i} style={{ padding: '8px 10px', background: 'var(--color-bg-elevated)', borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <Badge label={sourceInfo?.label || c.criteria_source} color="#3B82F6" />
                      {c.reference && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>{c.reference}</span>}
                    </div>
                    {c.description && <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.4 }}>{c.description}</div>}
                  </div>
                )
              })
            )}
            {w.risk_assessment_summary && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#F59E0B11', border: '1px solid #F59E0B33', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Risk Assessment Summary</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5 }}>{w.risk_assessment_summary}</div>
              </div>
            )}
            {w.criteria_impact && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-3)' }}>
                <strong>Criteria Impact:</strong> {w.criteria_impact}
              </div>
            )}
          </>
        )}
      </div>

      {/* Coordination */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('coordination', 'Coordination', demoCoordination.length)}
        {expandedSections.coordination && (
          <>
            {demoCoordination.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', padding: '8px 0' }}>No coordination entries</div>
            ) : (
              demoCoordination.map((c, i) => {
                const officeInfo = WAIVER_COORDINATION_OFFICES.find(o => o.value === c.office)
                const statusColor = c.status === 'concur' ? '#10B981' : c.status === 'non_concur' ? '#EF4444' : '#F59E0B'
                return (
                  <div key={c.id || i} style={{ padding: '8px 0', borderBottom: i < demoCoordination.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-1)' }}>{officeInfo?.label || c.office_label || c.office}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                          {c.coordinator_name && <span>{c.coordinator_name}</span>}
                          {c.coordinated_date && <span> &bull; {formatDate(c.coordinated_date)}</span>}
                        </div>
                        {c.comments && <div style={{ fontSize: 11, color: 'var(--color-text-3)', fontStyle: 'italic', marginTop: 2 }}>{c.comments}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <Badge label={c.status === 'non_concur' ? 'Non-Concur' : titleCase(c.status)} color={statusColor} />
                        <button
                          onClick={() => handleEditCoordination(c)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCoordination(c.id)}
                          style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <button
              type="button"
              onClick={() => { setEditingCoordId(null); setCoordOffice('civil_engineer'); setCoordLabel(''); setCoordStatus('concur'); setCoordComments(''); setActiveModal('coordination') }}
              style={{
                marginTop: 8, width: '100%', padding: 8, borderRadius: 6, border: '1px dashed var(--color-border)',
                background: 'transparent', color: 'var(--color-cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Add Coordination Entry
            </button>
          </>
        )}
      </div>

      {/* Attachments */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('attachments', 'Attachments', allAttachments.length)}
        {expandedSections.attachments && (
          <>
            {(() => {
              const files = allAttachments.filter(a => !a.mime_type?.startsWith('image/'))
              const photoCount = allAttachments.filter(a => a.mime_type?.startsWith('image/')).length
              if (files.length === 0 && photoCount === 0) {
                return <div style={{ fontSize: 12, color: 'var(--color-text-3)', padding: '8px 0' }}>No attachments</div>
              }
              return (
                <>
                  {photoCount > 0 && files.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', padding: '8px 0' }}>
                      {photoCount} photo{photoCount > 1 ? 's' : ''} shown above
                    </div>
                  )}
                  {files.map((a, i) => (
                    <div key={a.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < files.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                          {titleCase(a.file_type)} {a.file_size ? `\u2022 ${(a.file_size / 1024).toFixed(0)} KB` : ''}
                        </div>
                        {a.caption && <div style={{ fontSize: 11, color: 'var(--color-text-3)', fontStyle: 'italic' }}>{a.caption}</div>}
                      </div>
                      <button
                        onClick={() => {
                          const url = attachmentUrls[a.id]
                          if (url) window.open(url, '_blank')
                        }}
                        style={{
                          marginLeft: 8, padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: '#3B82F614', border: '1px solid #3B82F633', color: '#3B82F6',
                          cursor: attachmentUrls[a.id] ? 'pointer' : 'default', fontFamily: 'inherit',
                          opacity: attachmentUrls[a.id] ? 1 : 0.5, flexShrink: 0,
                        }}
                        disabled={!attachmentUrls[a.id]}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </>
              )
            })()}
            <button
              type="button"
              onClick={() => setActiveModal('attachment')}
              style={{
                marginTop: 8, width: '100%', padding: 8, borderRadius: 6, border: '1px dashed var(--color-border)',
                background: 'transparent', color: 'var(--color-cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Upload Attachment
            </button>
          </>
        )}
      </div>

      {/* Review History */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('reviews', 'Review History', demoReviews.length)}
        {expandedSections.reviews && (
          <>
            {demoReviews.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', padding: '8px 0' }}>No reviews recorded</div>
            ) : (
              demoReviews.map((r, i) => {
                const recInfo = WAIVER_REVIEW_RECOMMENDATIONS.find(rec => rec.value === r.recommendation)
                const recColor = r.recommendation === 'retain' ? '#10B981' : r.recommendation === 'cancel' ? '#EF4444' : '#F59E0B'
                return (
                  <div key={r.id || i} style={{ padding: '8px 10px', background: 'var(--color-bg-elevated)', borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-1)' }}>{r.review_year} Review</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {recInfo && <Badge label={recInfo.label} color={recColor} />}
                        <button
                          onClick={() => handleDeleteReview(r.id, w.id, r.review_year)}
                          disabled={actionLoading}
                          style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: '2px 4px', fontFamily: 'inherit' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                      {r.review_date && <span>Reviewed {formatDate(r.review_date)}</span>}
                      {r.mitigation_verified && <span> &bull; Mitigation verified</span>}
                      {r.presented_to_facilities_board && <span> &bull; Presented to board {r.facilities_board_date ? formatDate(r.facilities_board_date) : ''}</span>}
                    </div>
                    {r.project_status_update && <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>Project: {r.project_status_update}</div>}
                    {r.notes && <div style={{ fontSize: 11, color: 'var(--color-text-3)', fontStyle: 'italic', marginTop: 2 }}>{r.notes}</div>}
                  </div>
                )
              })
            )}
            {['active', 'approved'].includes(w.status) && (
              <button
                type="button"
                onClick={() => setActiveModal('review')}
                style={{
                  marginTop: 8, width: '100%', padding: 8, borderRadius: 6, border: '1px dashed var(--color-border)',
                  background: 'transparent', color: 'var(--color-cyan)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                + Add Review
              </button>
            )}
          </>
        )}
      </div>

      {/* Notes */}
      {w.notes && (
        <div className="card" style={{ marginBottom: 8 }}>
          {sectionHeader('notes', 'Notes')}
          {expandedSections.notes && (
            <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.6 }}>{w.notes}</div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        {w.status === 'draft' && (
          <>
            <ActionButton color="#3B82F6" onClick={() => handleStatusChange('pending')} disabled={actionLoading}>
              Submit for Review
            </ActionButton>
            <ActionButton color="#EF4444" onClick={handleDelete} disabled={actionLoading}>
              Delete Draft
            </ActionButton>
          </>
        )}

        {w.status === 'pending' && isManager && (
          <>
            <ActionButton color="#10B981" onClick={() => setActiveModal('approve')} disabled={actionLoading}>
              Approve
            </ActionButton>
            <ActionButton color="#9CA3AF" onClick={() => handleStatusChange('draft')} disabled={actionLoading}>
              Send Back to Draft
            </ActionButton>
            <ActionButton color="#EF4444" onClick={() => handleStatusChange('cancelled')} disabled={actionLoading}>
              Cancel
            </ActionButton>
          </>
        )}

        {w.status === 'approved' && isManager && allowedTransitions.includes('active') && (
          <ActionButton color="#8B5CF6" onClick={() => handleStatusChange('active')} disabled={actionLoading}>
            Activate Waiver
          </ActionButton>
        )}

        {w.status === 'active' && isManager && (
          <>
            {allowedTransitions.includes('completed') && (
              <ActionButton color="#22C55E" onClick={() => handleStatusChange('completed')} disabled={actionLoading}>
                Mark Completed
              </ActionButton>
            )}
            {allowedTransitions.includes('expired') && (
              <ActionButton color="#F59E0B" onClick={() => handleStatusChange('expired')} disabled={actionLoading}>
                Mark Expired
              </ActionButton>
            )}
            {allowedTransitions.includes('cancelled') && (
              <ActionButton color="#EF4444" onClick={() => handleStatusChange('cancelled')} disabled={actionLoading}>
                Cancel
              </ActionButton>
            )}
          </>
        )}

        {w.status === 'cancelled' && allowedTransitions.includes('draft') && (
          <ActionButton color="#3B82F6" onClick={() => handleStatusChange('draft')} disabled={actionLoading}>
            Re-open as Draft
          </ActionButton>
        )}
      </div>

      {/* ─── MODALS ─── */}

      {/* Approve Modal */}
      {activeModal === 'approve' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Approve Waiver</div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Date Approved</span>
              <input type="date" className="input-dark" value={approveDate} onChange={(e) => setApproveDate(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="section-label">Expiration Date</span>
              <input type="date" className="input-dark" value={approveExpiration} onChange={(e) => setApproveExpiration(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setActiveModal(null)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => handleStatusChange('approved', {
                  date_approved: approveDate || undefined,
                  expiration_date: approveExpiration || undefined,
                })}
                disabled={actionLoading}
              >
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coordination Modal */}
      {activeModal === 'coordination' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{editingCoordId ? 'Edit Coordination' : 'Add Coordination'}</div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Office</span>
              <select className="input-dark" value={coordOffice} onChange={(e) => setCoordOffice(e.target.value as WaiverCoordinationOffice)} style={{ width: '100%' }}>
                {WAIVER_COORDINATION_OFFICES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {coordOffice === 'other' && (
              <div style={{ marginBottom: 12 }}>
                <span className="section-label">Office Label</span>
                <input type="text" className="input-dark" placeholder="e.g., Security Forces" value={coordLabel} onChange={(e) => setCoordLabel(e.target.value)} />
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Status</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['concur', 'non_concur', 'pending'] as const).map(s => (
                  <button key={s} type="button" onClick={() => setCoordStatus(s)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: coordStatus === s ? (s === 'concur' ? '#10B98122' : s === 'non_concur' ? '#EF444422' : '#F59E0B22') : 'transparent',
                      border: `1px solid ${coordStatus === s ? (s === 'concur' ? '#10B981' : s === 'non_concur' ? '#EF4444' : '#F59E0B') : 'var(--color-border)'}`,
                      color: coordStatus === s ? (s === 'concur' ? '#10B981' : s === 'non_concur' ? '#EF4444' : '#F59E0B') : 'var(--color-text-3)',
                    }}
                  >
                    {s === 'non_concur' ? 'Non-Concur' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="section-label">Comments</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} value={coordComments} onChange={(e) => setCoordComments(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => { setActiveModal(null); setEditingCoordId(null) }} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveCoordination} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : editingCoordId ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {activeModal === 'review' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{new Date().getFullYear()} Annual Review</div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Recommendation</span>
              <select className="input-dark" value={reviewRecommendation} onChange={(e) => setReviewRecommendation(e.target.value as WaiverReviewRecommendation)} style={{ width: '100%' }}>
                {WAIVER_REVIEW_RECOMMENDATIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={reviewMitigation} onChange={(e) => setReviewMitigation(e.target.checked)} />
                Mitigation measures verified
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Project Status Update</span>
              <input type="text" className="input-dark" placeholder="Current project status..." value={reviewProjectUpdate} onChange={(e) => setReviewProjectUpdate(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Notes</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={reviewBoard} onChange={(e) => setReviewBoard(e.target.checked)} />
                Presented to Facilities Board
              </label>
            </div>
            {reviewBoard && (
              <div style={{ marginBottom: 12 }}>
                <span className="section-label">Board Date</span>
                <input type="date" className="input-dark" value={reviewBoardDate} onChange={(e) => setReviewBoardDate(e.target.value)} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setActiveModal(null)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleAddReview} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Mark Reviewed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo */}
      {fullscreenPhoto && (() => {
        const photos = allAttachments.filter(a => a.mime_type?.startsWith('image/'))
        const currentPhoto = photos[carouselIndex]
        const currentUrl = currentPhoto ? attachmentUrls[currentPhoto.id] : null
        if (!currentUrl) return null
        return (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              touchAction: 'pan-y', cursor: 'pointer',
            }}
            onClick={() => { if (!didSwipe.current) setFullscreenPhoto(false) }}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; touchDeltaX.current = 0; didSwipe.current = false }}
            onTouchMove={(e) => { touchDeltaX.current = e.touches[0].clientX - touchStartX.current }}
            onTouchEnd={() => {
              if (touchDeltaX.current < -50 && carouselIndex < photos.length - 1) {
                setCarouselIndex(carouselIndex + 1); didSwipe.current = true
              } else if (touchDeltaX.current > 50 && carouselIndex > 0) {
                setCarouselIndex(carouselIndex - 1); didSwipe.current = true
              }
              touchDeltaX.current = 0
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setFullscreenPhoto(false) }}
              style={{
                position: 'absolute', top: 16, right: 16, zIndex: 201,
                background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 20, cursor: 'pointer',
              }}
            >
              &times;
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt={currentPhoto?.caption || currentPhoto?.file_name || 'Photo'}
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
            {currentPhoto?.caption && (
              <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', padding: '0 16px' }}>
                {currentPhoto.caption}
              </div>
            )}
            {photos.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCarouselIndex(i) }}
                    style={{
                      width: i === carouselIndex ? 16 : 6, height: 6, borderRadius: 3,
                      background: i === carouselIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                      border: 'none', padding: 0, cursor: 'pointer',
                      transition: 'width 0.2s, background 0.2s',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Attachment Modal */}
      {activeModal === 'attachment' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Upload Attachment</div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">File</span>
              <input type="file" accept="image/*,.pdf,.docx" onChange={(e) => setAttachFile(e.target.files?.[0] || null)} style={{ fontSize: 12, color: 'var(--color-text-2)' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Type</span>
              <select className="input-dark" value={attachType} onChange={(e) => setAttachType(e.target.value as WaiverAttachmentType)} style={{ width: '100%' }}>
                {[
                  { value: 'photo', label: 'Photo' },
                  { value: 'site_map', label: 'Site Map' },
                  { value: 'risk_assessment', label: 'Risk Assessment' },
                  { value: 'ufc_excerpt', label: 'UFC Excerpt' },
                  { value: 'faa_report', label: 'FAA Report' },
                  { value: 'coordination_sheet', label: 'Coordination Sheet' },
                  { value: 'af_form_505', label: 'AF Form 505' },
                  { value: 'other', label: 'Other' },
                ].map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span className="section-label">Caption</span>
              <input type="text" className="input-dark" placeholder="Optional caption..." value={attachCaption} onChange={(e) => setAttachCaption(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setActiveModal(null)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleUploadAttachment} disabled={actionLoading || !attachFile}>
                {actionLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
