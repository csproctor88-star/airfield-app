'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import {
  fetchQrcTemplates,
  fetchOpenExecutions,
  fetchExecutionHistory,
  startQrcExecution,
  updateStepResponse,
  updateScnData,
  closeQrcExecution,
  reopenQrcExecution,
  cancelQrcExecution,
  reviewQrcTemplate,
} from '@/lib/supabase/qrc'
import type { QrcTemplate, QrcExecution, QrcStep, QrcStepResponse } from '@/lib/supabase/types'

type Tab = 'available' | 'active' | 'history'

function zuluNow(): string {
  return new Date().toISOString().slice(11, 16).replace(':', '')
}

function isReviewOverdue(lastReviewed: string | null): boolean {
  if (!lastReviewed) return true
  const oneYear = 365 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(lastReviewed).getTime() > oneYear
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function QrcPage() {
  const { installationId } = useInstallation()
  const searchParams = useSearchParams()
  const execParam = searchParams.get('exec')
  const [tab, setTab] = useState<Tab>('available')
  const [templates, setTemplates] = useState<QrcTemplate[]>([])
  const [openExecs, setOpenExecs] = useState<QrcExecution[]>([])
  const [history, setHistory] = useState<QrcExecution[]>([])
  const [loaded, setLoaded] = useState(false)
  const [activeExecId, setActiveExecId] = useState<string | null>(execParam)
  const [startingId, setStartingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [t, o, h] = await Promise.all([
      fetchQrcTemplates(installationId),
      fetchOpenExecutions(installationId),
      fetchExecutionHistory(installationId),
    ])
    setTemplates(t)
    setOpenExecs(o)
    setHistory(h)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  // Auto-switch to active tab when loaded
  useEffect(() => {
    if (!loaded) return
    // If we have a deep-link exec param, switch to active tab
    if (activeExecId) {
      const inOpen = openExecs.some(e => e.id === activeExecId)
      const inHistory = history.some(e => e.id === activeExecId)
      if (inOpen || inHistory) {
        setTab('active')
        return
      }
    }
    // Otherwise auto-switch if there are open executions
    if (openExecs.length > 0 && tab === 'available') {
      setTab('active')
      setActiveExecId(openExecs[0].id)
    }
  }, [loaded, openExecs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStart(tmpl: QrcTemplate) {
    if (!installationId) return
    setStartingId(tmpl.id)
    const { data, error } = await startQrcExecution({
      base_id: installationId,
      template_id: tmpl.id,
      qrc_number: tmpl.qrc_number,
      title: tmpl.title,
    })
    if (error) { toast.error(error); setStartingId(null); return }
    if (data) {
      toast.success(`QRC-${tmpl.qrc_number} opened`)
      await load()
      setActiveExecId(data.id)
      setTab('active')
    }
    setStartingId(null)
  }

  const activeExec = openExecs.find(e => e.id === activeExecId) || history.find(e => e.id === activeExecId)
  const activeTemplate = activeExec ? templates.find(t => t.id === activeExec.template_id) : null

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'available', label: 'Available', count: templates.filter(t => t.is_active).length },
    { key: 'active', label: 'Active', count: openExecs.length },
    { key: 'history', label: 'History', count: history.length },
  ]

  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 16 }}>Quick Reaction Checklists</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setActiveExecId(null) }}
            style={{
              padding: '8px 16px', borderRadius: 8, fontFamily: 'inherit',
              border: tab === t.key ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
              cursor: 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700,
              background: tab === t.key ? 'rgba(56,189,248,0.12)' : 'var(--color-surface-2)',
              color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-2)',
            }}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading...</div>
      ) : tab === 'available' && !activeExecId ? (
        /* Available Templates Grid */
        templates.filter(t => t.is_active).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', marginBottom: 8 }}>No QRC templates configured.</div>
            <Link href="/settings/base-setup" style={{ color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
              Configure in Settings → Base Configuration
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {templates.filter(t => t.is_active).map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => handleStart(tmpl)}
                disabled={startingId === tmpl.id}
                style={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 'var(--fs-sm)', fontWeight: 800,
                    color: '#000', background: 'var(--color-warning)',
                    padding: '2px 8px', borderRadius: 6, minWidth: 44, textAlign: 'center',
                  }}>
                    QRC-{tmpl.qrc_number}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1.3 }}>
                  {tmpl.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                    {tmpl.steps.length} steps
                  </span>
                  {tmpl.last_reviewed_at ? (
                    <span style={{
                      fontSize: 'var(--fs-xs)', fontWeight: 600,
                      color: isReviewOverdue(tmpl.last_reviewed_at) ? '#EF4444' : '#22C55E',
                    }}>
                      {isReviewOverdue(tmpl.last_reviewed_at) ? 'Review overdue' : `Reviewed ${formatReviewDate(tmpl.last_reviewed_at)}`}
                    </span>
                  ) : (
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: '#EF4444' }}>
                      Never reviewed
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )
      ) : tab === 'active' ? (
        activeExecId && activeExec ? (
          /* Active Execution View */
          <QrcExecutionView
            execution={activeExec}
            template={activeTemplate}
            onBack={() => setActiveExecId(null)}
            onUpdate={load}
          />
        ) : (
          /* Active Executions List */
          openExecs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>
              No active QRCs. Start one from the Available tab.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openExecs.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setActiveExecId(ex.id)}
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '1px solid rgba(234,179,8,0.3)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span style={{
                    fontSize: 'var(--fs-sm)', fontWeight: 800,
                    color: '#000', background: '#EAB308',
                    padding: '2px 8px', borderRadius: 6,
                  }}>QRC-{ex.qrc_number}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)' }}>{ex.title}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                      Opened {new Date(ex.opened_at).toISOString().slice(11, 16)}Z
                      {ex.open_initials && ` by ${ex.open_initials}`}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 'var(--fs-sm)', fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                    background: 'rgba(234,179,8,0.12)', color: '#EAB308',
                  }}>OPEN</span>
                </button>
              ))}
            </div>
          )
        )
      ) : tab === 'history' ? (
        history.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>No QRC history.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(ex => (
              <button
                key={ex.id}
                onClick={() => { setActiveExecId(ex.id); setTab('active') }}
                style={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 800,
                  color: '#000', background: ex.status === 'open' ? '#EAB308' : '#22C55E',
                  padding: '2px 8px', borderRadius: 6,
                }}>QRC-{ex.qrc_number}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)' }}>{ex.title}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    {new Date(ex.opened_at).toLocaleDateString()} {new Date(ex.opened_at).toISOString().slice(11, 16)}Z
                    {ex.closed_at && ` — Closed ${new Date(ex.closed_at).toISOString().slice(11, 16)}Z`}
                  </div>
                </div>
                <span style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                  background: ex.status === 'open' ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)',
                  color: ex.status === 'open' ? '#EAB308' : '#22C55E',
                }}>{ex.status === 'open' ? 'OPEN' : 'CLOSED'}</span>
              </button>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// QRC Execution View — Interactive Step Renderer
