'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { WAIVER_CLASSIFICATIONS, WAIVER_HAZARD_RATINGS, WAIVER_CRITERIA_SOURCES } from '@/lib/constants'
import {
  fetchWaiver, fetchWaiverCriteria, updateWaiver, upsertWaiverCriteria,
  fetchWaiverAttachments, uploadWaiverAttachment, deleteWaiverAttachment,
  type WaiverRow, type WaiverCriteriaRow, type WaiverAttachmentRow,
} from '@/lib/supabase/waivers'
import { createClient } from '@/lib/supabase/client'
import { DEMO_WAIVERS, DEMO_WAIVER_CRITERIA } from '@/lib/demo-data'
import { useInstallation } from '@/lib/installation-context'
import { logActivity } from '@/lib/supabase/activity'
import { toast } from 'sonner'
import type { WaiverClassification, WaiverCriteriaSource, WaiverAttachmentType } from '@/lib/supabase/types'

const WaiverLocationMap = dynamic(
  () => import('@/components/waivers/location-map'),
  { ssr: false },
)

type CriteriaEntry = { criteria_source: WaiverCriteriaSource; reference: string; description: string }

export default function EditWaiverPage() {
  const params = useParams()
  const router = useRouter()
  const { installationId, areas: installationAreas } = useInstallation()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true, criteria: true, risk: false, project: false, location: false, attachments: false,
  })

  // Attachments state
  const [attachments, setAttachments] = useState<WaiverAttachmentRow[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [showAttachModal, setShowAttachModal] = useState(false)
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [attachType, setAttachType] = useState<WaiverAttachmentType>('site_map')
  const [attachCaption, setAttachCaption] = useState('')
  const [attachUploading, setAttachUploading] = useState(false)
  const [deletingAttachId, setDeletingAttachId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    classification: '', action_requested: 'new', waiver_number: '', description: '', justification: '',
    hazard_rating: '', risk_assessment_summary: '', criteria_impact: '', faa_case_number: '',
    proponent: '', project_number: '', program_fy: '', estimated_cost: '', project_status: '',
    corrective_action: '', location_description: '',
    location_lat: null as number | null, location_lng: null as number | null,
    period_valid: '', date_submitted: '',
    expiration_date: '', notes: '',
  })

  const [criteria, setCriteria] = useState<CriteriaEntry[]>([])
  const [classDropdownOpen, setClassDropdownOpen] = useState(false)
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const classDropdownRef = useRef<HTMLDivElement>(null)
  const locationDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (classDropdownOpen && classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) {
        setClassDropdownOpen(false)
      }
      if (locationDropdownOpen && locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
        setLocationDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [classDropdownOpen, locationDropdownOpen])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setUsingDemo(true)
        const demo = DEMO_WAIVERS.find(w => w.id === params.id) as WaiverRow | undefined
        if (demo) populateForm(demo, DEMO_WAIVER_CRITERIA.filter(c => c.waiver_id === params.id) as WaiverCriteriaRow[])
        setLoading(false)
        return
      }

      const [w, cr, at] = await Promise.all([
        fetchWaiver(params.id as string),
        fetchWaiverCriteria(params.id as string),
        fetchWaiverAttachments(params.id as string),
      ])
      if (w) populateForm(w, cr)
      setAttachments(at)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  function populateForm(w: WaiverRow, cr: WaiverCriteriaRow[]) {
    setFormData({
      classification: w.classification || '',
      action_requested: w.action_requested || 'new',
      waiver_number: w.waiver_number || '',
      description: w.description || '',
      justification: w.justification || '',
      hazard_rating: w.hazard_rating || '',
      risk_assessment_summary: w.risk_assessment_summary || '',
      criteria_impact: w.criteria_impact || '',
      faa_case_number: w.faa_case_number || '',
      proponent: w.proponent || '',
      project_number: w.project_number || '',
      program_fy: w.program_fy?.toString() || '',
      estimated_cost: w.estimated_cost?.toString() || '',
      project_status: w.project_status || '',
      corrective_action: w.corrective_action || '',
      location_description: w.location_description || '',
      location_lat: w.location_lat ?? null,
      location_lng: w.location_lng ?? null,
      period_valid: w.period_valid || '',
      date_submitted: w.date_submitted || '',
      expiration_date: w.expiration_date || '',
      notes: w.notes || '',
    })
    setCriteria(cr.length > 0
      ? cr.map(c => ({ criteria_source: c.criteria_source, reference: c.reference || '', description: c.description || '' }))
      : [{ criteria_source: 'ufc_3_260_01', reference: '', description: '' }]
    )
  }

  // Generate signed URLs for attachments
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

  const ACRONYMS = new Set(['ufc', 'faa', 'af'])
  const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w+/g, w => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))

  const handleUploadAttachment = async () => {
    if (!attachFile) return
    if (usingDemo) {
      toast.success('Attachment uploaded (demo mode)')
      setShowAttachModal(false)
      return
    }

    setAttachUploading(true)
    const { data, error } = await uploadWaiverAttachment({
      waiver_id: params.id as string,
      file: attachFile,
      file_type: attachType,
      caption: attachCaption || undefined,
    })
    if (error) {
      toast.error(error)
    } else if (data) {
      toast.success('Attachment uploaded')
      setAttachments(prev => [data, ...prev])
    }
    setAttachUploading(false)
    setShowAttachModal(false)
    setAttachFile(null)
    setAttachCaption('')
    setAttachType('site_map')
  }

  const handleDeleteAttachment = async (att: WaiverAttachmentRow) => {
    if (usingDemo) {
      toast.success('Attachment removed (demo mode)')
      return
    }
    if (!confirm(`Delete "${att.file_name}"? This cannot be undone.`)) return

    setDeletingAttachId(att.id)
    const { error } = await deleteWaiverAttachment(att.id, params.id as string)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Attachment deleted')
      setAttachments(prev => prev.filter(a => a.id !== att.id))
    }
    setDeletingAttachId(null)
  }

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const selectedClassInfo = WAIVER_CLASSIFICATIONS.find(c => c.value === formData.classification)

  const handlePointSelected = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, location_lat: lat, location_lng: lng }))
    toast.success(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }, [])

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          location_lat: position.coords.latitude,
          location_lng: position.coords.longitude,
        }))
        setGpsLoading(false)
        toast.success(`Location: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`)
      },
      (error) => {
        setGpsLoading(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location access denied. Enable in browser settings.')
            break
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information unavailable.')
            break
          default:
            toast.error('Unable to get location.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  const handleSubmit = async () => {
    if (!formData.classification || !formData.description) {
      toast.error('Please fill in classification and description')
      return
    }

    if (usingDemo) {
      toast.success('Waiver updated (demo mode)')
      router.push(`/waivers/${params.id}`)
      return
    }

    setSaving(true)
    const { error } = await updateWaiver(params.id as string, {
      classification: formData.classification as WaiverClassification,
      description: formData.description,
      waiver_number: formData.waiver_number,
      action_requested: (formData.action_requested || null) as 'new' | 'extension' | 'amendment' | null,
      justification: formData.justification || null,
      hazard_rating: (formData.hazard_rating || null) as 'low' | 'medium' | 'high' | 'extremely_high' | null,
      risk_assessment_summary: formData.risk_assessment_summary || null,
      criteria_impact: formData.criteria_impact || null,
      faa_case_number: formData.faa_case_number || null,
      proponent: formData.proponent || null,
      project_number: formData.project_number || null,
      program_fy: formData.program_fy ? parseInt(formData.program_fy) : null,
      estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
      project_status: formData.project_status || null,
      corrective_action: formData.corrective_action || null,
      location_description: formData.location_description || null,
      location_lat: formData.location_lat,
      location_lng: formData.location_lng,
      period_valid: formData.period_valid || null,
      date_submitted: formData.date_submitted || null,
      expiration_date: formData.expiration_date || null,
      notes: formData.notes || null,
    })

    if (error) {
      toast.error(error)
      setSaving(false)
      return
    }

    // Update criteria
    const validCriteria = criteria.filter(c => c.reference || c.description)
    await upsertWaiverCriteria(params.id as string, validCriteria)

    if (installationId) {
      logActivity('updated', 'waiver', params.id as string, formData.waiver_number || (params.id as string), { classification: formData.classification }, installationId)
    }
    toast.success('Waiver updated')
    router.push(`/waivers/${params.id}`)
  }

  const addCriteria = () => setCriteria(prev => [...prev, { criteria_source: 'ufc_3_260_01', reference: '', description: '' }])
  const removeCriteria = (index: number) => setCriteria(prev => prev.filter((_, i) => i !== index))
  const updateCriteria = (index: number, field: keyof CriteriaEntry, value: string) => {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const sectionHeader = (key: string, title: string, expanded: boolean, count?: number) => (
    <button
      type="button"
      onClick={() => toggleSection(key)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        padding: '10px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text-1)', fontSize: 'var(--fs-md)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        marginBottom: expanded ? 12 : 0,
      }}
    >
      <span>{title}{count !== undefined && count > 0 ? ` (${count})` : ''}</span>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{expanded ? '▲' : '▼'}</span>
    </button>
  )

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
      </div>
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 4 }}>Edit Waiver</div>
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-cyan)', fontFamily: 'monospace', marginBottom: 12 }}>{formData.waiver_number}</div>

      {/* Section 1: Basic Info */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('basic', '1. Basic Information', expandedSections.basic)}
        {expandedSections.basic && (
          <>
            <div ref={classDropdownRef} style={{ marginBottom: 12, position: 'relative' }}>
              <span className="section-label">Classification *</span>
              <button type="button" className="input-dark" onClick={() => setClassDropdownOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {selectedClassInfo ? `${selectedClassInfo.emoji} ${selectedClassInfo.label}` : 'Select classification...'}
                </span>
                <span style={{ marginLeft: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{classDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {classDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 8, marginTop: 4, maxHeight: 280, overflowY: 'auto' }}>
                  {WAIVER_CLASSIFICATIONS.map(c => (
                    <button key={c.value} type="button" onClick={() => { setFormData(p => ({ ...p, classification: c.value })); setClassDropdownOpen(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', background: formData.classification === c.value ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                      <span>{c.emoji} {c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Action Requested</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['new', 'extension', 'amendment'].map(a => (
                  <button key={a} type="button" onClick={() => setFormData(p => ({ ...p, action_requested: a }))}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: formData.action_requested === a ? 'rgba(34,211,238,0.12)' : 'transparent',
                      border: `1px solid ${formData.action_requested === a ? 'rgba(34,211,238,0.3)' : 'var(--color-border)'}`,
                      color: formData.action_requested === a ? 'var(--color-cyan)' : 'var(--color-text-3)',
                    }}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Waiver Number</span>
              <input type="text" className="input-dark" value={formData.waiver_number} onChange={(e) => setFormData(p => ({ ...p, waiver_number: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Description *</span>
              <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }} value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <span className="section-label">Justification</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} value={formData.justification} onChange={(e) => setFormData(p => ({ ...p, justification: e.target.value }))} />
            </div>
          </>
        )}
      </div>

      {/* Section 2: Criteria */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('criteria', '2. Criteria & Standards', expandedSections.criteria)}
        {expandedSections.criteria && (
          <>
            {criteria.map((c, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 10, background: 'var(--color-bg-elevated)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)' }}>Criteria #{i + 1}</span>
                  {criteria.length > 1 && (
                    <button type="button" onClick={() => removeCriteria(i)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Remove</button>
                  )}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span className="section-label">Source</span>
                  <select className="input-dark" value={c.criteria_source} onChange={(e) => updateCriteria(i, 'criteria_source', e.target.value)} style={{ width: '100%' }}>
                    {WAIVER_CRITERIA_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span className="section-label">Reference</span>
                  <input type="text" className="input-dark" value={c.reference} onChange={(e) => updateCriteria(i, 'reference', e.target.value)} />
                </div>
                <div>
                  <span className="section-label">Description</span>
                  <input type="text" className="input-dark" value={c.description} onChange={(e) => updateCriteria(i, 'description', e.target.value)} />
                </div>
              </div>
            ))}
            <button type="button" onClick={addCriteria}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-cyan)', fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add Criteria
            </button>
          </>
        )}
      </div>

      {/* Section 3: Risk */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('risk', '3. Risk Assessment', expandedSections.risk)}
        {expandedSections.risk && (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Hazard Rating</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {WAIVER_HAZARD_RATINGS.map(h => (
                  <button key={h.value} type="button" onClick={() => setFormData(p => ({ ...p, hazard_rating: p.hazard_rating === h.value ? '' : h.value }))}
                    style={{ padding: '8px 4px', borderRadius: 6, fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: formData.hazard_rating === h.value ? h.bg : 'transparent',
                      border: `1px solid ${formData.hazard_rating === h.value ? h.color : 'var(--color-border)'}`,
                      color: formData.hazard_rating === h.value ? h.color : 'var(--color-text-3)',
                    }}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Risk Assessment Summary</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} value={formData.risk_assessment_summary} onChange={(e) => setFormData(p => ({ ...p, risk_assessment_summary: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Criteria Impact</span>
              <input type="text" className="input-dark" value={formData.criteria_impact} onChange={(e) => setFormData(p => ({ ...p, criteria_impact: e.target.value }))} />
            </div>
            <div>
              <span className="section-label">FAA Case Number</span>
              <input type="text" className="input-dark" value={formData.faa_case_number} onChange={(e) => setFormData(p => ({ ...p, faa_case_number: e.target.value }))} />
            </div>
          </>
        )}
      </div>

      {/* Section 4: Project */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('project', '4. Project Information', expandedSections.project)}
        {expandedSections.project && (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Proponent</span>
              <input type="text" className="input-dark" value={formData.proponent} onChange={(e) => setFormData(p => ({ ...p, proponent: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <span className="section-label">Project Number</span>
                <input type="text" className="input-dark" value={formData.project_number} onChange={(e) => setFormData(p => ({ ...p, project_number: e.target.value }))} />
              </div>
              <div>
                <span className="section-label">Program FY</span>
                <input type="text" className="input-dark" value={formData.program_fy} onChange={(e) => setFormData(p => ({ ...p, program_fy: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <span className="section-label">Estimated Cost ($)</span>
                <input type="text" className="input-dark" value={formData.estimated_cost} onChange={(e) => setFormData(p => ({ ...p, estimated_cost: e.target.value }))} />
              </div>
              <div>
                <span className="section-label">Project Status</span>
                <input type="text" className="input-dark" value={formData.project_status} onChange={(e) => setFormData(p => ({ ...p, project_status: e.target.value }))} />
              </div>
            </div>
            <div>
              <span className="section-label">Corrective Action</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} value={formData.corrective_action} onChange={(e) => setFormData(p => ({ ...p, corrective_action: e.target.value }))} />
            </div>
          </>
        )}
      </div>

      {/* Section 5: Location & Dates */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('location', '5. Location & Dates', expandedSections.location)}
        {expandedSections.location && (
          <>
            <div ref={locationDropdownRef} style={{ marginBottom: 12, position: 'relative' }}>
              <span className="section-label">Location</span>
              <button type="button" className="input-dark" onClick={() => setLocationDropdownOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{formData.location_description || 'Select location...'}</span>
                <span style={{ marginLeft: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{locationDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {locationDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
                  {installationAreas.map(area => (
                    <button key={area} type="button" onClick={() => { setFormData(p => ({ ...p, location_description: area })); setLocationDropdownOpen(false) }}
                      style={{ display: 'flex', width: '100%', padding: '10px 12px', background: formData.location_description === area ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)', fontSize: 'var(--fs-lg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                      {area}
                    </button>
                  ))}
                </div>
              )}
              <input type="text" className="input-dark" style={{ marginTop: 6 }} placeholder="Or type custom location..." value={formData.location_description} onChange={(e) => setFormData(p => ({ ...p, location_description: e.target.value }))} />
            </div>

            {/* Location Map */}
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Pin Location on Map</span>
              <WaiverLocationMap
                onPointSelected={handlePointSelected}
                selectedLat={formData.location_lat}
                selectedLng={formData.location_lng}
              />
            </div>

            {/* GPS Use My Location */}
            <button
              type="button"
              onClick={captureLocation}
              disabled={gpsLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 16px', marginBottom: 12, borderRadius: 8,
                border: '1px solid var(--color-border-active)', background: 'var(--color-border)',
                color: 'var(--color-accent)', fontSize: 'var(--fs-md)', fontWeight: 600,
                cursor: gpsLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: gpsLoading ? 0.6 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
              {gpsLoading ? 'Getting Location...' : 'Use My Location'}
            </button>

            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Period Valid</span>
              <input type="text" className="input-dark" value={formData.period_valid} onChange={(e) => setFormData(p => ({ ...p, period_valid: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <span className="section-label">Date Submitted</span>
                <input type="date" className="input-dark" value={formData.date_submitted} onChange={(e) => setFormData(p => ({ ...p, date_submitted: e.target.value }))} />
              </div>
              <div>
                <span className="section-label">Expiration Date</span>
                <input type="date" className="input-dark" value={formData.expiration_date} onChange={(e) => setFormData(p => ({ ...p, expiration_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <span className="section-label">Notes</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </>
        )}
      </div>

      {/* Section 6: Attachments */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('attachments', '6. Attachments', expandedSections.attachments, attachments.length)}
        {expandedSections.attachments && (
          <>
            {attachments.length === 0 ? (
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', padding: '8px 0' }}>No attachments</div>
            ) : (
              attachments.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < attachments.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                      {titleCase(a.file_type)} {a.file_size ? `\u2022 ${(a.file_size / 1024).toFixed(0)} KB` : ''}
                    </div>
                    {a.caption && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>{a.caption}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const url = attachmentUrls[a.id]
                        if (url) window.open(url, '_blank')
                      }}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 600,
                        background: '#3B82F614', border: '1px solid #3B82F633', color: '#3B82F6',
                        cursor: attachmentUrls[a.id] ? 'pointer' : 'default', fontFamily: 'inherit',
                        opacity: attachmentUrls[a.id] ? 1 : 0.5,
                      }}
                      disabled={!attachmentUrls[a.id]}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(a)}
                      disabled={deletingAttachId === a.id}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 600,
                        background: '#EF444414', border: '1px solid #EF444433', color: '#EF4444',
                        cursor: 'pointer', fontFamily: 'inherit',
                        opacity: deletingAttachId === a.id ? 0.5 : 1,
                      }}
                    >
                      {deletingAttachId === a.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => setShowAttachModal(true)}
              style={{
                marginTop: 8, width: '100%', padding: 8, borderRadius: 6, border: '1px dashed var(--color-border)',
                background: 'transparent', color: 'var(--color-cyan)', fontSize: 'var(--fs-base)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Upload Attachment
            </button>
          </>
        )}
      </div>

      {/* Save Button */}
      <button
        type="button"
        className="btn-primary"
        onClick={handleSubmit}
        disabled={saving}
        style={{ width: '100%', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Attachment Upload Modal */}
      {showAttachModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--color-bg-surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 12 }}>Upload Attachment</div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">File</span>
              <input type="file" accept=".pdf,.docx,.xlsx,.xls,.doc,.pptx,.ppt,.csv,.txt,.jpg,.jpeg,.png"
                onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
                style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)' }} />
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
              <button
                type="button"
                onClick={() => { setShowAttachModal(false); setAttachFile(null); setAttachCaption(''); setAttachType('site_map') }}
                style={{ padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleUploadAttachment}
                disabled={!attachFile || attachUploading}
                style={{ opacity: !attachFile || attachUploading ? 0.5 : 1 }}
              >
                {attachUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
