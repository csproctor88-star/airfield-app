'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Zap, AlertOctagon, CheckCircle2, AlertCircle,
  Clock, Calendar, FileDown, Mail, RotateCcw, X,
} from 'lucide-react'
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
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import { getStepStatus, getAgencyStatus, type QrcStepStatus } from '@/lib/qrc-step-status'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { QrcStepToggle, QrcStepStatusPill } from '@/components/ui/qrc-step-toggle'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'

type Tab = 'available' | 'active' | 'history'

const PILL = {
  open: {
    bg: 'color-mix(in srgb, var(--color-amber) 14%, var(--color-bg-surface))',
    border: 'color-mix(in srgb, var(--color-amber) 35%, transparent)',
    color: 'var(--color-amber)',
  },
  closed: {
    bg: 'color-mix(in srgb, var(--color-success) 14%, var(--color-bg-surface))',
    border: 'color-mix(in srgb, var(--color-success) 35%, transparent)',
    color: 'var(--color-success)',
  },
  overdue: {
    bg: 'color-mix(in srgb, var(--color-danger) 14%, var(--color-bg-surface))',
    border: 'color-mix(in srgb, var(--color-danger) 35%, transparent)',
    color: 'var(--color-danger)',
  },
  current: {
    bg: 'color-mix(in srgb, var(--color-success) 14%, var(--color-bg-surface))',
    border: 'color-mix(in srgb, var(--color-success) 35%, transparent)',
    color: 'var(--color-success)',
  },
} as const

function zuluNow(): string {
  return new Date().toISOString().slice(11, 16).replace(':', '')
}

function isReviewOverdue(lastReviewed: string | null): boolean {
  if (!lastReviewed) return true
  const oneYear = 365 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(lastReviewed).getTime() > oneYear
}

function formatReviewDate(iso: string): string {
  return formatZuluDate(new Date(iso))
}

function QrcBadge({ number, size = 'md' }: { number: number; size?: 'sm' | 'md' | 'lg' }) {
  const padding = size === 'lg' ? '4px 12px' : size === 'sm' ? '2px 8px' : '3px 10px'
  const fs = size === 'lg' ? 'var(--fs-lg)' : size === 'sm' ? 'var(--fs-sm)' : 'var(--fs-base)'
  return (
    <span style={{
      fontSize: fs, fontWeight: 800, color: 'var(--color-amber)',
      background: 'color-mix(in srgb, var(--color-amber) 14%, var(--color-bg-surface))',
      border: '1px solid color-mix(in srgb, var(--color-amber) 45%, transparent)',
      padding, borderRadius: 'var(--radius-sm)',
      letterSpacing: '0.02em', flexShrink: 0,
    }}>QRC-{number}</span>
  )
}

