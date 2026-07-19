'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, ClipboardCheck, Plus, Upload, ExternalLink,
  FileSignature, CheckCircle2, AlertTriangle, Pencil, Trash2,
  ChevronDown, ChevronRight, ArrowUpRight,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchActiveWhmp,
  fetchWhmpHistory,
  createWhmp,
  supersedeWhmp,
  updateWhmpFindings,
  recordWhmpAnnualReview,
  uploadWhmpDocument,
  nextWhmpReviewDue,
  buildSmsHazardPromoteUrl,
  WHMP_HAZARD_LEVEL_LABELS,
  WHMP_HAZARD_LEVEL_COLORS,
  WHMP_FINDING_CATEGORY_LABELS,
  type WildlifeHazardAssessment,
  type WhmpHazardousSpecies,
  type WhmpHazardLevel,
  type WhmpFinding,
  type WhmpFindingCategory,
  type CreateWhmpInput,
} from '@/lib/supabase/whmp'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'

/**
 * /wildlife/whmp — Annual Wildlife Hazard Management Plan per 14 CFR §139.337.
 *
 * Three regions:
 *   1. Header with "+ New Year"
 *   2. Active assessment card (or empty state)
 *   3. Prior years collapsible list
 *
 * "New Year" modal is a single-screen form with repeatable hazardous-
 * species rows and repeatable findings rows. Each finding has a
 * "Promote to SMS Hazard" deep-link that opens /sms/hazards/new with
 * prefill query params.
 */
