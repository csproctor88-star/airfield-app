'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ACSI_CHECKLIST_SECTIONS, ACSI_SUB_FIELD_LABELS } from '@/lib/constants'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import {
  saveAcsiDraft,
  fileAcsiInspection,
  fetchAcsiInspection,
} from '@/lib/supabase/acsi-inspections'
import {
  createNewAcsiDraft,
  loadAcsiDraft,
  saveAcsiDraftToStorage,
  clearAcsiDraft,
  acsiDraftToItems,
} from '@/lib/acsi-draft'
import { AcsiSection } from '@/components/acsi/acsi-section'
import { AcsiItem } from '@/components/acsi/acsi-item'
import { AcsiDiscrepancyPanel } from '@/components/acsi/acsi-discrepancy-panel'
import { AcsiTeamEditor } from '@/components/acsi/acsi-team-editor'
import { AcsiRiskCert } from '@/components/acsi/acsi-risk-cert'
import type { AcsiItemResponse, AcsiDiscrepancyDetail, AcsiTeamMember, AcsiSignatureBlock, AcsiDraftData } from '@/lib/supabase/types'
import { ArrowLeft, Plus, Save, CheckCircle } from 'lucide-react'

const EMPTY_DISCREPANCY: AcsiDiscrepancyDetail = {
  comment: '', work_order: '', project_number: '',
  estimated_cost: '', estimated_completion: '', photo_ids: [],
  areas: [], latitude: null, longitude: null, pins: [],
}

