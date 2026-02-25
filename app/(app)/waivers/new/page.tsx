'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WAIVER_CLASSIFICATIONS, WAIVER_HAZARD_RATINGS, WAIVER_CRITERIA_SOURCES } from '@/lib/constants'
import { createWaiver, upsertWaiverCriteria } from '@/lib/supabase/waivers'
import { useInstallation } from '@/lib/installation-context'
import { toast } from 'sonner'
import type { WaiverStatus, WaiverClassification, WaiverCriteriaSource } from '@/lib/supabase/types'

type CriteriaEntry = { criteria_source: WaiverCriteriaSource; reference: string; description: string }

export default function NewWaiverPage() {
  const router = useRouter()
  const { installationId, areas: installationAreas } = useInstallation()
  const [saving, setSaving] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    criteria: true,
    risk: false,
    project: false,
    location: false,
  })

  const [formData, setFormData] = useState({
    classification: '' as string,
    action_requested: 'new' as string,
    waiver_number: '',
    description: '',
    justification: '',
    hazard_rating: '' as string,
    risk_assessment_summary: '',
    criteria_impact: '',
    faa_case_number: '',
    proponent: '',
    project_number: '',
    program_fy: '',
    estimated_cost: '',
    project_status: '',
    corrective_action: '',
    location_description: '',
    period_valid: '',
    date_submitted: '',
    expiration_date: '',
    notes: '',
  })

  const [criteria, setCriteria] = useState<CriteriaEntry[]>([
    { criteria_source: 'ufc_3_260_01', reference: '', description: '' },
  ])

  const [classDropdownOpen, setClassDropdownOpen] = useState(false)
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const selectedClassInfo = WAIVER_CLASSIFICATIONS.find(c => c.value === formData.classification)

  // Auto-preview waiver number
  const previewNumber = (() => {
    if (formData.waiver_number) return formData.waiver_number
    if (!formData.classification) return 'P-XXXX-YY-####'
    const prefix = formData.classification === 'permanent' ? 'P'
      : formData.classification === 'temporary' ? 'T'
      : formData.classification === 'construction' ? 'C'
      : formData.classification === 'event' ? 'E'
      : formData.classification === 'extension' ? 'X' : 'A'
    const yy = new Date().getFullYear().toString().slice(-2)
    return `${prefix}-VGLZ-${yy}-####`
  })()

  const handleSubmit = async (status: WaiverStatus) => {
    if (!formData.classification || !formData.description) {
      toast.error('Please fill in classification and description')
      return
    }

    setSaving(true)
    const { data, error } = await createWaiver({
      classification: formData.classification as WaiverClassification,
      description: formData.description,
      waiver_number: formData.waiver_number || undefined,
      status,
      action_requested: (formData.action_requested || null) as 'new' | 'extension' | 'amendment' | null,
      justification: formData.justification || undefined,
      hazard_rating: (formData.hazard_rating || null) as 'low' | 'medium' | 'high' | 'extremely_high' | null,
      risk_assessment_summary: formData.risk_assessment_summary || undefined,
      criteria_impact: formData.criteria_impact || undefined,
      faa_case_number: formData.faa_case_number || undefined,
      proponent: formData.proponent || undefined,
      project_number: formData.project_number || undefined,
      program_fy: formData.program_fy ? parseInt(formData.program_fy) : null,
      estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
      project_status: formData.project_status || undefined,
      corrective_action: formData.corrective_action || undefined,
      location_description: formData.location_description || undefined,
      period_valid: formData.period_valid || undefined,
      date_submitted: formData.date_submitted || (status === 'pending' ? new Date().toISOString().split('T')[0] : null),
      expiration_date: formData.expiration_date || null,
      notes: formData.notes || undefined,
      base_id: installationId,
      installation_code: 'VGLZ',
    })

    if (error) {
      toast.error(error)
      setSaving(false)
      return
    }

    // Save criteria if we have a waiver ID
    if (data?.id) {
      const validCriteria = criteria.filter(c => c.reference || c.description)
      if (validCriteria.length > 0) {
        await upsertWaiverCriteria(data.id, validCriteria)
      }
    }

    toast.success(status === 'draft' ? 'Waiver saved as draft' : 'Waiver submitted for review')
    router.push('/waivers')
  }

  const addCriteria = () => {
    setCriteria(prev => [...prev, { criteria_source: 'ufc_3_260_01', reference: '', description: '' }])
  }

  const removeCriteria = (index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index))
  }

  const updateCriteria = (index: number, field: keyof CriteriaEntry, value: string) => {
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const sectionHeader = (key: string, title: string, expanded: boolean) => (
    <button
      type="button"
      onClick={() => toggleSection(key)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        padding: '10px 0', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text-1)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        marginBottom: expanded ? 12 : 0,
      }}
    >
      <span>{title}</span>
      <span style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{expanded ? '▲' : '▼'}</span>
    </button>
  )

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>New Waiver</div>

      {/* Section 1: Basic Info */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('basic', '1. Basic Information', expandedSections.basic)}
        {expandedSections.basic && (
          <>
            {/* Classification */}
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <span className="section-label">Classification *</span>
              <button
                type="button"
                className="input-dark"
                onClick={() => setClassDropdownOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {selectedClassInfo ? `${selectedClassInfo.emoji} ${selectedClassInfo.label}` : 'Select classification...'}
                </span>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-3)' }}>{classDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {classDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 8, marginTop: 4, maxHeight: 280, overflowY: 'auto' }}>
                  {WAIVER_CLASSIFICATIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => { setFormData(p => ({ ...p, classification: c.value })); setClassDropdownOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                        background: formData.classification === c.value ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)',
                        fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}
                    >
                      <span>{c.emoji} {c.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 'auto' }}>{c.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action Requested */}
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Action Requested</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['new', 'extension', 'amendment'].map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, action_requested: a }))}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: formData.action_requested === a ? 'rgba(34,211,238,0.12)' : 'transparent',
                      border: `1px solid ${formData.action_requested === a ? 'rgba(34,211,238,0.3)' : 'var(--color-border)'}`,
                      color: formData.action_requested === a ? 'var(--color-cyan)' : 'var(--color-text-3)',
                    }}
                  >
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Waiver Number */}
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Waiver Number</span>
              <input type="text" className="input-dark" placeholder={previewNumber} value={formData.waiver_number} onChange={(e) => setFormData(p => ({ ...p, waiver_number: e.target.value }))} />
              <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 2 }}>
                Leave blank for auto-generated ({previewNumber}), or enter legacy format (e.g., VGLZ050224001)
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Description *</span>
              <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }} placeholder="Full description of the criteria violation..." value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} />
            </div>

            {/* Justification */}
            <div style={{ marginBottom: 0 }}>
              <span className="section-label">Justification</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} placeholder="Justification for waiver request..." value={formData.justification} onChange={(e) => setFormData(p => ({ ...p, justification: e.target.value }))} />
            </div>
          </>
        )}
      </div>

      {/* Section 2: Criteria & Standards */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('criteria', '2. Criteria & Standards', expandedSections.criteria)}
        {expandedSections.criteria && (
          <>
            {criteria.map((c, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 10, background: 'var(--color-bg-elevated)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-3)' }}>Criteria #{i + 1}</span>
                  {criteria.length > 1 && (
                    <button type="button" onClick={() => removeCriteria(i)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span className="section-label">Source</span>
                  <select
                    className="input-dark"
                    value={c.criteria_source}
                    onChange={(e) => updateCriteria(i, 'criteria_source', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {WAIVER_CRITERIA_SOURCES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span className="section-label">Reference</span>
                  <input type="text" className="input-dark" placeholder="e.g., Table 5.1, Item 1" value={c.reference} onChange={(e) => updateCriteria(i, 'reference', e.target.value)} />
                </div>
                <div>
                  <span className="section-label">Description</span>
                  <input type="text" className="input-dark" placeholder="Description of criteria violated..." value={c.description} onChange={(e) => updateCriteria(i, 'description', e.target.value)} />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addCriteria}
              style={{
                width: '100%', padding: 8, borderRadius: 6, border: '1px dashed var(--color-border)',
                background: 'transparent', color: 'var(--color-cyan)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Add Criteria
            </button>
          </>
        )}
      </div>

      {/* Section 3: Risk Assessment */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('risk', '3. Risk Assessment', expandedSections.risk)}
        {expandedSections.risk && (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Hazard Rating</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {WAIVER_HAZARD_RATINGS.map(h => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, hazard_rating: p.hazard_rating === h.value ? '' : h.value }))}
                    style={{
                      padding: '8px 4px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      background: formData.hazard_rating === h.value ? h.bg : 'transparent',
                      border: `1px solid ${formData.hazard_rating === h.value ? h.color : 'var(--color-border)'}`,
                      color: formData.hazard_rating === h.value ? h.color : 'var(--color-text-3)',
                    }}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Risk Assessment Summary</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} placeholder="Summary of risk assessment (AF Form 4437)..." value={formData.risk_assessment_summary} onChange={(e) => setFormData(p => ({ ...p, risk_assessment_summary: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Criteria Impact</span>
              <input type="text" className="input-dark" placeholder='e.g., "25\' deficiency", "9\' into clear zone"' value={formData.criteria_impact} onChange={(e) => setFormData(p => ({ ...p, criteria_impact: e.target.value }))} />
            </div>
            <div>
              <span className="section-label">FAA OE/AAA Case Number</span>
              <input type="text" className="input-dark" placeholder="e.g., 2026-AGL-1234-OE" value={formData.faa_case_number} onChange={(e) => setFormData(p => ({ ...p, faa_case_number: e.target.value }))} />
            </div>
          </>
        )}
      </div>

      {/* Section 4: Project Information */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('project', '4. Project Information', expandedSections.project)}
        {expandedSections.project && (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Proponent</span>
              <input type="text" className="input-dark" placeholder="e.g., 127 CES/CEAO" value={formData.proponent} onChange={(e) => setFormData(p => ({ ...p, proponent: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <span className="section-label">Project Number</span>
                <input type="text" className="input-dark" placeholder="e.g., VGLZ009082" value={formData.project_number} onChange={(e) => setFormData(p => ({ ...p, project_number: e.target.value }))} />
              </div>
              <div>
                <span className="section-label">Program FY</span>
                <input type="text" className="input-dark" placeholder="e.g., 2027" value={formData.program_fy} onChange={(e) => setFormData(p => ({ ...p, program_fy: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <span className="section-label">Estimated Cost ($)</span>
                <input type="text" className="input-dark" placeholder="e.g., 250000" value={formData.estimated_cost} onChange={(e) => setFormData(p => ({ ...p, estimated_cost: e.target.value }))} />
              </div>
              <div>
                <span className="section-label">Project Status</span>
                <input type="text" className="input-dark" placeholder="e.g., Design 60% complete" value={formData.project_status} onChange={(e) => setFormData(p => ({ ...p, project_status: e.target.value }))} />
              </div>
            </div>
            <div>
              <span className="section-label">Corrective Action</span>
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} placeholder="Planned corrective action..." value={formData.corrective_action} onChange={(e) => setFormData(p => ({ ...p, corrective_action: e.target.value }))} />
            </div>
          </>
        )}
      </div>

      {/* Section 5: Location & Dates */}
      <div className="card" style={{ marginBottom: 8 }}>
        {sectionHeader('location', '5. Location & Dates', expandedSections.location)}
        {expandedSections.location && (
          <>
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <span className="section-label">Location</span>
              <button
                type="button"
                className="input-dark"
                onClick={() => setLocationDropdownOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {formData.location_description || 'Select or type location...'}
                </span>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-3)' }}>{locationDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {locationDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
                  {installationAreas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => { setFormData(p => ({ ...p, location_description: area })); setLocationDropdownOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                        background: formData.location_description === area ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)',
                        fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              )}
              <input type="text" className="input-dark" style={{ marginTop: 6 }} placeholder="Or type custom location..." value={formData.location_description} onChange={(e) => setFormData(p => ({ ...p, location_description: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="section-label">Period Valid</span>
              <input type="text" className="input-dark" placeholder='e.g., "Indefinite", "8-Years", "Duration of Construction"' value={formData.period_valid} onChange={(e) => setFormData(p => ({ ...p, period_valid: e.target.value }))} />
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
              <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} placeholder="Additional notes..." value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </>
        )}
      </div>

      {/* Submit Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          onClick={() => handleSubmit('draft')}
          disabled={saving}
          style={{
            background: '#9CA3AF14',
            border: '1px solid #9CA3AF33',
            borderRadius: 8,
            padding: '12px',
            color: '#9CA3AF',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => handleSubmit('pending')}
          disabled={saving}
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </div>
  )
}
