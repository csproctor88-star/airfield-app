'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WAIVER_TYPES } from '@/lib/constants'
import { createWaiver } from '@/lib/supabase/waivers'
import { useInstallation } from '@/lib/installation-context'
import { toast } from 'sonner'
import type { WaiverStatus } from '@/lib/supabase/types'

export default function NewWaiverPage() {
  const router = useRouter()
  const { installationId, areas: installationAreas } = useInstallation()
  const [saving, setSaving] = useState(false)
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [formData, setFormData] = useState({
    waiver_type: '',
    title: '',
    description: '',
    location_text: '',
    authority_reference: '',
    conditions: '',
    effective_start: '',
    effective_end: '',
    linked_discrepancy_id: '',
    linked_obstruction_id: '',
    linked_notam_ref: '',
  })

  const selectedTypeInfo = WAIVER_TYPES.find(t => t.value === formData.waiver_type)

  const handleSubmit = async (status: WaiverStatus) => {
    if (!formData.title || !formData.description || !formData.waiver_type) {
      toast.error('Please fill in waiver type, title, and description')
      return
    }

    setSaving(true)
    const { error } = await createWaiver({
      title: formData.title,
      description: formData.description,
      waiver_type: formData.waiver_type,
      location_text: formData.location_text || undefined,
      authority_reference: formData.authority_reference || undefined,
      conditions: formData.conditions || undefined,
      effective_start: formData.effective_start ? new Date(formData.effective_start).toISOString() : null,
      effective_end: formData.effective_end ? new Date(formData.effective_end).toISOString() : null,
      status,
      base_id: installationId,
    })

    if (error) {
      toast.error(error)
      setSaving(false)
      return
    }

    toast.success(status === 'draft' ? 'Waiver saved as draft' : 'Waiver submitted for review')
    router.push('/waivers')
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          &larr; Back
        </button>
        <button onClick={() => router.push('/waivers')} style={{ background: '#A78BFA14', border: '1px solid #A78BFA33', borderRadius: 8, padding: '6px 12px', color: '#A78BFA', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          View All Waivers
        </button>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>New Waiver</div>

      <div className="card">
        {/* Waiver Type */}
        <div style={{ marginBottom: 12, position: 'relative' }}>
          <span className="section-label">Waiver Type</span>
          <button
            type="button"
            className="input-dark"
            onClick={() => setTypeDropdownOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {selectedTypeInfo ? `${selectedTypeInfo.emoji} ${selectedTypeInfo.label}` : 'Select waiver type...'}
            </span>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-3)' }}>{typeDropdownOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {typeDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
              {WAIVER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { setFormData((p) => ({ ...p, waiver_type: t.value })); setTypeDropdownOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                    background: formData.waiver_type === t.value ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)',
                    fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span>{t.emoji} {t.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-3)', marginLeft: 'auto' }}>{t.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Title</span>
          <input type="text" className="input-dark" maxLength={200} placeholder="Short summary of waiver request..." value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Description / Justification</span>
          <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }} placeholder="Detailed description and justification..." value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} />
        </div>

        {/* Location */}
        <div style={{ marginBottom: 12, position: 'relative' }}>
          <span className="section-label">Location</span>
          <button
            type="button"
            className="input-dark"
            onClick={() => setLocationDropdownOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {formData.location_text || 'Select location...'}
            </span>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-3)' }}>{locationDropdownOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {locationDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
              {installationAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => { setFormData((p) => ({ ...p, location_text: area })); setLocationDropdownOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                    background: formData.location_text === area ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)',
                    fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span>{area}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Authority Reference */}
        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Authority Reference</span>
          <input type="text" className="input-dark" placeholder="e.g., DAFI 13-213 Ch.4" value={formData.authority_reference} onChange={(e) => setFormData((p) => ({ ...p, authority_reference: e.target.value }))} />
        </div>

        {/* Conditions */}
        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Conditions / Limitations</span>
          <textarea className="input-dark" rows={2} style={{ resize: 'vertical' }} placeholder="Any conditions or limitations for this waiver..." value={formData.conditions} onChange={(e) => setFormData((p) => ({ ...p, conditions: e.target.value }))} />
        </div>

        {/* Effective Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div>
            <span className="section-label">Effective Start</span>
            <input type="datetime-local" className="input-dark" value={formData.effective_start} onChange={(e) => setFormData((p) => ({ ...p, effective_start: e.target.value }))} />
          </div>
          <div>
            <span className="section-label">Effective End</span>
            <input type="datetime-local" className="input-dark" value={formData.effective_end} onChange={(e) => setFormData((p) => ({ ...p, effective_end: e.target.value }))} />
          </div>
        </div>

        {/* Linked Records */}
        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Link to Discrepancy (optional)</span>
          <input type="text" className="input-dark" placeholder="e.g., D-2026-0042" value={formData.linked_discrepancy_id} onChange={(e) => setFormData((p) => ({ ...p, linked_discrepancy_id: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Link to Obstruction Eval (optional)</span>
          <input type="text" className="input-dark" placeholder="e.g., OE-2026-001A" value={formData.linked_obstruction_id} onChange={(e) => setFormData((p) => ({ ...p, linked_obstruction_id: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Link to NOTAM (optional)</span>
          <input type="text" className="input-dark" placeholder="e.g., 01/003" value={formData.linked_notam_ref} onChange={(e) => setFormData((p) => ({ ...p, linked_notam_ref: e.target.value }))} />
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
            onClick={() => handleSubmit('submitted')}
            disabled={saving}
            style={{ opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