export default function AcsiFormPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume')
  const { installationId, currentInstallation } = useInstallation()

  // Draft state
  const [draft, setDraft] = useState<AcsiDraftData | null>(null)
  const [dbRowId, setDbRowId] = useState<string | null>(resumeId)
  const [airfieldName, setAirfieldName] = useState('')
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0])
  const [fiscalYear, setFiscalYear] = useState(() => {
    const now = new Date()
    return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear()
  })
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [filing, setFiling] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-save new draft to DB so photo uploads work immediately
  const autoSaveToDb = useCallback(async (draftData: AcsiDraftData, name: string, date: string, fy: number) => {
    const { items, passed, failed, na, total } = acsiDraftToItems(draftData)
    const { data, error } = await saveAcsiDraft({
      id: null,
      airfield_name: name,
      inspection_date: date,
      fiscal_year: fy,
      items,
      total_items: total,
      passed_count: passed,
      failed_count: failed,
      na_count: na,
      inspection_team: draftData.team,
      risk_cert_signatures: draftData.signatures,
      notes: draftData.notes || null,
      draft_data: draftData,
      base_id: installationId,
    })
    if (!error && data) {
      setDbRowId(data.id)
    }
  }, [installationId])

  // Load draft on mount
  useEffect(() => {
    async function init() {
      // Try resuming from DB
      if (resumeId) {
        const existing = await fetchAcsiInspection(resumeId)
        if (existing && existing.draft_data) {
          setDraft(existing.draft_data)
          setDbRowId(existing.id)
          setAirfieldName(existing.airfield_name)
          setInspectionDate(existing.inspection_date)
          setFiscalYear(existing.fiscal_year)
          setExpandedSections({})
          setLoaded(true)
          return
        }
      }

      // Try localStorage
      const stored = loadAcsiDraft(installationId)
      if (stored) {
        setDraft(stored)
        setExpandedSections({})
      } else {
        // New inspection — create draft and auto-save to DB
        const newDraft = createNewAcsiDraft()
        setDraft(newDraft)
        const name = currentInstallation?.name || ''
        const date = new Date().toISOString().split('T')[0]
        const now = new Date()
        const fy = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear()
        autoSaveToDb(newDraft, name, date, fy)
      }

      setLoaded(true)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-fill airfield name from installation
  useEffect(() => {
    if (currentInstallation && !airfieldName) {
      setAirfieldName(currentInstallation.name)
    }
  }, [currentInstallation, airfieldName])

  // Auto-save to localStorage with debounce
  const autoSave = useCallback((d: AcsiDraftData) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveAcsiDraftToStorage(d, installationId)
    }, 1000)
  }, [installationId])

  const updateDraft = useCallback((updater: (prev: AcsiDraftData) => AcsiDraftData) => {
    setDraft(prev => {
      if (!prev) return prev
      const next = updater(prev)
      autoSave(next)
      return next
    })
  }, [autoSave])

  // Direct response setter (click Y/N/N/A to set, click again to clear)
  const handleSetResponse = useCallback((itemId: string, value: AcsiItemResponse) => {
    updateDraft(prev => {
      const responses = { ...prev.responses, [itemId]: value }

      // Auto-create discrepancy entry when fail
      let discrepancies = prev.discrepancies
      if (value === 'fail' && !discrepancies[itemId]) {
        discrepancies = {
          ...discrepancies,
          [itemId]: { ...EMPTY_DISCREPANCY },
        }
      }

      return { ...prev, responses, discrepancies }
    })
  }, [updateDraft])

  const handleDiscrepancyChange = useCallback((itemId: string, detail: AcsiDiscrepancyDetail) => {
    updateDraft(prev => ({
      ...prev,
      discrepancies: { ...prev.discrepancies, [itemId]: detail },
    }))
  }, [updateDraft])

  const handleTeamChange = useCallback((team: AcsiTeamMember[]) => {
    updateDraft(prev => ({ ...prev, team }))
  }, [updateDraft])

  const handleSignaturesChange = useCallback((signatures: AcsiSignatureBlock[]) => {
    updateDraft(prev => ({ ...prev, signatures }))
  }, [updateDraft])

  const handleNotesChange = useCallback((notes: string) => {
    updateDraft(prev => ({ ...prev, notes }))
  }, [updateDraft])

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const next = { ...prev, [sectionId]: !prev[sectionId] }
      // Also persist in draft
      updateDraft(d => ({ ...d, collapsedSections: next }))
      return next
    })
  }, [updateDraft])

  // Add local item for Section 10
  const handleAddLocalItem = useCallback(() => {
    updateDraft(prev => ({
      ...prev,
      localItems: [
        ...prev.localItems,
        { id: `10.${prev.localItems.length + 4}`, question: '' },
      ],
    }))
  }, [updateDraft])

  const handleLocalItemChange = useCallback((id: string, question: string) => {
    updateDraft(prev => ({
      ...prev,
      localItems: prev.localItems.map(li => li.id === id ? { ...li, question } : li),
    }))
  }, [updateDraft])

  // Save Draft to DB
  const handleSaveDraft = async () => {
    if (!draft) return
    setSaving(true)
    const { items, passed, failed, na, total } = acsiDraftToItems(draft)
    const { data, error } = await saveAcsiDraft({
      id: dbRowId,
      airfield_name: airfieldName,
      inspection_date: inspectionDate,
      fiscal_year: fiscalYear,
      items,
      total_items: total,
      passed_count: passed,
      failed_count: failed,
      na_count: na,
      inspection_team: draft.team,
      risk_cert_signatures: draft.signatures,
      notes: draft.notes || null,
      draft_data: draft,
      base_id: installationId,
    })
    setSaving(false)

    if (error) {
      toast.error(`Save failed: ${error}`)
    } else if (data) {
      setDbRowId(data.id)
      toast.success('Draft saved to database')
    }
  }

  // Complete & File
  const handleFile = async () => {
    if (!draft) return
    if (!dbRowId) {
      // Must save first
      toast.error('Please save the draft first before filing')
      return
    }

    const { items, passed, failed, na, total } = acsiDraftToItems(draft)
    const unanswered = total - passed - failed - na
    if (unanswered > 0) {
      if (!confirm(`${unanswered} items are unanswered. File anyway?`)) return
    }

    setFiling(true)

    // Get user info
    let completedByName = 'Unknown'
    let completedById: string | null = null
    const supabase = createClient()
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          completedById = user.id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: profile } = await (supabase as any)
            .from('profiles')
            .select('name, rank')
            .eq('id', user.id)
            .single()
          if (profile) {
            completedByName = profile.rank ? `${profile.rank} ${profile.name}` : profile.name
          }
        }
      } catch { /* ignore */ }
    }

    const { data, error } = await fileAcsiInspection({
      id: dbRowId,
      items,
      total_items: total,
      passed_count: passed,
      failed_count: failed,
      na_count: na,
      airfield_name: airfieldName,
      inspection_date: inspectionDate,
      fiscal_year: fiscalYear,
      inspection_team: draft.team,
      risk_cert_signatures: draft.signatures,
      notes: draft.notes || null,
      inspector_name: completedByName,
      completed_by_name: completedByName,
      completed_by_id: completedById,
      base_id: installationId,
    })

    setFiling(false)

    if (error) {
      toast.error(`Filing failed: ${error}`)
    } else if (data) {
      clearAcsiDraft(installationId)
      toast.success('ACSI inspection filed successfully')
      router.push(`/acsi/${data.id}`)
    }
  }

  if (!loaded || !draft) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)' }}>Loading...</div>
  }

  // Calculate counts
  const { passed, failed, na, total } = acsiDraftToItems(draft)
  const answered = passed + failed + na
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-input)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-sm)',
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Back link */}
      <Link href="/acsi" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)', marginBottom: 16,
      }}>
        <ArrowLeft size={14} /> Back to ACSI List
      </Link>

      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: '0 0 20px' }}>
        {dbRowId ? 'Edit ACSI Inspection' : 'New ACSI Inspection'}
      </h1>

      {/* Cover fields */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20,
        padding: '18px 18px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg-surface)',
      }}>
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', display: 'block', marginBottom: 6 }}>
            Airfield Name
          </label>
          <input
            type="text"
            value={airfieldName}
            onChange={(e) => setAirfieldName(e.target.value)}
            placeholder="Installation name"
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', display: 'block', marginBottom: 6 }}>
            Inspection Date
          </label>
          <input
            type="date"
            value={inspectionDate}
            onChange={(e) => setInspectionDate(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', display: 'block', marginBottom: 6 }}>
            Inspection Year
          </label>
          <input
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value) || fiscalYear)}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        padding: '12px 16px', marginBottom: 20, border: '1px solid var(--color-border)',
        borderRadius: 8, background: 'var(--color-bg-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>
            Progress: {answered}/{total} ({pct}%)
          </span>
          <div style={{ display: 'flex', gap: 10, fontSize: 'var(--fs-xs)' }}>
            <span style={{ color: '#10B981', fontWeight: 600 }}>{passed} Pass</span>
            <span style={{ color: '#EF4444', fontWeight: 600 }}>{failed} Fail</span>
            <span style={{ color: '#6B7280', fontWeight: 600 }}>{na} N/A</span>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--color-bg-sunken)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, transition: 'width 0.3s',
            width: `${pct}%`,
            background: pct === 100 ? '#10B981' : 'var(--color-accent)',
          }} />
        </div>
      </div>

      {/* Checklist Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
        {ACSI_CHECKLIST_SECTIONS.map(section => {
          // Build all answerable item IDs (sub-fields expand to .a/.b/.c)
          const allItemIds: string[] = []
          for (const item of section.items) {
            if (item.isHeading) continue
            if (item.hasSubFields) {
              for (const sf of ACSI_SUB_FIELD_LABELS) {
                allItemIds.push(`${item.id}.${sf.key}`)
              }
            } else {
              allItemIds.push(item.id)
            }
          }
          if (section.id === 'acsi-10') {
            for (const li of draft.localItems) allItemIds.push(li.id)
          }

          // Track subsection grouping
          let lastSubsection: string | undefined = undefined

          return (
            <AcsiSection
              key={section.id}
              title={section.title}
              number={section.number}
              reference={section.reference}
              scope={section.scope}
              preamble={section.preamble}
              totalItems={allItemIds.length}
              responses={draft.responses}
              itemIds={allItemIds}
              expanded={expandedSections[section.id] || false}
              onToggle={() => toggleSection(section.id)}
            >
              {section.items.map((item, idx) => {
                const showSubsection = item.subsection && item.subsection !== lastSubsection
                lastSubsection = item.subsection
                return (
                  <AcsiItem
                    key={item.id}
                    id={item.id}
                    itemNumber={item.id}
                    question={item.question}
                    subsection={showSubsection ? item.subsection : undefined}
                    response={draft.responses[item.id] ?? null}
                    onSetResponse={handleSetResponse}
                    index={idx}
                    isHeading={item.isHeading}
                    hasSubFields={item.hasSubFields}
                    subFieldResponses={item.hasSubFields ? draft.responses : undefined}
                    renderSubFieldChildren={item.hasSubFields ? (subId: string) => (
                      draft.responses[subId] === 'fail' ? (
                        <AcsiDiscrepancyPanel
                          itemId={subId}
                          detail={draft.discrepancies[subId] || { ...EMPTY_DISCREPANCY }}
                          onChange={handleDiscrepancyChange}
                          inspectionId={dbRowId}
                        />
                      ) : null
                    ) : undefined}
                  >
                    {draft.responses[item.id] === 'fail' && !item.hasSubFields && !item.isHeading && (
                      <AcsiDiscrepancyPanel
                        itemId={item.id}
                        detail={draft.discrepancies[item.id] || { ...EMPTY_DISCREPANCY }}
                        onChange={handleDiscrepancyChange}
                        inspectionId={dbRowId}
                      />
                    )}
                  </AcsiItem>
                )
              })}

              {/* Section 10: local items */}
              {section.id === 'acsi-10' && (
                <>
                  {draft.localItems.map((li, liIdx) => (
                    <div key={li.id}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 10px',
                        borderRadius: 6,
                        background: draft.responses[li.id] === 'fail'
                          ? 'rgba(239, 68, 68, 0.06)'
                          : liIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                      }}>
                        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-3)', minWidth: 48 }}>
                          {li.id}
                        </span>
                        <input
                          type="text"
                          value={li.question}
                          onChange={(e) => handleLocalItemChange(li.id, e.target.value)}
                          placeholder="Enter local item description..."
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['pass', 'fail', 'na'] as const).map(val => {
                            const active = draft.responses[li.id] === val
                            const bgMap = { pass: '#10B981', fail: '#EF4444', na: '#6B7280' }
                            const labels = { pass: 'Y', fail: 'N', na: 'N/A' }
                            return (
                              <button
                                key={val}
                                onClick={() => handleSetResponse(li.id, active ? null : val)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 5,
                                  border: active ? 'none' : '1px solid var(--color-border)',
                                  background: active ? bgMap[val] : 'transparent',
                                  color: active ? '#fff' : 'var(--color-text-3)',
                                  fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer',
                                  minWidth: val === 'na' ? 40 : 34, textAlign: 'center' as const,
                                }}
                              >
                                {labels[val]}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      {draft.responses[li.id] === 'fail' && (
                        <AcsiDiscrepancyPanel
                          itemId={li.id}
                          detail={draft.discrepancies[li.id] || { ...EMPTY_DISCREPANCY }}
                          onChange={handleDiscrepancyChange}
                        />
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handleAddLocalItem}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                      padding: '8px 14px', borderRadius: 6, border: '1px dashed var(--color-border)',
                      background: 'transparent', color: 'var(--color-text-2)',
                      fontSize: 'var(--fs-sm)', cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Add Local Item
                  </button>
                </>
              )}
            </AcsiSection>
          )
        })}
      </div>

      {/* Inspection Team */}
      <div style={{ marginTop: 12, marginBottom: 28 }}>
        <AcsiTeamEditor team={draft.team} onChange={handleTeamChange} />
      </div>

      {/* Risk Management Certification */}
      <div style={{ marginBottom: 28 }}>
        <AcsiRiskCert signatures={draft.signatures} onChange={handleSignaturesChange} />
      </div>

      {/* General Notes */}
      <div style={{
        marginBottom: 28, border: '1px solid var(--color-border)', borderRadius: 8,
        padding: 16, background: 'var(--color-bg-surface)',
      }}>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 8 }}>
          General Notes
        </div>
        <textarea
          value={draft.notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Additional notes, observations, or recommendations..."
          rows={4}
          style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
        />
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 12, padding: '16px 0',
        borderTop: '1px solid var(--color-border)',
        position: 'sticky', bottom: 0, background: 'var(--color-bg-page)', zIndex: 10,
      }}>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          onClick={handleFile}
          disabled={filing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 8,
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--fs-base)', fontWeight: 600, cursor: 'pointer',
            opacity: filing ? 0.5 : 1,
          }}
        >
          <CheckCircle size={16} /> {filing ? 'Filing...' : 'Complete & File'}
        </button>
      </div>
    </div>
  )
}