export default function WhmpPage() {
  const { installationId, currentInstallation } = useInstallation()
  const installationName = (currentInstallation as { name?: string | null } | null)?.name ?? null
  const installationIcao = (currentInstallation as { icao?: string | null } | null)?.icao ?? null
  void installationName; void installationIcao
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [active, setActive] = useState<WildlifeHazardAssessment | null>(null)
  const [history, setHistory] = useState<WildlifeHazardAssessment[]>([])
  const [modal, setModal] = useState<ModalState | null>(null)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [linkingFinding, setLinkingFinding] = useState<{ findingId: string; assessmentId: string } | null>(null)
  const [linkInput, setLinkInput] = useState('')

  const canWrite = has(PERM.WILDLIFE_WRITE)

  const reload = useCallback(async () => {
    if (!installationId) return
    const [a, h] = await Promise.all([
      fetchActiveWhmp(installationId),
      fetchWhmpHistory(installationId),
    ])
    setActive(a)
    setHistory(h.filter(r => r.id !== a?.id))
    setLoaded(true)
  }, [installationId])

  useEffect(() => { reload() }, [reload])

  function openNewYear(prefillFrom?: WildlifeHazardAssessment | null) {
    const currentYear = new Date().getUTCFullYear()
    const today = new Date().toISOString().slice(0, 10)
    setModal({
      assessment_year: prefillFrom?.assessment_year ?? currentYear,
      performed_at: prefillFrom?.performed_at ?? today,
      performed_by_external: prefillFrom?.performed_by_external ?? '',
      faa_accepted_at: prefillFrom?.faa_accepted_at ?? '',
      faa_acceptance_ref: prefillFrom?.faa_acceptance_ref ?? '',
      hazardous_species: prefillFrom?.hazardous_species ?? [],
      mitigation_summary: prefillFrom?.mitigation_summary ?? '',
      findings: prefillFrom?.findings ?? [],
      notes: prefillFrom?.notes ?? '',
      file: null,
      supersedeId: prefillFrom?.id ?? null,
    })
  }

  async function handleSave() {
    if (!modal || !installationId) return
    if (!modal.performed_at) {
      toast.error('Performed date is required')
      return
    }
    if (!modal.assessment_year) {
      toast.error('Assessment year is required')
      return
    }

    setSaving(true)
    try {
      const id = crypto.randomUUID()
      let uploadedUrl: string | null = null
      let uploadedPath: string | null = null

      if (modal.file) {
        const up = await uploadWhmpDocument({
          file: modal.file,
          base_id: installationId,
          assessment_id: id,
        })
        if (!up.ok) {
          toast.error(up.error || 'Upload failed')
          setSaving(false)
          return
        }
        uploadedUrl = up.url ?? null
        uploadedPath = up.storage_path ?? null
      }

      const payload: CreateWhmpInput = {
        id,
        base_id: installationId,
        assessment_year: modal.assessment_year,
        performed_at: modal.performed_at,
        performed_by_external: modal.performed_by_external.trim() || null,
        report_url: uploadedUrl,
        storage_path: uploadedPath,
        faa_accepted_at: modal.faa_accepted_at || null,
        faa_acceptance_ref: modal.faa_acceptance_ref.trim() || null,
        hazardous_species: modal.hazardous_species,
        mitigation_summary: modal.mitigation_summary.trim() || null,
        findings: modal.findings,
        notes: modal.notes.trim() || null,
      }

      const res = modal.supersedeId
        ? await supersedeWhmp(modal.supersedeId, payload)
        : await createWhmp(payload)

      if (!res.ok || !res.whmp) {
        toast.error(res.error || 'Save failed')
        return
      }

      toast.success(
        modal.supersedeId
          ? `WHMP ${res.whmp.assessment_year} amended · ${res.whmp.hazardous_species.length} species · ${res.whmp.findings.length} findings`
          : `WHMP ${res.whmp.assessment_year} filed · ${res.whmp.hazardous_species.length} species · ${res.whmp.findings.length} findings`,
      )
      setModal(null)
      reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleSignReview() {
    if (!active || !installationId) return
    if (!canWrite) {
      toast.error('Annual review requires wildlife write permission')
      return
    }
    const notes = window.prompt('Optional review notes:') ?? null
    const res = await recordWhmpAnnualReview({
      whmpId: active.id,
      baseId: installationId,
      notes: notes?.trim() || null,
    })
    if (!res.ok) { toast.error(res.error || 'Sign failed'); return }
    toast.success(active.ae_signed_at ? 'Annual review recorded' : 'WHMP signed + reviewed')
    reload()
  }

  async function handleMarkLinked() {
    if (!linkingFinding || !installationId) return
    const assessment = (active?.id === linkingFinding.assessmentId ? active : history.find(h => h.id === linkingFinding.assessmentId))
    if (!assessment) {
      toast.error('Assessment not found')
      return
    }
    const trimmed = linkInput.trim()
    if (!trimmed) {
      toast.error('Hazard ID or code required')
      return
    }
    const nextFindings = assessment.findings.map(f =>
      f.id === linkingFinding.findingId ? { ...f, sms_hazard_id: trimmed } : f,
    )
    const res = await updateWhmpFindings(assessment.id, installationId, nextFindings)
    if (!res.ok) {
      toast.error(res.error || 'Link failed')
      return
    }
    toast.success('Finding linked to SMS hazard')
    setLinkingFinding(null)
    setLinkInput('')
    reload()
  }

  if (!loaded) return <LoadingState />

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <Link href="/wildlife" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--color-text-3)', textDecoration: 'none',
        fontSize: 'var(--fs-sm)', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Wildlife / BASH
      </Link>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, paddingBottom: 12, marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardCheck size={22} color="var(--color-success)" />
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              Wildlife Hazard Management Plan
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              14 CFR §139.337 · AC 150/5200-33C · AC 150/5200-32B
            </div>
          </div>
        </div>
        {canWrite && (
          <button onClick={() => openNewYear()} style={primaryBtnStyle}>
            <Plus size={14} style={{ marginRight: 4 }} /> New Year
          </button>
        )}
      </div>

      {/* Active card */}
      {active ? (
        <ActiveAssessmentCard
          whmp={active}
          canWrite={canWrite}
          onSign={handleSignReview}
          onAmend={() => openNewYear(active)}
          onPromoteFinding={(finding) => {
            const url = buildSmsHazardPromoteUrl({ finding, assessmentId: active.id })
            window.open(url, '_blank')
          }}
          onLinkFinding={(finding) => {
            setLinkingFinding({ findingId: finding.id, assessmentId: active.id })
            setLinkInput(finding.sms_hazard_id ?? '')
          }}
        />
      ) : (
        <EmptyAssessmentCard canWrite={canWrite} onCreate={() => openNewYear()} />
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowHistory(s => !s)}
            style={{
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)',
              marginBottom: 8,
            }}
          >
            {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Prior Years ({history.length})
          </button>
          {showHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map(w => (
                <div key={w.id} style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 10, alignItems: 'baseline',
                  fontSize: 'var(--fs-sm)',
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{w.assessment_year}</div>
                  <div style={{ color: 'var(--color-text-2)' }}>
                    {w.performed_by_external || 'Internal'} · {formatZuluDate(w.performed_at)}
                    {' · '}
                    <span style={{ color: 'var(--color-text-3)' }}>
                      {w.hazardous_species.length} species · {w.findings.length} findings
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
                    {w.replaced_by_id ? 'Superseded' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New / Amend modal */}
      {modal && (
        <NewYearModal
          state={modal}
          onChange={setModal}
          onCancel={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {/* Mark-linked dialog */}
      {linkingFinding && (
        <div
          onClick={() => setLinkingFinding(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '15vh 10px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 480, width: '100%',
              padding: 18, borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-surface-solid)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
              Link SMS Hazard
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10 }}>
              Paste the SMS hazard code (e.g. <code>HZ-2026-014</code>) that this finding was promoted to. Find it on the SMS hazard detail page.
            </div>
            <input
              type="text"
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              placeholder="HZ-2026-014"
              autoFocus
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setLinkingFinding(null)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleMarkLinked} style={primaryBtnStyle}>
                <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Save Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Active assessment card
// ────────────────────────────────────────────────────────────────

function ActiveAssessmentCard({ whmp, canWrite, onSign, onAmend, onPromoteFinding, onLinkFinding }: {
  whmp: WildlifeHazardAssessment
  canWrite: boolean
  onSign: () => void
  onAmend: () => void
  onPromoteFinding: (f: WhmpFinding) => void
  onLinkFinding: (f: WhmpFinding) => void
}) {
  const review = nextWhmpReviewDue(whmp)
  const reviewColor =
    review.status === 'overdue' ? 'var(--color-danger)' :
    review.status === 'due_soon' ? 'var(--color-warning)' :
    'var(--color-success)'

  return (
    <div style={{
      padding: 18,
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success)' }}>
          <CheckCircle2 size={20} />
          <span style={{ fontWeight: 700 }}>{whmp.assessment_year} Assessment</span>
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          Performed {formatZuluDate(whmp.performed_at)}
          {whmp.performed_by_external ? ` by ${whmp.performed_by_external}` : ''}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Field label="FAA Acceptance">
          {whmp.faa_accepted_at
            ? `${formatZuluDate(whmp.faa_accepted_at)}${whmp.faa_acceptance_ref ? ` · ${whmp.faa_acceptance_ref}` : ''}`
            : <span style={{ color: 'var(--color-text-4)' }}>Not recorded</span>}
        </Field>
        <Field label="AE Sign-off">
          {whmp.ae_signed_at
            ? `Signed ${formatZuluDate(whmp.ae_signed_at.slice(0, 10))}`
            : <span style={{ color: 'var(--color-warning)' }}>Awaiting AE signature</span>}
        </Field>
        <Field label="Annual Review">
          {review.date && review.daysOut !== null ? (
            <span style={{ color: reviewColor }}>
              {review.status === 'overdue'
                ? `Overdue by ${Math.abs(review.daysOut)} days`
                : `Due ${formatZuluDate(review.date.toISOString().slice(0, 10))} (${review.daysOut}d)`}
            </span>
          ) : <span style={{ color: 'var(--color-text-4)' }}>—</span>}
        </Field>
      </div>

      {whmp.report_url && (
        <a href={whmp.report_url} target="_blank" rel="noreferrer"
           style={{
             display: 'inline-flex', alignItems: 'center', gap: 6,
             fontSize: 'var(--fs-sm)', color: 'var(--color-accent)', textDecoration: 'none',
           }}>
          <ExternalLink size={14} /> View {whmp.assessment_year} WHMP document
        </a>
      )}

      {/* Hazardous species */}
      <div>
        <SectionHeader label="Hazardous Species" count={whmp.hazardous_species.length} />
        {whmp.hazardous_species.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>(No species recorded.)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {whmp.hazardous_species.map(s => (
              <div key={s.id} style={speciesRowStyle(s.hazard_level)}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{s.species}</span>
                  <span style={{
                    fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                    color: WHMP_HAZARD_LEVEL_COLORS[s.hazard_level],
                  }}>
                    {WHMP_HAZARD_LEVEL_LABELS[s.hazard_level]}
                  </span>
                </div>
                {s.attractants.length > 0 && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    <span style={{ color: 'var(--color-text-4)' }}>Attractants: </span>{s.attractants.join(', ')}
                  </div>
                )}
                {s.mitigations.length > 0 && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    <span style={{ color: 'var(--color-text-4)' }}>Mitigations: </span>{s.mitigations.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mitigation summary */}
      {whmp.mitigation_summary && (
        <div>
          <SectionHeader label="Mitigation Summary" />
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {whmp.mitigation_summary}
          </div>
        </div>
      )}

      {/* Findings */}
      <div>
        <SectionHeader label="Findings" count={whmp.findings.length} />
        {whmp.findings.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>(No findings recorded.)</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {whmp.findings.map((f, i) => (
              <div key={f.id} style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-inset)',
                border: '1px solid var(--color-border)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', fontFamily: 'monospace' }}>
                    #{i + 1}
                  </span>
                  <span style={{
                    padding: '1px 6px', borderRadius: 3,
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                    background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
                    color: 'var(--color-cyan)',
                  }}>
                    {WHMP_FINDING_CATEGORY_LABELS[f.category] ?? f.category}
                  </span>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>{f.finding}</span>
                </div>
                {f.recommended_action && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginLeft: 22 }}>
                    <span style={{ color: 'var(--color-text-4)' }}>Recommended: </span>{f.recommended_action}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 22, marginTop: 4 }}>
                  {f.sms_hazard_id ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 3,
                      background: 'color-mix(in srgb, var(--color-success) 14%, transparent)',
                      color: 'var(--color-success)',
                      fontSize: 'var(--fs-xs)', fontWeight: 600,
                    }}>
                      <CheckCircle2 size={10} /> Linked: {f.sms_hazard_id}
                    </span>
                  ) : (
                    <button onClick={() => onPromoteFinding(f)} style={linkBtnStyle}>
                      <ArrowUpRight size={11} style={{ marginRight: 3 }} /> Promote to SMS Hazard
                    </button>
                  )}
                  {canWrite && (
                    <button onClick={() => onLinkFinding(f)} style={linkBtnStyle}>
                      {f.sms_hazard_id ? 'Edit Link' : 'Mark Linked'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {whmp.review_notes && (
        <div>
          <SectionHeader label="Last Review Notes" />
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', whiteSpace: 'pre-wrap' }}>
            {whmp.review_notes}
          </div>
        </div>
      )}

      {canWrite && (
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button onClick={onSign} style={primaryBtnStyle}>
            <FileSignature size={12} style={{ marginRight: 4 }} />
            {whmp.ae_signed_at ? 'Record Annual Review' : 'Sign + Activate'}
          </button>
          <button onClick={onAmend} style={secondaryBtnStyle}>
            <Pencil size={12} style={{ marginRight: 4 }} /> Amend / Supersede
          </button>
        </div>
      )}

      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', paddingTop: 4 }}>
        IAW 14 CFR §139.337(c), an annual review recorded here satisfies the requirement to maintain the WHMP current.
      </div>
    </div>
  )
}

function EmptyAssessmentCard({ canWrite, onCreate }: { canWrite: boolean; onCreate: () => void }) {
  return (
    <div style={{
      padding: 18,
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--color-warning) 6%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
      color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5,
    }}>
      No WHMP on file. Upload your first annual assessment to satisfy <strong>14 CFR §139.337</strong>. The current year&apos;s assessment becomes the active record; subsequent years stack as history.
      {canWrite && (
        <div style={{ marginTop: 10 }}>
          <button onClick={onCreate} style={primaryBtnStyle}>
            <Plus size={12} style={{ marginRight: 4 }} /> File First Assessment
          </button>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// New Year / Amend modal
// ────────────────────────────────────────────────────────────────

type ModalState = {
  assessment_year: number
  performed_at: string
  performed_by_external: string
  faa_accepted_at: string
  faa_acceptance_ref: string
  hazardous_species: WhmpHazardousSpecies[]
  mitigation_summary: string
  findings: WhmpFinding[]
  notes: string
  file: File | null
  supersedeId: string | null
}

function NewYearModal({
  state, onChange, onCancel, onSave, saving,
}: {
  state: ModalState
  onChange: (s: ModalState) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  function addSpecies() {
    onChange({
      ...state,
      hazardous_species: [...state.hazardous_species, {
        id: crypto.randomUUID(),
        species: '',
        hazard_level: 'medium',
        attractants: [],
        mitigations: [],
      }],
    })
  }
  function updateSpecies(id: string, patch: Partial<WhmpHazardousSpecies>) {
    onChange({
      ...state,
      hazardous_species: state.hazardous_species.map(s => s.id === id ? { ...s, ...patch } : s),
    })
  }
  function removeSpecies(id: string) {
    onChange({ ...state, hazardous_species: state.hazardous_species.filter(s => s.id !== id) })
  }

  function addFinding() {
    onChange({
      ...state,
      findings: [...state.findings, {
        id: crypto.randomUUID(),
        finding: '',
        category: 'habitat',
        recommended_action: '',
        sms_hazard_id: null,
      }],
    })
  }
  function updateFinding(id: string, patch: Partial<WhmpFinding>) {
    onChange({
      ...state,
      findings: state.findings.map(f => f.id === id ? { ...f, ...patch } : f),
    })
  }
  function removeFinding(id: string) {
    onChange({ ...state, findings: state.findings.filter(f => f.id !== id) })
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '4vh 10px', overflow: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 800, width: '100%',
          padding: 18, borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
          {state.supersedeId ? `Amend ${state.assessment_year} WHMP Assessment` : 'New WHMP Assessment'}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 14 }}>
          14 CFR §139.337 — annual wildlife hazard assessment.
        </div>

        {/* Meta */}
        {/* auto-fit so the three fields stack on phones instead of crushing
            the third column (fixed '100px 1fr 1fr' bled off-screen). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
          <Field label="Year *">
            <input
              type="number"
              min={2000} max={2100}
              value={state.assessment_year}
              onChange={e => onChange({ ...state, assessment_year: parseInt(e.target.value) || new Date().getUTCFullYear() })}
              style={inputStyle}
            />
          </Field>
          <Field label="Performed Date *">
            <input
              type="date"
              value={state.performed_at}
              onChange={e => onChange({ ...state, performed_at: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Performed By (external)">
            <input
              type="text"
              value={state.performed_by_external}
              onChange={e => onChange({ ...state, performed_by_external: e.target.value })}
              placeholder="USDA Wildlife Services"
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 12 }}>
          <Field label="FAA Acceptance Date">
            <input
              type="date"
              value={state.faa_accepted_at}
              onChange={e => onChange({ ...state, faa_accepted_at: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="FAA Acceptance Reference">
            <input
              type="text"
              value={state.faa_acceptance_ref}
              onChange={e => onChange({ ...state, faa_acceptance_ref: e.target.value })}
              placeholder="ATL-WS-2026-04 / email reference"
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="WHMP Document (PDF)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={fileBtnStyle}>
              <Upload size={14} style={{ marginRight: 4 }} />
              {state.file ? state.file.name : 'Choose PDF…'}
              <input
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={e => onChange({ ...state, file: e.target.files?.[0] ?? null })}
              />
            </label>
            {state.file && (
              <button onClick={() => onChange({ ...state, file: null })}
                      style={{ ...cancelBtnStyle, padding: '4px 8px' }}>Clear</button>
            )}
          </div>
        </Field>

        {/* Hazardous species */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)' }}>
              Hazardous Species
            </div>
            <button onClick={addSpecies} style={smallBtnStyle}>
              <Plus size={11} style={{ marginRight: 3 }} /> Add Species
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.hazardous_species.length === 0 && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>(None yet.)</div>
            )}
            {state.hazardous_species.map(s => (
              <SpeciesEditor
                key={s.id}
                species={s}
                onChange={patch => updateSpecies(s.id, patch)}
                onRemove={() => removeSpecies(s.id)}
              />
            ))}
          </div>
        </div>

        {/* Mitigation summary */}
        <div style={{ marginTop: 14 }}>
          <Field label="Mitigation Summary">
            <textarea
              value={state.mitigation_summary}
              onChange={e => onChange({ ...state, mitigation_summary: e.target.value })}
              rows={3}
              placeholder="Overall mitigation approach: grass cutting cadence, dispersal program, habitat changes, etc."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        </div>

        {/* Findings */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)' }}>
              Findings
            </div>
            <button onClick={addFinding} style={smallBtnStyle}>
              <Plus size={11} style={{ marginRight: 3 }} /> Add Finding
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.findings.length === 0 && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>(None yet.)</div>
            )}
            {state.findings.map(f => (
              <FindingEditor
                key={f.id}
                finding={f}
                onChange={patch => updateFinding(f.id, patch)}
                onRemove={() => removeFinding(f.id)}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginTop: 14 }}>
          <Field label="Notes (optional)">
            <textarea
              value={state.notes}
              onChange={e => onChange({ ...state, notes: e.target.value })}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={saving ? disabledBtnStyle : primaryBtnStyle}>
            {saving ? 'Saving…' : state.supersedeId ? 'Save Amendment' : 'File Assessment'}
          </button>
        </div>

        {state.supersedeId && (
          <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
            Saving supersedes the prior {state.assessment_year} assessment. History keeps both rows.
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Species + finding inline editors
// ────────────────────────────────────────────────────────────────

function SpeciesEditor({ species, onChange, onRemove }: {
  species: WhmpHazardousSpecies
  onChange: (patch: Partial<WhmpHazardousSpecies>) => void
  onRemove: () => void
}) {
  return (
    <div style={{
      padding: 10, borderRadius: 'var(--radius-sm)',
      background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 8, marginBottom: 6 }}>
        <input
          type="text"
          value={species.species}
          onChange={e => onChange({ species: e.target.value })}
          placeholder="Canada Goose"
          style={inputStyle}
        />
        <select
          value={species.hazard_level}
          onChange={e => onChange({ hazard_level: e.target.value as WhmpHazardLevel })}
          style={inputStyle}
        >
          {(Object.keys(WHMP_HAZARD_LEVEL_LABELS) as WhmpHazardLevel[]).map(l => (
            <option key={l} value={l}>{WHMP_HAZARD_LEVEL_LABELS[l]}</option>
          ))}
        </select>
        <button onClick={onRemove} style={{ ...smallBtnStyle, color: 'var(--color-danger)' }} aria-label="Remove species">
          <Trash2 size={11} />
        </button>
      </div>
      <input
        type="text"
        value={species.attractants.join(', ')}
        onChange={e => onChange({ attractants: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        placeholder="Attractants (comma-separated): standing water near RWY 13, tall grass east apron"
        style={{ ...inputStyle, marginBottom: 6 }}
      />
      <input
        type="text"
        value={species.mitigations.join(', ')}
        onChange={e => onChange({ mitigations: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        placeholder="Mitigations (comma-separated): weekly mowing, pyrotechnic dispersal"
        style={inputStyle}
      />
    </div>
  )
}

function FindingEditor({ finding, onChange, onRemove }: {
  finding: WhmpFinding
  onChange: (patch: Partial<WhmpFinding>) => void
  onRemove: () => void
}) {
  return (
    <div style={{
      padding: 10, borderRadius: 'var(--radius-sm)',
      background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 8, marginBottom: 6 }}>
        <input
          type="text"
          value={finding.finding}
          onChange={e => onChange({ finding: e.target.value })}
          placeholder="Finding narrative — e.g. Grass height exceeded 8 inches in May survey"
          style={inputStyle}
        />
        <select
          value={finding.category}
          onChange={e => onChange({ category: e.target.value as WhmpFindingCategory })}
          style={inputStyle}
        >
          {(Object.keys(WHMP_FINDING_CATEGORY_LABELS) as WhmpFindingCategory[]).map(c => (
            <option key={c} value={c}>{WHMP_FINDING_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <button onClick={onRemove} style={{ ...smallBtnStyle, color: 'var(--color-danger)' }} aria-label="Remove finding">
          <Trash2 size={11} />
        </button>
      </div>
      <input
        type="text"
        value={finding.recommended_action}
        onChange={e => onChange({ recommended_action: e.target.value })}
        placeholder="Recommended action (optional)"
        style={inputStyle}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // minWidth 0: as a grid/flex item this wrapper must be allowed to shrink
    // below its input's intrinsic width, or the input bleeds off the card.
    <div style={{ minWidth: 0 }}>
      <label style={{
        display: 'block', fontSize: 'var(--fs-xs)',
        textTransform: 'uppercase', letterSpacing: 0.5,
        color: 'var(--color-text-3)', marginBottom: 4,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{
      fontSize: 'var(--fs-xs)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      color: 'var(--color-text-3)', marginBottom: 6,
    }}>
      {label}{count !== undefined ? ` · ${count}` : ''}
    </div>
  )
}

function speciesRowStyle(level: WhmpHazardLevel): React.CSSProperties {
  return {
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-bg-inset)',
    border: '1px solid var(--color-border)',
    borderLeft: `3px solid ${WHMP_HAZARD_LEVEL_COLORS[level]}`,
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-1)',
  fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid color-mix(in srgb, var(--color-success) 50%, transparent)',
  background: 'color-mix(in srgb, var(--color-success) 16%, transparent)',
  color: 'var(--color-success)',
  fontSize: 'var(--fs-sm)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-3)',
  fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
}

const disabledBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle, opacity: 0.5, cursor: 'not-allowed',
}

const fileBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px dashed var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center',
}

const linkBtnStyle: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 'var(--radius-sm)',
  border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
  background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
  color: 'var(--color-accent)',
  fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center',
}