// ═══════════════════════════════════════════════════════════════

function QrcExecutionView({
  execution,
  template,
  onBack,
  onUpdate,
}: {
  execution: QrcExecution
  template: QrcTemplate | null | undefined
  onBack: () => void
  onUpdate: () => Promise<void>
}) {
  const { installationId } = useInstallation()
  const [responses, setResponses] = useState<Record<string, QrcStepResponse>>(
    (execution.step_responses || {}) as Record<string, QrcStepResponse>
  )
  const [scnData, setScnDataState] = useState<Record<string, unknown>>(
    (execution.scn_data || {}) as Record<string, unknown>
  )
  const [closing, setClosing] = useState(false)
  const [closeInitials, setCloseInitials] = useState('')
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [reviewNotes, setReviewNotes] = useState(template?.review_notes || '')
  const [reviewing, setReviewing] = useState(false)
  const [reviewerName, setReviewerName] = useState<string | null>(null)

  const isClosed = execution.status === 'closed'
  const steps = template?.steps || []

  // Load reviewer name
  useEffect(() => {
    if (!template?.last_reviewed_by) return
    const supabase = (async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      if (!sb || !template.last_reviewed_by) return
      const { data } = await sb.from('profiles').select('name, rank').eq('id', template.last_reviewed_by).single()
      if (data) setReviewerName((data as { name: string; rank: string | null }).rank ? `${(data as { name: string; rank: string | null }).rank} ${(data as { name: string; rank: string | null }).name}` : (data as { name: string }).name)
    })()
    void supabase
  }, [template?.last_reviewed_by])

  // Flatten steps for counting
  function flattenSteps(s: QrcStep[]): QrcStep[] {
    const flat: QrcStep[] = []
    for (const step of s) {
      flat.push(step)
      if (step.sub_steps) flat.push(...flattenSteps(step.sub_steps))
    }
    return flat
  }
  const allSteps = flattenSteps(steps)
  const checkableSteps = allSteps.filter(s => s.type !== 'conditional')
  const completedSteps = checkableSteps.filter(s => responses[s.id]?.completed)
  const progress = checkableSteps.length > 0 ? (completedSteps.length / checkableSteps.length) * 100 : 0

  async function handleStepToggle(stepId: string) {
    if (isClosed) return
    const current = responses[stepId]
    const newResp: QrcStepResponse = {
      completed: !current?.completed,
      completed_at: !current?.completed ? new Date().toISOString() : undefined,
    }
    const updated = { ...responses, [stepId]: { ...current, ...newResp } }
    setResponses(updated)
    await updateStepResponse(execution.id, stepId, updated[stepId])
  }

  async function handleFieldChange(stepId: string, value: string) {
    if (isClosed) return
    const current = responses[stepId] || {}
    const updated = { ...responses, [stepId]: { ...current, value, completed: !!value } }
    setResponses(updated)
    await updateStepResponse(execution.id, stepId, updated[stepId])
  }

  async function handleAgencyToggle(stepId: string, agency: string) {
    if (isClosed) return
    const current = responses[stepId] || {}
    const checked = current.agencies_checked || []
    const next = checked.includes(agency)
      ? checked.filter((a: string) => a !== agency)
      : [...checked, agency]
    const updated = { ...responses, [stepId]: { ...current, agencies_checked: next, completed: next.length > 0 } }
    setResponses(updated)
    await updateStepResponse(execution.id, stepId, updated[stepId])
  }

  async function handleNotes(stepId: string, notes: string) {
    if (isClosed) return
    const current = responses[stepId] || {}
    const updated = { ...responses, [stepId]: { ...current, notes } }
    setResponses(updated)
    await updateStepResponse(execution.id, stepId, updated[stepId])
  }

  async function handleScnField(key: string, value: string) {
    if (isClosed) return
    const updated = { ...scnData, [key]: value }
    setScnDataState(updated)
    await updateScnData(execution.id, updated)
  }

  async function handleClose() {
    setClosing(true)
    const { error } = await closeQrcExecution(execution.id, closeInitials, installationId)
    if (error) toast.error(error)
    else {
      toast.success(`QRC-${execution.qrc_number} closed`)
      setShowCloseConfirm(false)
      await onUpdate()
    }
    setClosing(false)
  }

  async function handleReopen() {
    if (!confirm('Reopen this QRC?')) return
    const { error } = await reopenQrcExecution(execution.id)
    if (error) toast.error(error)
    else {
      toast.success('QRC reopened')
      await onUpdate()
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this QRC? This will permanently remove all data for this execution.')) return
    const { error } = await cancelQrcExecution(execution.id, installationId)
    if (error) toast.error(error)
    else {
      toast.success(`QRC-${execution.qrc_number} cancelled`)
      onBack()
      await onUpdate()
    }
  }

  async function handleReview() {
    if (!template) return
    setReviewing(true)
    const { error } = await reviewQrcTemplate(template.id, reviewNotes)
    if (error) toast.error(error)
    else {
      toast.success(`QRC-${template.qrc_number} marked as reviewed`)
      setShowReview(false)
      await onUpdate()
    }
    setReviewing(false)
  }

  function renderStep(step: QrcStep, depth = 0) {
    const resp = responses[step.id] || {}
    const checked = resp.completed ?? false

    return (
      <div key={step.id} style={{ marginLeft: depth * 20, marginBottom: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
          background: checked ? 'rgba(34,197,94,0.04)' : 'transparent',
          borderRadius: 8, border: '1px solid var(--color-border)',
        }}>
          {/* Step number */}
          <span style={{
            fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--color-text-3)',
            minWidth: 28, flexShrink: 0, paddingTop: 2,
          }}>{step.id}.</span>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Checkbox types */}
            {(step.type === 'checkbox' || step.type === 'checkbox_with_note') && (
              <div>
                <button
                  onClick={() => handleStepToggle(step.id)}
                  disabled={isClosed}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', cursor: isClosed ? 'default' : 'pointer',
                    padding: 0, fontFamily: 'inherit', textAlign: 'left', width: '100%',
                  }}
                >
                  <span style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    border: checked ? 'none' : '2px solid var(--color-border-mid)',
                    background: checked ? '#22C55E' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>&#10003;</span>}
                  </span>
                  <span style={{
                    fontSize: 'var(--fs-base)', fontWeight: 600,
                    color: checked ? 'var(--color-text-3)' : 'var(--color-text-1)',
                    textDecoration: checked ? 'line-through' : 'none',
                  }}>{step.label}</span>
                </button>
                {step.note && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, marginLeft: 28, fontStyle: 'italic' }}>
                    {step.note}
                  </div>
                )}
              </div>
            )}

            {/* Notify agencies */}
            {step.type === 'notify_agencies' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 6 }}>
                  {step.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 4 }}>
                  {(step.agencies || []).map(agency => {
                    const agencyChecked = (resp.agencies_checked || []).includes(agency)
                    return (
                      <button
                        key={agency}
                        onClick={() => handleAgencyToggle(step.id, agency)}
                        disabled={isClosed}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          background: 'none', border: 'none', cursor: isClosed ? 'default' : 'pointer',
                          padding: '2px 0', fontFamily: 'inherit', textAlign: 'left',
                        }}
                      >
                        <span style={{
                          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                          border: agencyChecked ? 'none' : '2px solid var(--color-border-mid)',
                          background: agencyChecked ? '#22C55E' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {agencyChecked && <span style={{ color: '#fff', fontSize: 9, fontWeight: 800 }}>&#10003;</span>}
                        </span>
                        <span style={{
                          fontSize: 'var(--fs-sm)',
                          color: agencyChecked ? 'var(--color-text-3)' : 'var(--color-text-1)',
                          textDecoration: agencyChecked ? 'line-through' : 'none',
                        }}>{agency}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Fill field */}
            {step.type === 'fill_field' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>
                  {step.label}
                </div>
                <input
                  className="input-dark"
                  placeholder={step.field_label || 'Enter value'}
                  value={resp.value || ''}
                  onChange={e => handleFieldChange(step.id, e.target.value)}
                  disabled={isClosed}
                  style={{ width: '100%', fontSize: 'var(--fs-sm)' }}
                />
              </div>
            )}

            {/* Time field */}
            {step.type === 'time_field' && (
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>
                  {step.label}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    className="input-dark"
                    placeholder={step.field_label || 'HHmm'}
                    value={resp.value || ''}
                    onChange={e => handleFieldChange(step.id, e.target.value)}
                    disabled={isClosed}
                    style={{ width: 100, fontSize: 'var(--fs-sm)', textAlign: 'center' }}
                  />
                  {!isClosed && (
                    <button
                      onClick={() => handleFieldChange(step.id, zuluNow())}
                      style={{
                        background: 'rgba(34,211,238,0.1)', border: '1px solid var(--color-cyan)',
                        borderRadius: 6, padding: '4px 10px', color: 'var(--color-cyan)',
                        fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >Now (Z)</button>
                  )}
                </div>
              </div>
            )}

            {/* Conditional */}
            {step.type === 'conditional' && (
              <div style={{
                fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-warning)',
                fontStyle: 'italic',
              }}>
                {step.label}
              </div>
            )}

          </div>

          {/* Timestamp */}
          {checked && resp.completed_at && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {new Date(resp.completed_at).toISOString().slice(11, 16)}Z
            </span>
          )}
        </div>

        {/* Sub-steps */}
        {step.sub_steps?.map(sub => renderStep(sub, depth + 1))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0, marginBottom: 6,
          }}>&larr; Back</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 'var(--fs-md)', fontWeight: 800,
              color: '#000', background: isClosed ? '#22C55E' : '#EAB308',
              padding: '3px 10px', borderRadius: 6,
            }}>QRC-{execution.qrc_number}</span>
            <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {execution.title}
            </span>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
            Opened {new Date(execution.opened_at).toISOString().slice(11, 16)}Z
            {execution.open_initials && ` by ${execution.open_initials}`}
            {execution.closed_at && ` | Closed ${new Date(execution.closed_at).toISOString().slice(11, 16)}Z`}
            {execution.close_initials && ` by ${execution.close_initials}`}
          </div>
        </div>
        <span style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, padding: '3px 10px', borderRadius: 8,
          background: isClosed ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
          color: isClosed ? '#22C55E' : '#EAB308',
        }}>{isClosed ? 'CLOSED' : 'OPEN'}</span>
      </div>

      {/* Warning note */}
      {template?.notes && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: '#EF4444',
        }}>
          {template.notes}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
            Progress: {completedSteps.length}/{checkableSteps.length} steps
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: progress === 100 ? '#22C55E' : 'var(--color-cyan)',
            borderRadius: 2, transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* References */}
      {template?.references && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginBottom: 12 }}>
          Ref: {template.references}
        </div>
      )}

      {/* SCN Form — data entry at top for quick capture */}
      {template?.has_scn_form && template.scn_fields && (
        <div style={{
          padding: 16, borderRadius: 10, marginBottom: 16,
          background: 'var(--color-bg-surface)', border: '1px solid rgba(34,211,238,0.2)',
        }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-cyan)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Secondary Crash Net (SCN) Form
          </div>
          {((template.scn_fields as { fields?: { key: string; label: string; type: string }[] }).fields || []).map(
            (field: { key: string; label: string; type: string }) => (
              <div key={field.key} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>
                  {field.label}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="input-dark"
                    value={(scnData[field.key] as string) || ''}
                    onChange={e => handleScnField(field.key, e.target.value)}
                    disabled={isClosed}
                    rows={2}
                    style={{ width: '100%', fontSize: 'var(--fs-sm)', resize: 'vertical' }}
                  />
                ) : (
                  <input
                    className="input-dark"
                    value={(scnData[field.key] as string) || ''}
                    onChange={e => handleScnField(field.key, e.target.value)}
                    disabled={isClosed}
                    style={{ width: '100%', fontSize: 'var(--fs-sm)' }}
                  />
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* Steps */}
      <div style={{ marginBottom: 16 }}>
        {steps.map(step => renderStep(step))}
      </div>

      {/* Annual Review Section */}
      {template && (
        <div style={{
          padding: 14, borderRadius: 10, marginBottom: 16,
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Annual Review
            </div>
            {template.last_reviewed_at ? (
              <span style={{
                fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: isReviewOverdue(template.last_reviewed_at) ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                color: isReviewOverdue(template.last_reviewed_at) ? '#EF4444' : '#22C55E',
              }}>
                {isReviewOverdue(template.last_reviewed_at) ? 'OVERDUE' : 'CURRENT'}
              </span>
            ) : (
              <span style={{
                fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: 'rgba(239,68,68,0.12)', color: '#EF4444',
              }}>NEVER REVIEWED</span>
            )}
          </div>
          {template.last_reviewed_at && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 6 }}>
              Last reviewed: {formatReviewDate(template.last_reviewed_at)}
              {reviewerName && ` by ${reviewerName}`}
            </div>
          )}
          {template.review_notes && !showReview && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic', marginBottom: 6 }}>
              {template.review_notes}
            </div>
          )}
          {showReview ? (
            <div>
              <textarea
                className="input-dark"
                placeholder="Review notes (optional) — e.g. steps verified, changes made, POC..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                rows={2}
                style={{ width: '100%', fontSize: 'var(--fs-sm)', resize: 'vertical', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleReview}
                  disabled={reviewing}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                    background: 'var(--color-cyan)', color: '#000', fontWeight: 700,
                    fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{reviewing ? 'Saving...' : 'Confirm Review'}</button>
                <button
                  onClick={() => setShowReview(false)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
                    fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowReview(true)}
              style={{
                padding: '6px 14px', borderRadius: 8,
                border: '1px solid var(--color-cyan)', background: 'rgba(34,211,238,0.06)',
                color: 'var(--color-cyan)', fontWeight: 700, fontSize: 'var(--fs-sm)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Mark as Reviewed</button>
          )}
        </div>
      )}

      {/* Close / Reopen */}
      {!isClosed ? (
        showCloseConfirm ? (
          <div style={{
            padding: 16, borderRadius: 10,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
              Close QRC-{execution.qrc_number}?
            </div>
            <input
              className="input-dark"
              placeholder="Closing initials (optional)"
              value={closeInitials}
              onChange={e => setCloseInitials(e.target.value)}
              style={{ width: '100%', marginBottom: 8, fontSize: 'var(--fs-sm)' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleClose}
                disabled={closing}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#22C55E', color: '#fff', fontWeight: 700,
                  fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{closing ? 'Closing...' : 'Confirm Close'}</button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                style={{
                  padding: '10px 16px', borderRadius: 8,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-2)', fontWeight: 700, fontSize: 'var(--fs-base)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >Back</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowCloseConfirm(true)}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 8, border: 'none',
                background: '#22C55E', color: '#fff', fontWeight: 700,
                fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Close QRC</button>
            <button
              onClick={handleCancel}
              style={{
                padding: '12px 16px', borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)',
                color: '#EF4444', fontWeight: 700, fontSize: 'var(--fs-base)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Cancel QRC</button>
          </div>
        )
      ) : (
        <button
          onClick={handleReopen}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8,
            border: '1px solid var(--color-border-mid)', background: 'transparent',
            color: 'var(--color-text-2)', fontWeight: 700, fontSize: 'var(--fs-base)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Reopen QRC</button>
      )}
    </div>
  )
}
