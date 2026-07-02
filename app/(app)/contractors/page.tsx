'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { getTerm } from '@/lib/airport-mode'
import { usePermissions, PERM } from '@/lib/permissions'
import { friendlyError } from '@/lib/utils'
import { fetchContractors, createContractor, updateContractor, type ContractorRow } from '@/lib/supabase/contractors'
import { CONTRACTOR_STATUS_CONFIG } from '@/lib/constants'
import { DEMO_CONTRACTORS } from '@/lib/demo-data'
import { toast } from 'sonner'
import { formatZuluDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import type jsPDF from 'jspdf'
import { HardHat, Plus, FileDown, Mail, CheckCircle2, Pencil, Trash2 } from 'lucide-react'

type FilterTab = 'active' | 'all' | 'completed'

export default function ContractorsPage() {
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()
  // Field label for the on-airfield credential: USAF airfields canonical AF Form 483;
  // civilian Part 139 airports use the SIDA badge. The module itself is "Personnel
  // on Airfield" — a broader tracker — so this label appears only on the specific
  // credential field, not in the module title or section headers.
  const credentialLabel = getTerm('form_483', currentInstallation)
  const { has } = usePermissions()
  const canManageTemplates = has(PERM.CONTRACTORS_WRITE)
  const canDeleteTemplates = has(PERM.CONTRACTORS_DELETE)
  const [contractors, setContractors] = useState<ContractorRow[]>([])
  const [filter, setFilter] = useState<FilterTab>('active')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formCompany, setFormCompany] = useState('')
  const [formContact, setFormContact] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0])
  const [formNotes, setFormNotes] = useState('')
  const [formRadio, setFormRadio] = useState('')
  const [formFlag, setFormFlag] = useState('')
  const [formCallsign, setFormCallsign] = useState('')
  const [formAf483, setFormAf483] = useState('')
  const [formAf483Exp, setFormAf483Exp] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [usingTemplate, setUsingTemplate] = useState<ContractorTemplate | null>(null)

  // Contractor templates (stored on bases table as JSONB, shared across all users)
  type ContractorTemplate = { name: string; company: string; contact: string; callsign: string; notes: string; af_form_483: string; af_form_483_expiration: string; contact_phone: string }
  const [templates, setTemplates] = useState<ContractorTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [editingTemplateIdx, setEditingTemplateIdx] = useState<number | null>(null)

  // Load templates from Supabase
  useEffect(() => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    supabase.from('bases').select('contractor_templates').eq('id', installationId).single()
      .then(({ data }) => {
        const row = data as Record<string, unknown> | null
        if (row?.contractor_templates && Array.isArray(row.contractor_templates)) {
          setTemplates(row.contractor_templates as ContractorTemplate[])
        }
      })
  }, [installationId])

  // Read-then-write to avoid race conditions overwriting other users' templates
  const saveTemplates = async (updated: ContractorTemplate[]) => {
    const previous = templates
    setTemplates(updated)
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return
    const { error } = await supabase.from('bases').update({ contractor_templates: updated } as any).eq('id', installationId)
    if (error) {
      setTemplates(previous) // revert the optimistic update so a failed save doesn't look saved
      toast.error(`Couldn't save templates: ${error.message}`)
    }
  }

  // Fetch latest templates from DB before appending, to avoid overwriting
  const refreshAndGetTemplates = async (): Promise<ContractorTemplate[]> => {
    if (!installationId) return templates
    const supabase = createClient()
    if (!supabase) return templates
    const { data } = await supabase.from('bases').select('contractor_templates').eq('id', installationId).single()
    const row = data as Record<string, unknown> | null
    const latest = (row?.contractor_templates && Array.isArray(row.contractor_templates))
      ? row.contractor_templates as ContractorTemplate[]
      : []
    setTemplates(latest)
    return latest
  }

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || !formCompany.trim()) return
    const newTemplate: ContractorTemplate = {
      name: templateName.trim(),
      company: formCompany,
      contact: formContact,
      callsign: formCallsign,
      notes: formNotes,
      af_form_483: formAf483,
      af_form_483_expiration: formAf483Exp,
      contact_phone: formPhone,
    }
    const latest = await refreshAndGetTemplates()
    await saveTemplates([...latest, newTemplate])
    setTemplateName('')
    setShowSaveTemplate(false)
    toast.success(`Template "${newTemplate.name}" saved`)
  }

  const handleUseTemplate = (t: ContractorTemplate) => {
    setFormCompany(t.company)
    setFormContact(t.contact)
    setFormCallsign(t.callsign || '')
    setFormNotes(t.notes || '')
    setFormAf483(t.af_form_483 || '')
    setFormAf483Exp(t.af_form_483_expiration || '')
    setFormPhone(t.contact_phone || '')
    setFormLocation('')
    setFormDescription('')
    setFormRadio('')
    setFormFlag('')
    setUsingTemplate(t)
    setShowTemplates(false)
    setShowForm(true)
    toast.success(`Template "${t.name}" applied`)
  }

  const handleDeleteTemplate = async (idx: number) => {
    const latest = await refreshAndGetTemplates()
    const updated = latest.filter((_, i) => i !== idx)
    await saveTemplates(updated)
    toast.success('Template deleted')
  }

  const handleEditTemplate = (idx: number) => {
    const t = templates[idx]
    if (!t) return
    setTemplateName(t.name)
    setFormCompany(t.company)
    setFormContact(t.contact)
    setFormCallsign(t.callsign || '')
    setFormNotes(t.notes || '')
    setFormAf483(t.af_form_483 || '')
    setFormAf483Exp(t.af_form_483_expiration || '')
    setFormPhone(t.contact_phone || '')
    setEditingTemplateIdx(idx)
    setShowSaveTemplate(true)
    setUsingTemplate(null)
    setShowForm(true)
  }

  const handleUpdateTemplate = async () => {
    if (editingTemplateIdx === null || !templateName.trim() || !formCompany.trim()) return
    const latest = await refreshAndGetTemplates()
    const updated = [...latest]
    if (editingTemplateIdx < updated.length) {
      updated[editingTemplateIdx] = {
        name: templateName.trim(),
        company: formCompany,
        contact: formContact,
        callsign: formCallsign,
        notes: formNotes,
        af_form_483: formAf483,
        af_form_483_expiration: formAf483Exp,
        contact_phone: formPhone,
      }
    }
    await saveTemplates(updated)
    setTemplateName('')
    setEditingTemplateIdx(null)
    setShowSaveTemplate(false)
    toast.success(`Template "${templateName.trim()}" updated`)
  }

  // Edit state
  const [editCompany, setEditCompany] = useState('')
  const [editContact, setEditContact] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editRadio, setEditRadio] = useState('')
  const [editFlag, setEditFlag] = useState('')
  const [editCallsign, setEditCallsign] = useState('')

  const loadContractors = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setContractors(DEMO_CONTRACTORS as ContractorRow[])
      return
    }
    const data = await fetchContractors(installationId)
    setContractors(data)
  }, [installationId])

  useEffect(() => { loadContractors() }, [loadContractors])

  const filtered = contractors.filter(c => {
    if (filter === 'active' && c.status !== 'active') return false
    if (filter === 'completed' && c.status !== 'completed') return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.company_name.toLowerCase().includes(q) ||
        (c.contact_name || '').toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
      )
    }
    return true
  })

  const activeCount = contractors.filter(c => c.status === 'active').length

  // PDF export
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailPdfData, setEmailPdfData] = useState<{ doc: jsPDF; filename: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  async function preparePdf() {
    const { generatePersonnelPdf } = await import('@/lib/personnel-pdf')
    const filterLabel = filter.charAt(0).toUpperCase() + filter.slice(1)
    return generatePersonnelPdf({
      contractors: filtered,
      filterLabel,
      searchQuery: search || undefined,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao || undefined,
      airportType: currentInstallation?.airport_type,
    })
  }

  async function handleExportPdf() {
    setGeneratingPdf(true)
    try {
      const { doc, filename } = await preparePdf()
      doc.save(filename)
      toast.success('PDF exported')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleEmailPdf() {
    setGeneratingPdf(true)
    try {
      const result = await preparePdf()
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleSendEmail(email: string) {
    if (!emailPdfData) return
    setSendingEmail(true)
    try {
      await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, 'Personnel on Airfield')
      toast.success(`Emailed to ${email}`)
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } catch (err) {
      console.error(err)
      toast.error('Email failed')
    } finally {
      setSendingEmail(false)
    }
  }

  function resetForm() {
    setFormCompany('')
    setFormContact('')
    setFormLocation('')
    setFormDescription('')
    setFormStartDate(new Date().toISOString().split('T')[0])
    setFormNotes('')
    setFormRadio('')
    setFormFlag('')
    setFormCallsign('')
    setFormAf483('')
    setFormAf483Exp('')
    setFormPhone('')
    setUsingTemplate(null)
    setEditingTemplateIdx(null)
    setShowSaveTemplate(false)
    setTemplateName('')
  }

  async function handleCreate() {
    if (!formCompany.trim() || !formLocation.trim() || !formDescription.trim()) {
      toast.error('Company/name, location, and work description are required')
      return
    }
    setSaving(true)
    const { error } = await createContractor({
      company_name: formCompany.trim(),
      contact_name: formContact.trim() || undefined,
      location: formLocation.trim(),
      work_description: formDescription.trim(),
      start_date: formStartDate,
      notes: formNotes.trim() || undefined,
      radio_number: formRadio.trim() || undefined,
      flag_number: formFlag.trim() || undefined,
      callsign: formCallsign.trim() || undefined,
      af_form_483: formAf483.trim() || undefined,
      af_form_483_expiration: formAf483Exp || undefined,
      contact_phone: formPhone.trim() || undefined,
      base_id: installationId,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Personnel added')
    resetForm()
    setShowForm(false)
    loadContractors()
  }

  async function handleMarkCompleted(id: string) {
    setSaving(true)
    const { error } = await updateContractor(id, { status: 'completed' })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Marked as completed')
    loadContractors()
  }

  function startEdit(c: ContractorRow) {
    setEditingId(c.id)
    setEditCompany(c.company_name)
    setEditContact(c.contact_name || '')
    setEditLocation(c.location)
    setEditDescription(c.work_description)
    setEditStartDate(c.start_date)
    setEditNotes(c.notes || '')
    setEditRadio(c.radio_number || '')
    setEditFlag(c.flag_number || '')
    setEditCallsign(c.callsign || '')
  }

  async function handleSaveEdit(id: string) {
    if (!editCompany.trim() || !editLocation.trim() || !editDescription.trim()) {
      toast.error('Company name, location, and work description are required')
      return
    }
    setSaving(true)
    const { error } = await updateContractor(id, {
      company_name: editCompany.trim(),
      contact_name: editContact.trim() || null,
      location: editLocation.trim(),
      work_description: editDescription.trim(),
      start_date: editStartDate,
      notes: editNotes.trim() || null,
      radio_number: editRadio.trim() || null,
      flag_number: editFlag.trim() || null,
      callsign: editCallsign.trim() || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Personnel updated')
    setEditingId(null)
    loadContractors()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-base)',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    color: 'var(--color-text-2)',
    marginBottom: 4,
  }

  return (
    <div data-tour="contractors-header" style={{ maxWidth: 900, margin: '0 auto', padding: '16px 16px 40px' }}>
      {/* Page header — tertiary tier-label + cyan accent rule */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, paddingBottom: 8, marginBottom: 16, flexWrap: 'wrap',
        borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HardHat size={16} color="var(--color-cyan)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Personnel on Airfield</div>
          {activeCount > 0 && (
            <span style={{
              background: 'color-mix(in srgb, var(--color-success) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
              color: 'var(--color-success)',
              fontSize: 'var(--fs-2xs)',
              fontWeight: 700,
              padding: '2px 9px',
              borderRadius: 'var(--radius-full)',
              marginLeft: 4,
              letterSpacing: '0.04em',
            }}>
              {activeCount} ACTIVE
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(prev => !prev); if (showForm) resetForm() }}
          style={{
            background: showForm
              ? 'var(--color-bg-inset)'
              : 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
            border: showForm
              ? '1px solid var(--color-border)'
              : '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
            color: showForm ? 'var(--color-text-2)' : 'var(--color-cyan)',
            borderRadius: 'var(--radius-md)',
            padding: '7px 14px',
            fontWeight: 700,
            fontSize: 'var(--fs-sm)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={14} />
          {showForm ? 'Cancel' : 'Add Personnel'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {editingTemplateIdx !== null ? 'Edit Template' : 'New Personnel Entry'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {canManageTemplates && formCompany.trim() && editingTemplateIdx === null && (
                <button onClick={() => setShowSaveTemplate(t => !t)} style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit',
                }}>Save as Template</button>
              )}
            </div>
          </div>

          {/* Save/edit template mini-form */}
          {showSaveTemplate && (
            <div style={{
              display: 'flex', gap: 8, marginBottom: 12, padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-cyan) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
            }}>
              <input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Template name (e.g. Kiewit - TWY A Joint Sealing)"
                style={{ ...inputStyle, flex: 1 }}
                autoFocus
              />
              <button onClick={editingTemplateIdx !== null ? handleUpdateTemplate : handleSaveAsTemplate} disabled={!templateName.trim()} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
                background: templateName.trim()
                  ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                  : 'var(--color-bg-elevated)',
                color: templateName.trim() ? 'var(--color-cyan)' : 'var(--color-text-4)',
                fontSize: 'var(--fs-xs)', fontWeight: 700, fontFamily: 'inherit',
                cursor: templateName.trim() ? 'pointer' : 'not-allowed',
              }}>{editingTemplateIdx !== null ? 'Update' : 'Save'}</button>
              {editingTemplateIdx !== null && (
                <button onClick={() => { setEditingTemplateIdx(null); setShowSaveTemplate(false); setTemplateName('') }} style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Cancel</button>
              )}
            </div>
          )}

          {/* Template dropdown */}
          {templates.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
              <select
                value=""
                onChange={e => {
                  const idx = parseInt(e.target.value)
                  if (!isNaN(idx) && templates[idx]) handleUseTemplate(templates[idx])
                }}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-cyan)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <option value="">— Select a template —</option>
                {templates.map((t, i) => (
                  <option key={i} value={i}>{t.name} — {t.company}</option>
                ))}
              </select>
              {canManageTemplates && usingTemplate && (
                <>
                  <button onClick={() => {
                    const idx = templates.findIndex(t => t.name === usingTemplate.name)
                    if (idx >= 0) handleEditTemplate(idx)
                  }} style={{
                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                    border: '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
                    background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
                    color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}><Pencil size={11} />Edit</button>
                  {canDeleteTemplates && (
                    <button onClick={() => {
                      const idx = templates.findIndex(t => t.name === usingTemplate.name)
                      if (idx >= 0) handleDeleteTemplate(idx)
                    }} style={{
                      padding: '8px 10px', borderRadius: 'var(--radius-md)',
                      border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)',
                      background: 'color-mix(in srgb, var(--color-danger) 14%, transparent)',
                      color: 'var(--color-danger)', fontSize: 'var(--fs-xs)', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}><Trash2 size={11} />Delete</button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Template summary (read-only) when using a template */}
          {usingTemplate && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-cyan) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
              marginBottom: 10,
            }}>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-cyan)', marginBottom: 4 }}>Template: {usingTemplate.name}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                <strong>Company:</strong> {usingTemplate.company}
                {usingTemplate.contact && <> &bull; <strong>Contact:</strong> {usingTemplate.contact}</>}
                {usingTemplate.callsign && <> &bull; <strong>Callsign:</strong> {usingTemplate.callsign}</>}
                {usingTemplate.contact_phone && <> &bull; <strong>Phone:</strong> {usingTemplate.contact_phone}</>}
                {usingTemplate.af_form_483 && <> &bull; <strong>{credentialLabel}:</strong> {usingTemplate.af_form_483}</>}
                {usingTemplate.af_form_483_expiration && <> &bull; <strong>Expires:</strong> {usingTemplate.af_form_483_expiration}</>}
              </div>
              {usingTemplate.af_form_483_expiration && new Date(usingTemplate.af_form_483_expiration) < new Date() && (
                <div style={{ marginTop: 4, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-danger)' }}>
                  {credentialLabel.toUpperCase()} EXPIRED
                </div>
              )}
            </div>
          )}

          {/* 2-col grid — matches the inline edit-form layout for
              consistency. Single-column flex was too tall on desktop
              (~12 stacked input rows for ~half the screen height). */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(!usingTemplate || editingTemplateIdx !== null) && (
              <>
                <div>
                  <div style={labelStyle}>Company Name *</div>
                  <input value={formCompany} onChange={e => setFormCompany(e.target.value)} placeholder="e.g. Kiewit Infrastructure" style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Contact Name</div>
                  <input value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} />
                </div>
              </>
            )}
            {editingTemplateIdx === null && (
              <>
                <div>
                  <div style={labelStyle}>Location *</div>
                  <input value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="e.g. TWY A/B Intersection" style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Start Date</div>
                  <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={labelStyle}>Work Description *</div>
                  <input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="e.g. Joint sealing and pavement repair" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--color-border)', margin: '2px 0' }} />
                <div>
                  <div style={labelStyle}>Radio Number Issued</div>
                  <input value={formRadio} onChange={e => setFormRadio(e.target.value)} placeholder="e.g. Radio 12" style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Flag Number Issued (Vehicle Escort)</div>
                  <input value={formFlag} onChange={e => setFormFlag(e.target.value)} placeholder="e.g. Flag 3" style={inputStyle} />
                </div>
              </>
            )}
            {(!usingTemplate || editingTemplateIdx !== null) && (
              <>
                <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--color-border)', margin: '2px 0' }} />
                <div>
                  <div style={labelStyle}>Callsign</div>
                  <input value={formCallsign} onChange={e => setFormCallsign(e.target.value)} placeholder="e.g. Bravo-1" style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>{credentialLabel} #</div>
                  <input value={formAf483} onChange={e => setFormAf483(e.target.value)} placeholder="e.g. 2026-0042" style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>{credentialLabel} Expiration Date</div>
                  <input type="date" value={formAf483Exp} onChange={e => setFormAf483Exp(e.target.value)} style={inputStyle} />
                  {formAf483Exp && new Date(formAf483Exp) < new Date() && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', fontWeight: 700, marginTop: 2 }}>EXPIRED</div>
                  )}
                </div>
                <div>
                  <div style={labelStyle}>Contact Phone Number</div>
                  <input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="e.g. 555-123-4567" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={labelStyle}>Notes</div>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Additional details..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </>
            )}
          </div>
          {editingTemplateIdx === null && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="btn-accent"
                style={{ padding: '8px 20px', width: 'auto', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : 'Add Personnel'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filters + Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['active', 'all', 'completed'] as FilterTab[]).map(tab => {
          const selected = filter === tab
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '6px 13px', borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
                border: selected ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
                cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700,
                background: selected
                  ? 'color-mix(in srgb, var(--color-cyan) 14%, var(--color-bg-surface))'
                  : 'var(--color-bg-inset)',
                color: selected ? 'var(--color-cyan)' : 'var(--color-text-2)',
                transition: 'background 0.15s',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          )
        })}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search personnel..."
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        <button
          onClick={handleExportPdf}
          disabled={generatingPdf || filtered.length === 0}
          style={{
            padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 700,
            border: '1px solid color-mix(in srgb, var(--color-purple) 35%, transparent)',
            background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
            color: 'var(--color-purple)', fontFamily: 'inherit',
            cursor: generatingPdf || filtered.length === 0 ? 'not-allowed' : 'pointer',
            opacity: generatingPdf || filtered.length === 0 ? 0.5 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <FileDown size={14} />
          {generatingPdf ? 'Generating…' : 'Export PDF'}
        </button>
        <button
          onClick={handleEmailPdf}
          disabled={generatingPdf || filtered.length === 0}
          aria-label="Email PDF"
          title="Email PDF"
          style={{
            padding: '6px 10px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 700,
            border: '1px solid color-mix(in srgb, var(--color-purple) 35%, transparent)',
            background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
            color: 'var(--color-purple)', fontFamily: 'inherit',
            cursor: generatingPdf || filtered.length === 0 ? 'not-allowed' : 'pointer',
            opacity: generatingPdf || filtered.length === 0 ? 0.5 : 1,
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          <Mail size={14} />
        </button>
      </div>

      {/* Contractor List */}
      {filtered.length === 0 ? (
        <EmptyState message={search ? 'No personnel match your search' : filter === 'active' ? 'No active personnel' : 'No personnel found'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const cfg = CONTRACTOR_STATUS_CONFIG[c.status]
            const isEditing = editingId === c.id
            const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(c.start_date).getTime()) / 86400000))
            // Day N urgency hierarchy — AF Form 483 escort credentials
            // are time-bounded so personnel lingering past ~2 weeks
            // should surface for AFM attention without a manual date
            // scan. 1-3 default, 4-7 slight emphasis, 8-13 amber,
            // 14+ danger.
            const dayColor = daysSinceStart >= 14
              ? 'var(--color-danger)'
              : daysSinceStart >= 8
                ? 'var(--color-warning)'
                : daysSinceStart >= 4
                  ? 'var(--color-text-2)'
                  : 'var(--color-text-3)'

            return (
              <div key={c.id} className="card" style={{ padding: 14 }}>
                {isEditing ? (
                  /* Edit mode */
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={labelStyle}>Company Name *</div>
                        <input value={editCompany} onChange={e => setEditCompany(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Contact Name</div>
                        <input value={editContact} onChange={e => setEditContact(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Location *</div>
                        <input value={editLocation} onChange={e => setEditLocation(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Start Date</div>
                        <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Work Description *</div>
                        <input value={editDescription} onChange={e => setEditDescription(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                      <div>
                        <div style={labelStyle}>Radio Number Issued</div>
                        <input value={editRadio} onChange={e => setEditRadio(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Callsign</div>
                        <input value={editCallsign} onChange={e => setEditCallsign(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Flag Number Issued (Vehicle Escort)</div>
                        <input value={editFlag} onChange={e => setEditFlag(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={labelStyle}>Notes</div>
                        <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: 'var(--fs-sm)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(c.id)}
                        disabled={saving}
                        className="btn-accent"
                        style={{ padding: '6px 14px', fontSize: 'var(--fs-sm)', opacity: saving ? 0.6 : 1 }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        {/* Header: Callsign (or company name fallback) + status badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                            {c.callsign || c.company_name}
                          </span>
                          <span style={{
                            fontSize: 'var(--fs-2xs)',
                            fontWeight: 700,
                            color: cfg.color,
                            background: cfg.bg,
                            border: `1px solid color-mix(in srgb, ${cfg.color} 35%, transparent)`,
                            padding: '1px 9px',
                            borderRadius: 'var(--radius-full)',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}>
                            {cfg.label}
                          </span>
                          {c.status === 'active' && (
                            <span style={{ fontSize: 'var(--fs-xs)', color: dayColor, fontWeight: 700 }}>
                              Day {daysSinceStart}
                            </span>
                          )}
                        </div>
                        {/* 2-column field grid — labels stay (operationally
                            important during ops) but compacted to inline
                            "LABEL value" rows so each pair fits on one line
                            and the card height halves. Each col is 1fr;
                            full-width rows (Notes, end_date) span both. */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          rowGap: 4,
                          columnGap: 18,
                          marginTop: 2,
                        }}>
                          <FieldCell label="Company" value={c.company_name} />
                          <FieldCell label="Work" value={c.work_description} />
                          {c.contact_name && (
                            <FieldCell label="Contact" value={c.contact_name} />
                          )}
                          {(c.radio_number || c.flag_number) && (
                            <FieldCell
                              label={c.radio_number && c.flag_number ? 'Radio · Flag' : c.radio_number ? 'Radio' : 'Flag'}
                              value={[c.radio_number, c.flag_number].filter(Boolean).join(' · ')}
                            />
                          )}
                          <FieldCell label="Location" value={c.location} />
                          <FieldCell
                            label="Started"
                            value={
                              c.end_date
                                ? `${formatZuluDate(new Date(c.start_date))} — ${formatZuluDate(new Date(c.end_date))}`
                                : formatZuluDate(new Date(c.start_date))
                            }
                          />
                        </div>
                        {c.notes && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic', marginTop: 4 }}>
                            {c.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => startEdit(c)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 'var(--fs-sm)', color: 'var(--color-cyan)' }}
                        >
                          Edit
                        </button>
                        {c.status === 'active' && (
                          <button
                            onClick={() => handleMarkCompleted(c.id)}
                            disabled={saving}
                            style={{
                              background: 'color-mix(in srgb, var(--color-success) 14%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--color-success) 45%, transparent)',
                              color: 'var(--color-success)',
                              borderRadius: 'var(--radius-md)',
                              padding: '6px 12px', fontWeight: 700, fontSize: 'var(--fs-sm)',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              opacity: saving ? 0.5 : 1, fontFamily: 'inherit',
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            <CheckCircle2 size={14} />
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename || 'personnel.pdf'}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}

// Compact "LABEL value" cell used inside the 2-column card body
// grid. Label is inline, uppercase letter-spaced --fs-2xs in
// text-4 so the value reads as the primary content and labels
// recede to typographic chrome.
function FieldCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      fontSize: 'var(--fs-sm)',
      color: 'var(--color-text-2)',
      minWidth: 0,
    }}>
      <span style={{
        fontSize: 'var(--fs-2xs)',
        fontWeight: 700,
        color: 'var(--color-text-4)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}