function StatusPill({ kind, children }: { kind: keyof typeof PILL; children: React.ReactNode }) {
  const tier = PILL[kind]
  return (
    <span style={{
      fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '3px 9px',
      borderRadius: 12, background: tier.bg, color: tier.color,
      border: `1px solid ${tier.border}`,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>{children}</span>
  )
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('glidepath:badges-refresh'))
    }
  }, [installationId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!loaded) return
    if (activeExecId) {
      const inOpen = openExecs.some(e => e.id === activeExecId)
      const inHistory = history.some(e => e.id === activeExecId)
      if (inOpen || inHistory) {
        setTab('active')
        return
      }
    }
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
      {/* Page header — tertiary + accent rule */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
        paddingBottom: 8, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={16} color="var(--color-amber)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Quick Reaction Checklists</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const selected = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setActiveExecId(null) }}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
                border: selected ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
                cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700,
                background: selected
                  ? 'color-mix(in srgb, var(--color-cyan) 14%, var(--color-bg-surface))'
                  : 'var(--color-bg-inset)',
                color: selected ? 'var(--color-cyan)' : 'var(--color-text-2)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{
                  fontSize: 'var(--fs-2xs)', fontWeight: 800,
                  padding: '1px 7px', borderRadius: 10,
                  background: selected
                    ? 'color-mix(in srgb, var(--color-cyan) 22%, transparent)'
                    : 'var(--color-bg-elevated)',
                  color: selected ? 'var(--color-cyan)' : 'var(--color-text-3)',
                  minWidth: 20, textAlign: 'center',
                }}>{t.count}</span>
              )}
            </button>
          )
        })}
      </div>

      {!loaded ? (
        <LoadingState />
      ) : tab === 'available' && !activeExecId ? (
        templates.filter(t => t.is_active).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', marginBottom: 8 }}>
              No QRC templates configured.
            </div>
            <Link href="/settings/base-setup" style={{ color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
              Configure in Settings → Base Configuration
            </Link>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10,
          }}>
            {templates.filter(t => t.is_active).map(tmpl => {
              const overdue = isReviewOverdue(tmpl.last_reviewed_at)
              return (
                <button
                  key={tmpl.id}
                  onClick={() => handleStart(tmpl)}
                  disabled={startingId === tmpl.id}
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderLeft: '3px solid var(--color-amber)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <QrcBadge number={tmpl.qrc_number} size="sm" />
                    <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', marginLeft: 'auto' }}>
                      {((tmpl.steps as unknown as QrcStep[] | null) || []).length} steps
                    </span>
                  </div>
                  <div style={{
                    fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)',
                    lineHeight: 1.3, marginBottom: 8,
                  }}>{tmpl.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {tmpl.last_reviewed_at ? (
                      overdue ? (
                        <>
                          <AlertCircle size={12} color="var(--color-danger)" />
                          <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-danger)' }}>
                            Review overdue
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} color="var(--color-success)" />
                          <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-success)' }}>
                            Reviewed {formatReviewDate(tmpl.last_reviewed_at)}
                          </span>
                        </>
                      )
                    ) : (
                      <>
                        <AlertCircle size={12} color="var(--color-danger)" />
                        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-danger)' }}>
                          Never reviewed
                        </span>
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )
      ) : tab === 'active' ? (
        activeExecId && activeExec ? (
          <QrcExecutionView
            execution={activeExec}
            template={activeTemplate}
            onBack={() => setActiveExecId(null)}
            onUpdate={load}
          />
        ) : (
          openExecs.length === 0 ? (
            <EmptyState message="No active QRCs. Start one from the Available tab." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openExecs.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setActiveExecId(ex.id)}
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderLeft: '3px solid var(--color-amber)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <QrcBadge number={ex.qrc_number} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)' }}>
                      {ex.title}
                    </div>
                    <div style={{
                      fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 2,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <Clock size={11} />
                      Opened {new Date(ex.opened_at).toISOString().slice(11, 16)}Z
                      {ex.open_initials && ` by ${ex.open_initials}`}
                    </div>
                  </div>
                  <StatusPill kind="open">Open</StatusPill>
                </button>
              ))}
            </div>
          )
        )
      ) : tab === 'history' ? (
        history.length === 0 ? (
          <EmptyState message="No QRC history." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(ex => {
              const isOpen = ex.status === 'open'
              return (
                <button
                  key={ex.id}
                  onClick={() => { setActiveExecId(ex.id); setTab('active') }}
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${isOpen ? 'var(--color-amber)' : 'var(--color-border-mid)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <QrcBadge number={ex.qrc_number} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)' }}>
                      {ex.title}
                    </div>
                    <div style={{
                      fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 2,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      <Clock size={11} />
                      {formatZuluDateTime(new Date(ex.opened_at))}
                      {ex.closed_at && ` — Closed ${formatZuluDateTime(new Date(ex.closed_at))}`}
                    </div>
                  </div>
                  <StatusPill kind={isOpen ? 'open' : 'closed'}>{isOpen ? 'Open' : 'Closed'}</StatusPill>
                </button>
              )
            })}
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
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()
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

  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

  const isClosed = execution.status === 'closed'
  const steps = (template?.steps as unknown as QrcStep[] | null) || []

  useEffect(() => {
    if (!template?.last_reviewed_by) return
    const supabase = (async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const sb = createClient()
      if (!sb || !template.last_reviewed_by) return
      const { data } = await sb.from('profiles').select('name, rank').eq('id', template.last_reviewed_by).single()
      if (data) {
        const r = data as { name: string; rank: string | null }
        setReviewerName(r.rank ? `${r.rank} ${r.name}` : r.name)
      }
    })()
    void supabase
  }, [template?.last_reviewed_by])

  function flattenSteps(s: QrcStep[]): QrcStep[] {
    const flat: QrcStep[] = []
    for (const step of s) {
      flat.push(step)
      if (step.sub_steps) flat.push(...flattenSteps(step.sub_steps))
    }
    return flat
  }
  const allSteps = flattenSteps(steps)
  const checkableSteps = allSteps.filter(s => s.type !== 'conditional' && s.type !== 'text' && s.type !== 'textarea')
  const naSteps = checkableSteps.filter(s => getStepStatus(responses[s.id]) === 'not_applicable')
  const completedSteps = checkableSteps.filter(s => getStepStatus(responses[s.id]) === 'completed')
  const denominator = checkableSteps.length - naSteps.length
  const progress = denominator > 0 ? (completedSteps.length / denominator) * 100 : 0

  async function handleStepStatus(stepId: string, next: QrcStepStatus) {
    if (isClosed) return
    const current = responses[stepId] || { completed: false }
    const newResp: QrcStepResponse = {
      ...current,
      status: next,
      completed: next === 'completed',
      completed_at: next === 'completed' ? new Date().toISOString() : current.completed_at,
    }
    if (next === undefined) {
      delete (newResp as Partial<QrcStepResponse>).status
    }
    const updated = { ...responses, [stepId]: newResp }
    setResponses(updated)
    await updateStepResponse(execution.id, stepId, newResp)
  }

  async function handleFieldChange(stepId: string, value: string) {
    if (isClosed) return
    const current = responses[stepId] || { completed: false }
    const newResp: QrcStepResponse = {
      ...current,
      value,
      completed: !!value,
      status: value ? 'completed' : undefined,
    }
    if (!value) delete (newResp as Partial<QrcStepResponse>).status
    const updated = { ...responses, [stepId]: newResp }
    setResponses(updated)
    await updateStepResponse(execution.id, stepId, newResp)
  }

  async function handleAgencyStatus(stepId: string, agency: string, next: QrcStepStatus) {
    if (isClosed) return
    const current = responses[stepId] || { completed: false }
    const checked = (current.agencies_checked || []).filter(a => a !== agency)
    const na = (current.agencies_na || []).filter(a => a !== agency)
    if (next === 'completed') checked.push(agency)
    else if (next === 'not_applicable') na.push(agency)
    const anyMarked = checked.length + na.length > 0
    const newResp: QrcStepResponse = {
      ...current,
      agencies_checked: checked,
      agencies_na: na,
      completed: checked.length > 0,
      status: anyMarked && checked.length === 0 && na.length > 0 ? 'not_applicable' : (checked.length > 0 ? 'completed' : undefined),
    }
    if (!anyMarked) delete (newResp as Partial<QrcStepResponse>).status
    const updated = { ...responses, [stepId]: newResp }
    setResponses(updated)
    await updateStepResponse(execution.id, stepId, newResp)
  }

  async function handleNotes(stepId: string, notes: string) {
    if (isClosed) return
    const current = responses[stepId] || { completed: false }
    const newResp = { ...current, notes }
    const updated = { ...responses, [stepId]: newResp }
    setResponses(updated)
    await updateStepResponse(execution.id, stepId, newResp)
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
      await onUpdate()
      onBack()
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

  async function preparePdf() {
    const { generateQrcPdf } = await import('@/lib/qrc-pdf')
    return generateQrcPdf({
      execution,
      template: template || null,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
    })
  }

  async function handleExportPdf() {
    setGeneratingPdf(true)
    try {
      const { doc, filename } = await preparePdf()
      doc.save(filename)
    } catch (e) {
      console.error('PDF export failed:', e)
      toast.error('PDF export failed')
    }
    setGeneratingPdf(false)
  }

  async function handleEmailPdf() {
    setGeneratingPdf(true)
    try {
      const result = await preparePdf()
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (e) {
      console.error('PDF generation failed:', e)
      toast.error('PDF generation failed')
    }
    setGeneratingPdf(false)
  }

  async function handleSendEmail(email: string) {
    if (!emailPdfData) return
    setSendingEmail(true)
    const result = await sendPdfViaEmail(
      emailPdfData.doc,
      emailPdfData.filename,
      email,
      `QRC-${execution.qrc_number}: ${execution.title}`,
    )
    if (result.success) {
      toast.success('Email sent successfully')
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } else {
      toast.error(result.error || 'Failed to send email')
    }
    setSendingEmail(false)
  }

  function renderStep(step: QrcStep, depth = 0) {
    const resp = responses[step.id]
    const status = getStepStatus(resp)

    const isToggleType = step.type === 'checkbox' || step.type === 'checkbox_with_note'
    const rowBg = status === 'completed'
      ? 'color-mix(in srgb, var(--color-success) 6%, transparent)'
      : status === 'not_applicable'
        ? 'color-mix(in srgb, var(--color-text-3) 5%, transparent)'
        : 'transparent'

    // Sub-step indent must clear the parent's number column (padding 12 + minWidth 30 = 42)
    // so the sub-step card's left border doesn't visually cut through the parent's "N." stamp.
    // marginTop on sub-steps separates them from the parent's bottom border (without a gap they
    // visually merge into one card and the indented child looks "embedded" in the parent).
    return (
      <div key={step.id} style={{
        marginLeft: depth * 44,
        marginTop: depth > 0 ? 6 : 0,
        marginBottom: 8,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
          background: rowBg,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
        }}>
          {/* Step number */}
          <span style={{
            fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--color-text-3)',
            minWidth: 30, flexShrink: 0, paddingTop: 2,
          }}>{step.id}.</span>

          <div style={{ flex: 1, minWidth: 0 }}>
            {isToggleType && (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 'var(--fs-md)', fontWeight: 600,
                    color: status === 'completed' ? 'var(--color-text-3)' : 'var(--color-text-1)',
                    textDecoration: status === 'completed' ? 'line-through' : 'none',
                    flex: 1, minWidth: 0, paddingTop: 2,
                  }}>{step.label}</span>
                  {isClosed ? (
                    <QrcStepStatusPill status={status} />
                  ) : (
                    <QrcStepToggle
                      value={status}
                      onChange={next => handleStepStatus(step.id, next)}
                    />
                  )}
                </div>
                {step.note && (
                  <div style={{
                    fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
                    marginTop: 4, fontStyle: 'italic',
                  }}>{step.note}</div>
                )}
                {step.type === 'checkbox_with_note' && (
                  <input
                    className="input-dark"
                    placeholder="Add note (optional)"
                    value={resp?.notes || ''}
                    onChange={e => handleNotes(step.id, e.target.value)}
                    disabled={isClosed}
                    style={{ width: '100%', fontSize: 'var(--fs-sm)', marginTop: 6 }}
                  />
                )}
              </div>
            )}

            {step.type === 'notify_agencies' && (
              <div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 8 }}>
                  {step.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(step.agencies || []).map(agency => {
                    const agencyStatus = getAgencyStatus(resp, agency)
                    return (
                      <div key={agency} style={{
                        display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between',
                        padding: '4px 0',
                      }}>
                        <span style={{
                          fontSize: 'var(--fs-base)',
                          color: agencyStatus === 'completed' ? 'var(--color-text-3)' : 'var(--color-text-1)',
                          textDecoration: agencyStatus === 'completed' ? 'line-through' : 'none',
                        }}>{agency}</span>
                        {isClosed ? (
                          <QrcStepStatusPill status={agencyStatus} />
                        ) : (
                          <QrcStepToggle
                            value={agencyStatus}
                            onChange={next => handleAgencyStatus(step.id, agency, next)}
                            size="sm"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {step.type === 'fill_field' && (
              <div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>
                  {step.label}
                </div>
                <input
                  className="input-dark"
                  placeholder={step.field_label || 'Enter value'}
                  value={resp?.value || ''}
                  onChange={e => handleFieldChange(step.id, e.target.value)}
                  disabled={isClosed}
                  style={{ width: '100%', fontSize: 'var(--fs-base)' }}
                />
              </div>
            )}

            {step.type === 'time_field' && (
              <div>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>
                  {step.label}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input-dark"
                    placeholder={step.field_label || 'HHmm'}
                    value={resp?.value || ''}
                    onChange={e => handleFieldChange(step.id, e.target.value)}
                    disabled={isClosed}
                    style={{ width: 110, fontSize: 'var(--fs-base)', textAlign: 'center' }}
                  />
                  {!isClosed && (
                    <button
                      onClick={() => handleFieldChange(step.id, zuluNow())}
                      style={{
                        background: 'color-mix(in srgb, var(--color-cyan) 10%, transparent)',
                        border: '1px solid var(--color-cyan)',
                        borderRadius: 'var(--radius-sm)', padding: '5px 12px', color: 'var(--color-cyan)',
                        fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >Now (Z)</button>
                  )}
                </div>
              </div>
            )}

            {step.type === 'conditional' && (
              <div style={{
                fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-warning)',
                fontStyle: 'italic',
              }}>{step.label}</div>
            )}

            {step.type === 'text' && (
              <div style={{
                fontSize: 'var(--fs-md)', color: 'var(--color-text-2)',
                padding: '6px 10px', background: 'var(--color-bg-inset)',
                borderLeft: '3px solid var(--color-cyan)', borderRadius: 4,
              }}>{step.label}</div>
            )}

            {step.type === 'textarea' && (
              <div style={{
                fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', whiteSpace: 'pre-wrap',
                padding: '10px 12px', background: 'var(--color-bg-inset)',
                borderLeft: '3px solid var(--color-cyan)', borderRadius: 4,
                lineHeight: 1.5,
              }}>{step.label}</div>
            )}
          </div>

          {status === 'completed' && resp?.completed_at && (
            <span style={{
              fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)',
              whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 4,
            }}>{new Date(resp.completed_at).toISOString().slice(11, 16)}Z</span>
          )}
        </div>

        {step.sub_steps?.map(sub => renderStep(sub, depth + 1))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 14, gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: 'var(--color-cyan)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0, marginBottom: 8,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <ArrowLeft size={14} />
            Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <QrcBadge number={execution.qrc_number} size="lg" />
            <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {execution.title}
            </span>
          </div>
          <div style={{
            fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 6,
            display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
          }}>
            <Clock size={11} />
            Opened {new Date(execution.opened_at).toISOString().slice(11, 16)}Z
            {execution.open_initials && ` by ${execution.open_initials}`}
            {execution.closed_at && ` · Closed ${new Date(execution.closed_at).toISOString().slice(11, 16)}Z`}
            {execution.close_initials && ` by ${execution.close_initials}`}
          </div>
        </div>
        <StatusPill kind={isClosed ? 'closed' : 'open'}>{isClosed ? 'Closed' : 'Open'}</StatusPill>
      </div>

      {/* Warning note — banner-tier */}
      {template?.notes && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 14,
          background: 'color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-surface))',
          borderLeft: '4px solid var(--color-danger)',
          border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <AlertOctagon size={18} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-danger)',
          }}>{template.notes}</div>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
            Progress: {completedSteps.length}/{denominator} steps
            {naSteps.length > 0 && ` (${naSteps.length} N/A)`}
          </span>
          <span style={{
            fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {Math.round(progress)}%
            {progress === 100 && <CheckCircle2 size={12} color="var(--color-success)" />}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: progress === 100 ? 'var(--color-success)' : 'var(--color-cyan)',
            borderRadius: 2, transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* References */}
      {template?.references && (
        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', marginBottom: 14 }}>
          Ref: {template.references}
        </div>
      )}

      {/* SCN Form */}
      {template?.has_scn_form && template.scn_fields && (
        <div style={{
          padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 16,
          background: 'var(--color-bg-surface)',
          border: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
          borderLeft: '3px solid var(--color-cyan)',
        }}>
          <div style={{
            fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-cyan)',
            marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Secondary Crash Net (SCN) Form
          </div>
          {((template.scn_fields as { fields?: { key: string; label: string; type: string }[] }).fields || []).map(
            (field) => (
              <div key={field.key} style={{ marginBottom: 10 }}>
                <label style={{
                  fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-2)',
                  display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="input-dark"
                    value={(scnData[field.key] as string) || ''}
                    onChange={e => handleScnField(field.key, e.target.value)}
                    disabled={isClosed}
                    rows={2}
                    style={{ width: '100%', fontSize: 'var(--fs-base)', resize: 'vertical' }}
                  />
                ) : (
                  <input
                    className="input-dark"
                    value={(scnData[field.key] as string) || ''}
                    onChange={e => handleScnField(field.key, e.target.value)}
                    disabled={isClosed}
                    style={{ width: '100%', fontSize: 'var(--fs-base)' }}
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

      {/* Annual Review */}
      {template && (
        <div style={{
          padding: 14, borderRadius: 'var(--radius-md)', marginBottom: 16,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderLeft: '3px solid var(--color-cyan)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
          }}>
            <div style={{
              fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Calendar size={12} />
              Annual Review
            </div>
            {template.last_reviewed_at ? (
              isReviewOverdue(template.last_reviewed_at)
                ? <StatusPill kind="overdue">Overdue</StatusPill>
                : <StatusPill kind="current">Current</StatusPill>
            ) : (
              <StatusPill kind="overdue">Never reviewed</StatusPill>
            )}
          </div>
          {template.last_reviewed_at && (
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 6 }}>
              Last reviewed: {formatReviewDate(template.last_reviewed_at)}
              {reviewerName && ` by ${reviewerName}`}
            </div>
          )}
          {template.review_notes && !showReview && (
            <div style={{
              fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
              fontStyle: 'italic', marginBottom: 6,
            }}>{template.review_notes}</div>
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
                    flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)', border: 'none',
                    background: 'var(--color-cyan)', color: '#fff', fontWeight: 700,
                    fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{reviewing ? 'Saving...' : 'Confirm Review'}</button>
                <button
                  onClick={() => setShowReview(false)}
                  style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
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
                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-cyan)',
                background: 'color-mix(in srgb, var(--color-cyan) 8%, transparent)',
                color: 'var(--color-cyan)', fontWeight: 700, fontSize: 'var(--fs-sm)',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <CheckCircle2 size={14} />
              Mark as Reviewed
            </button>
          )}
        </div>
      )}

      {/* Close / Reopen */}
      {!isClosed ? (
        showCloseConfirm ? (
          <div style={{
            padding: 16, borderRadius: 'var(--radius-md)',
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
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--color-success)', color: '#fff', fontWeight: 700,
                  fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{closing ? 'Closing...' : 'Confirm Close'}</button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                style={{
                  padding: '10px 16px', borderRadius: 'var(--radius-md)',
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
                flex: 1, padding: '12px 0', borderRadius: 'var(--radius-md)', border: 'none',
                background: 'var(--color-success)', color: '#fff', fontWeight: 700,
                fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <CheckCircle2 size={16} />
              Close QRC
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
                background: 'color-mix(in srgb, var(--color-danger) 6%, transparent)',
                color: 'var(--color-danger)', fontWeight: 700, fontSize: 'var(--fs-base)',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <X size={16} />
              Cancel QRC
            </button>
          </div>
        )
      ) : (
        <button
          onClick={handleReopen}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-mid)', background: 'transparent',
            color: 'var(--color-text-2)', fontWeight: 700, fontSize: 'var(--fs-base)',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <RotateCcw size={14} />
          Reopen QRC
        </button>
      )}

      {/* Export actions */}
      {isClosed && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleExportPdf}
            disabled={generatingPdf}
            style={{
              flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-purple) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-purple) 25%, transparent)',
              color: 'var(--color-purple)', fontSize: 'var(--fs-md)', fontWeight: 700,
              fontFamily: 'inherit', cursor: generatingPdf ? 'default' : 'pointer',
              opacity: generatingPdf ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <FileDown size={16} />
            {generatingPdf ? 'Generating...' : 'Export PDF'}
          </button>
          <button
            onClick={handleEmailPdf}
            disabled={generatingPdf}
            style={{
              padding: '12px 16px', borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-purple) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-purple) 25%, transparent)',
              color: 'var(--color-purple)', fontSize: 'var(--fs-md)', fontWeight: 700,
              fontFamily: 'inherit', cursor: generatingPdf ? 'default' : 'pointer',
              opacity: generatingPdf ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            title="Email PDF"
          >
            <Mail size={16} />
          </button>
        </div>
      )}

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}
