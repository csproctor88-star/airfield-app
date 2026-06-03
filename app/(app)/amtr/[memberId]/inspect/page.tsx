'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchAmtrMember, fetchAmtrByBase, fetchAmtrByMember, fetchAmtrRoleAssignments, uploadAmtrFile, fetchAmtrTranscribedRowIds,
  type AmtrMember, type AmtrRole,
} from '@/lib/supabase/amtr'
import {
  fetchAmtrInspectionsByMember, saveAmtrInspectionDraft, completeAmtrInspection, reopenAmtrInspection,
  type InspectionItemResponse,
} from '@/lib/supabase/amtr-inspections'
import { runInspectionScan, highestSkillLevel } from '@/lib/amtr/inspection-engine'
import { DEFAULT_INSPECTION_CHECKLIST } from '@/lib/amtr/inspection-checklist'
import { generateAmtrInspectionPdf } from '@/lib/amtr-inspection-pdf'
import type { AmtrInspection } from '@/lib/supabase/amtr-inspections'
import { Btn } from '@/components/amtr/ui'
import { AMTR_BAR_HEIGHT } from '@/components/amtr/module-bar'
import { JqsTab } from '@/components/amtr/jqs-tab'
import { Form623aTab } from '@/components/amtr/form623a-tab'
import { Form797Tab } from '@/components/amtr/form797-tab'
import { Form1098Tab } from '@/components/amtr/form1098-tab'
import { Form803Tab } from '@/components/amtr/form803-tab'
import { MilestonesTab } from '@/components/amtr/milestones-tab'
import { FormalTab } from '@/components/amtr/formal-tab'
import { RatTab } from '@/components/amtr/rat-tab'
import { QualificationsTab } from '@/components/amtr/qualifications-tab'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'
import { ArrowLeft, ClipboardCheck, ChevronDown, ChevronRight, Minus } from 'lucide-react'

type Row = Record<string, unknown>
type ChecklistRow = { kind: 'section' | 'item'; item_number: string; label: string; auto_key: string | null }

const RECORD_TABS: [string, string][] = [
  ['jqs', 'JQS-CFETP'], ['623a', 'DAF 623A'], ['797', 'DAF 797'], ['803', 'DAF 803'],
  ['1098', 'DAF 1098'], ['milestones', 'Milestones'], ['formal', 'Formal'], ['rat', 'RAT'],
  ['qual', 'Qualifications'],
]
// Which record tab each checklist section maps to (for the "view in record" jump).
const SECTION_TAB: Record<string, string> = {
  '2': 'jqs', '3': 'formal', '4': '623a', '5': '797', '6': '1098', '7': '803', '8': 'milestones', '9': 'jqs', '10': 'rat',
}

const noop = () => {}
const noopAsync = async () => {}

export default function AmtrInspectPage() {
  const params = useParams<{ memberId: string }>()
  const memberId = params.memberId
  const router = useRouter()
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has(PERM.AMTR_WRITE)
  const canExport = has(PERM.AMTR_EXPORT)
  const canManage = has(PERM.AMTR_MANAGE)
  const [myRoles, setMyRoles] = useState<AmtrRole[]>([])

  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<AmtrMember | null>(null)
  const [checklist, setChecklist] = useState<ChecklistRow[]>([])
  const [items, setItems] = useState<InspectionItemResponse[]>([])
  const [notes, setNotes] = useState('')
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | 'completed'>('draft')
  const [recordTab, setRecordTab] = useState('jqs')
  const [checklistOpen, setChecklistOpen] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [commentOpen, setCommentOpen] = useState<Set<string>>(new Set())
  const [data, setData] = useState<Record<string, Row[]>>({})
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myName, setMyName] = useState<string>('')

  const load = useCallback(async () => {
    if (!memberId || !installationId) return
    setLoading(true)
    const supabase = createClient()
    let uid: string | null = null
    if (supabase) { try { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id ?? null } catch { /* */ } }
    setMyUserId(uid)

    const [m, roles, jqsCat, jqsProg, r1098Cat, r1098Prog, ratCat, ratProg, e623a, items797, items803, mileCat, mileProg, formalCat, formalProg, qualCat, qualProg, transcribedRowIds, checklistRows, inspections] = await Promise.all([
      fetchAmtrMember(memberId),
      fetchAmtrRoleAssignments(installationId),
      fetchAmtrByBase<Row>('amtr_jqs_catalog', installationId),
      fetchAmtrByMember<Row>('amtr_jqs_progress', memberId),
      fetchAmtrByBase<Row>('amtr_1098_catalog', installationId),
      fetchAmtrByMember<Row>('amtr_1098_progress', memberId),
      fetchAmtrByBase<Row>('amtr_rat_catalog', installationId),
      fetchAmtrByMember<Row>('amtr_rat_progress', memberId),
      fetchAmtrByMember<Row>('amtr_623a', memberId, 'form_date'),
      fetchAmtrByMember<Row>('amtr_797', memberId, 'sort_order'),
      fetchAmtrByMember<Row>('amtr_803', memberId, 'sort_order'),
      fetchAmtrByBase<Row>('amtr_milestone_catalog', installationId),
      fetchAmtrByMember<Row>('amtr_milestone_progress', memberId),
      fetchAmtrByBase<Row>('amtr_formal_catalog', installationId),
      fetchAmtrByMember<Row>('amtr_formal_progress', memberId),
      fetchAmtrByBase<Row>('amtr_qual_catalog', installationId),
      fetchAmtrByMember<Row>('amtr_qual_progress', memberId),
      fetchAmtrTranscribedRowIds(memberId),
      fetchAmtrByBase<ChecklistRow>('amtr_inspection_checklist', installationId),
      fetchAmtrInspectionsByMember(memberId),
    ])
    setMember(m)
    setMyRoles(roles.filter((r) => r.user_id === uid).map((r) => r.role))
    setData({ jqsCat, jqsProg, r1098Cat, r1098Prog, ratCat, ratProg, e623a, items797, items803, mileCat, mileProg, formalCat, formalProg, qualCat, qualProg })

    // display name for the completed-by stamp
    if (supabase && uid) {
      try {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).single()
        const p = prof as { rank?: string; first_name?: string; last_name?: string; name?: string } | null
        if (p) setMyName(`${p.rank ? p.rank + ' ' : ''}${p.last_name ?? ''}${p.last_name && p.first_name ? ', ' : ''}${p.first_name ?? ''}`.trim() || p.name || '')
      } catch { /* RLS */ }
    }

    // Checklist source: configured rows, else the bundled standard checklist.
    const liveRows = checklistRows.filter((r) => !(r as { retired?: boolean }).retired)
    const cl: ChecklistRow[] = liveRows.length
      ? liveRows.map((r) => ({ kind: r.kind, item_number: r.item_number, label: r.label, auto_key: r.auto_key }))
      : DEFAULT_INSPECTION_CHECKLIST.map((r) => ({ kind: r.kind, item_number: r.item_number, label: r.label, auto_key: r.auto_key ?? null }))
    setChecklist(cl)

    // Gap scan.
    const scan = m ? runInspectionScan({
      member: m as unknown as Row,
      roleAssignments: roles.map((r) => ({ user_id: r.user_id, role: r.role })),
      jqsCatalog: jqsCat, jqsProgress: jqsProg,
      r1098Catalog: r1098Cat, r1098Progress: r1098Prog,
      ratCatalog: ratCat, ratProgress: ratProg,
      e623a, items797, items803,
      milestoneCatalog: mileCat,
      formalCatalog: formalCat, formalProgress: formalProg,
      qualCatalog: qualCat, qualProgress: qualProg,
      transcribedRowIds,
      today: new Date().toISOString().slice(0, 10),
    }) : ({} as Record<string, { auto: 'yes' | 'no' | 'na' | null; findings: string[] }>)

    // Existing draft (most recent), else seed a fresh response set.
    const draft = inspections.find((i) => i.status === 'draft') ?? null
    const prior = new Map((draft?.items ?? []).map((it) => [it.item_number, it]))
    const built: InspectionItemResponse[] = cl.filter((r) => r.kind === 'item').map((r) => {
      const s = r.auto_key ? scan[r.auto_key as keyof typeof scan] : undefined
      const ex = prior.get(r.item_number)
      return {
        item_number: r.item_number,
        status: ex ? ex.status : (s?.auto ?? null),
        auto: s?.auto ?? null,
        findings: s?.findings ?? [],
        note: ex?.note ?? '',
      }
    })
    setItems(built)
    setNotes(draft?.notes ?? '')
    setInspectionId(draft?.id ?? null)
    setStatus(draft?.status ?? 'draft')
    setLoading(false)
  }, [memberId, installationId])

  useEffect(() => { load() }, [load])

  // ── debounced autosave ──
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueSave = useCallback((nextItems: InspectionItemResponse[], nextNotes: string) => {
    if (!installationId || !member || status === 'completed' || !canWrite) return
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      const { data: saved } = await saveAmtrInspectionDraft({
        id: inspectionId ?? undefined, base_id: installationId, member_id: memberId,
        inspection_date: new Date().toISOString().slice(0, 10), items: nextItems, notes: nextNotes, created_by: myUserId,
      })
      if (saved?.id && !inspectionId) setInspectionId(saved.id)
    }, 1000)
  }, [installationId, member, status, canWrite, inspectionId, memberId, myUserId])

  const setItemStatus = (item_number: string, value: 'yes' | 'no' | 'na') => {
    setItems((prev) => {
      const next = prev.map((it) => it.item_number === item_number ? { ...it, status: it.status === value ? null : value } : it)
      queueSave(next, notes); return next
    })
  }
  const setItemNote = (item_number: string, note: string) => {
    setItems((prev) => { const next = prev.map((it) => it.item_number === item_number ? { ...it, note } : it); queueSave(next, notes); return next })
  }

  const itemByNum = useMemo(() => new Map(items.map((it) => [it.item_number, it])), [items])
  // Highest skill level attained (Qualifications tab). JQS core tasks that only
  // become required above this level are not expected of the member.
  const skillLevel = useMemo(() => highestSkillLevel(data.qualCat ?? [], data.qualProg ?? []), [data])

  const complete = async () => {
    if (!installationId || !inspectionId) {
      // ensure a draft exists first
      const { data: saved } = await saveAmtrInspectionDraft({ base_id: installationId!, member_id: memberId, inspection_date: new Date().toISOString().slice(0, 10), items, notes, created_by: myUserId })
      if (!saved?.id) { toast.error('Could not save inspection'); return }
      setInspectionId(saved.id)
      await finalize(saved.id)
      return
    }
    await finalize(inspectionId)
  }
  const finalize = async (id: string) => {
    const dateStr = new Date().toISOString().slice(0, 10)
    const { error } = await completeAmtrInspection({
      id, base_id: installationId!, member_id: memberId, inspection_date: dateStr,
      items, notes, completed_by: myUserId, completed_by_name: myName,
    })
    if (error) { toast.error(error); return }
    setStatus('completed')

    // Archive a point-in-time PDF of the completed inspection to the member's
    // Files tab so it can be reviewed later. Best-effort — a failed upload must
    // not undo the completion the user just made.
    try {
      const { doc, filename } = buildInspectionPdf('completed')
      const blob = doc.output('blob')
      const file = new File([blob], filename, { type: 'application/pdf' })
      const no = items.filter((it) => it.status === 'no').length
      const title = `Records Inspection — ${dateStr}${no ? ` (${no} gap${no === 1 ? '' : 's'})` : ''}`
      const { error: upErr } = await uploadAmtrFile(installationId!, memberId, file, { documentTitle: title, documentDate: dateStr })
      toast.success(upErr
        ? 'Inspection completed — 623A entry added (couldn’t archive PDF to Files)'
        : 'Inspection completed — 623A entry added and PDF saved to Files')
    } catch {
      toast.success('Inspection completed — 623A entry added to the record')
    }
  }
  const reopen = async () => {
    if (!inspectionId) return
    const { error } = await reopenAmtrInspection(inspectionId)
    if (error) { toast.error(error); return }
    setStatus('draft'); toast.success('Inspection reopened')
  }

  // Build the inspection record + its PDF (shared by Export and the
  // save-to-Files archive on completion).
  const buildInsp = (forStatus: 'draft' | 'completed'): AmtrInspection => {
    const no = items.filter((it) => it.status === 'no').length
    return {
      id: inspectionId ?? '', base_id: installationId ?? '', member_id: memberId,
      inspection_date: new Date().toISOString().slice(0, 10), status: forStatus, items, notes,
      yes_count: items.filter((it) => it.status === 'yes').length,
      no_count: no, na_count: items.filter((it) => it.status === 'na').length, gap_count: no,
      completed_at: forStatus === 'completed' ? new Date().toISOString() : null,
      completed_by: myUserId, completed_by_name: myName, created_623a_id: null,
      created_by: myUserId, created_at: '', updated_at: '',
    }
  }
  const buildInspectionPdf = (forStatus: 'draft' | 'completed') => {
    const ci = currentInstallation as { name?: string; icao?: string } | null
    return generateAmtrInspectionPdf(buildInsp(forStatus), member!, checklist, { baseName: ci?.name, baseIcao: ci?.icao })
  }

  const exportPdf = () => {
    if (!member) return
    const { doc, filename } = buildInspectionPdf(status)
    doc.save(filename); toast.success('Inspection PDF exported')
  }

  if (loading) return <div style={{ padding: 24 }}><LoadingState message="Loading record + checklist…" /></div>
  if (!member) return <div style={{ padding: 24 }}><EmptyState message="Member not found." /></div>
  if (!canManage && !myRoles.some((r) => r !== 'trainee')) return (
    <div style={{ padding: 24 }}>
      <Btn variant="ghost" onClick={() => router.push(`/amtr/${memberId}`)}><ArrowLeft size={15} /> Record</Btn>
      <div style={{ marginTop: 16 }}><EmptyState message="Record inspections require a Trainer, Certifier, NAMT, or AFM role." /></div>
    </div>
  )

  const gapCount = items.filter((it) => it.status === 'no').length
  const answered = items.filter((it) => it.status != null).length

  return (
    <div style={{ padding: 16, height: `calc(100vh - ${AMTR_BAR_HEIGHT}px)`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <Btn variant="ghost" onClick={() => router.push(`/amtr/${memberId}`)}><ArrowLeft size={15} /> Record</Btn>
        <ClipboardCheck size={20} style={{ color: 'var(--color-accent)' }} />
        <h1 style={{ margin: 0, fontSize: 18 }}>Record Inspection — {member.full_name}</h1>
        {skillLevel != null && (
          <span title="Highest skill level attained (Qualifications tab). JQS core tasks that only become required above this level are not expected to be signed."
            style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)', color: 'var(--color-accent)' }}>
            {skillLevel}-skill level
          </span>
        )}
        <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          {answered}/{items.length} answered · {gapCount} gap{gapCount === 1 ? '' : 's'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={load}>Re-run scan</Btn>
          {canExport && <Btn variant="ghost" onClick={exportPdf}>Export PDF</Btn>}
          {status === 'completed'
            ? <Btn variant="secondary" onClick={reopen} disabled={!canWrite}>Reopen</Btn>
            : <Btn variant="primary" onClick={complete} disabled={!canWrite}>Mark completed</Btn>}
        </div>
      </div>

      {status === 'completed' && (
        <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 8, fontSize: 'var(--fs-sm)', background: 'color-mix(in srgb, var(--color-success) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)', color: 'var(--color-text-2)' }}>
          <strong style={{ color: 'var(--color-success)' }}>Completed.</strong> A “Monthly Training Records Inspection” 623A entry was added to the record. Reopen to make changes.
        </div>
      )}

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {/* ── Full-width read-only record (the checklist floats over it) ── */}
        <div style={{ height: '100%', overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap', position: 'sticky', top: 0, background: 'var(--color-bg-surface)', paddingBottom: 6, zIndex: 1 }}>
            {RECORD_TABS.map(([k, lbl]) => (
              <button key={k} onClick={() => setRecordTab(k)}
                style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-xs)', fontWeight: recordTab === k ? 700 : 600, background: recordTab === k ? 'var(--color-accent)' : 'var(--color-bg-inset)', color: recordTab === k ? '#fff' : 'var(--color-text-2)' }}>{lbl}</button>
            ))}
          </div>
          <RecordPanel tab={recordTab} member={member} memberId={memberId} installationId={installationId!} data={data} myUserId={myUserId} />
        </div>

        {/* ── Floating checklist: minimize to read the record full-width ── */}
        {!checklistOpen && (
          <button onClick={() => setChecklistOpen(true)} title="Open inspection checklist"
            style={{ position: 'absolute', right: 14, top: 14, zIndex: 20, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>
            <ClipboardCheck size={16} style={{ color: 'var(--color-accent)' }} />
            Checklist · {answered}/{items.length}
            <span style={{ color: gapCount ? 'var(--color-danger)' : 'var(--color-text-3)' }}>· {gapCount} gap{gapCount === 1 ? '' : 's'}</span>
          </button>
        )}

        <aside style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 440, maxWidth: 'calc(100% - 24px)', display: checklistOpen ? 'flex' : 'none', flexDirection: 'column', borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', boxShadow: '0 10px 34px rgba(0,0,0,0.28)', zIndex: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--color-border)' }}>
            <ClipboardCheck size={16} style={{ color: 'var(--color-accent)' }} />
            <strong style={{ fontSize: 'var(--fs-sm)' }}>Inspection Checklist</strong>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)' }}>{answered}/{items.length} · {gapCount} gap{gapCount === 1 ? '' : 's'}</span>
            <button onClick={() => setChecklistOpen(false)} title="Minimize"
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', fontFamily: 'inherit', fontSize: 'var(--fs-xs)' }}>
              <Minus size={16} /> Minimize
            </button>
          </div>
          <div style={{ overflow: 'auto', padding: 12, flex: 1, minHeight: 0 }}>
          {checklist.filter((r) => r.kind === 'section').map((sec) => {
            const open = !collapsed.has(sec.item_number)
            const secItems = checklist.filter((r) => r.kind === 'item' && r.item_number.split('.')[0] === sec.item_number)
            const jumpTab = SECTION_TAB[sec.item_number]
            return (
              <div key={sec.item_number} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}>
                  <button onClick={() => setCollapsed((p) => { const n = new Set(p); n.has(sec.item_number) ? n.delete(sec.item_number) : n.add(sec.item_number); return n })}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text-1)', padding: 0 }}>
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>{sec.item_number}. {sec.label}</strong>
                  </button>
                  {jumpTab && <button onClick={() => setRecordTab(jumpTab)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>view in record →</button>}
                </div>
                {open && secItems.map((it) => {
                  const resp = itemByNum.get(it.item_number)
                  const gap = resp?.status === 'no' || (resp?.status == null && resp?.auto === 'no')
                  return (
                    <div key={it.item_number} style={{ padding: '8px 6px', borderTop: '1px solid var(--color-border)', background: gap ? 'color-mix(in srgb, var(--color-danger) 6%, transparent)' : undefined }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', minWidth: 34 }}>{it.item_number}</span>
                        <span style={{ flex: 1, fontSize: 'var(--fs-sm)' }}>{it.label}</span>
                        <TriState value={resp?.status ?? null} disabled={status === 'completed' || !canWrite} onChange={(v) => setItemStatus(it.item_number, v)} />
                      </div>
                      {resp && resp.findings.length > 0 && (
                        <div style={{ marginLeft: 42, marginTop: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-warning)' }}>⚠ {resp.findings.join(' · ')}</div>
                      )}
                      {resp && resp.auto != null && (
                        <div style={{ marginLeft: 42, marginTop: 2, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>auto-suggested: {resp.auto.toUpperCase()}</div>
                      )}
                      {resp && resp.auto == null && (
                        <div style={{ marginLeft: 42, marginTop: 2, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>manual review — no automated check for this item</div>
                      )}
                      {(() => {
                        const showComment = resp?.status === 'no' || !!resp?.note || commentOpen.has(it.item_number)
                        if (!showComment) {
                          return (status !== 'completed' && canWrite) ? (
                            <button onClick={() => setCommentOpen((p) => { const n = new Set(p); n.add(it.item_number); return n })}
                              style={{ marginLeft: 42, marginTop: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-accent)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>
                              + Add comment
                            </button>
                          ) : null
                        }
                        return (
                          <textarea className="input-dark" rows={2}
                            placeholder={resp?.status === 'no' ? 'Reason / corrective action for this finding…' : 'Comment…'}
                            style={{ marginLeft: 42, marginTop: 6, width: 'calc(100% - 42px)', resize: 'vertical', fontSize: 'var(--fs-xs)' }}
                            value={resp?.note ?? ''} disabled={status === 'completed' || !canWrite}
                            onChange={(e) => setItemNote(it.item_number, e.target.value)} />
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            )
          })}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Inspector Notes</div>
            <textarea className="input-dark" rows={3} style={{ width: '100%', resize: 'vertical' }} value={notes} disabled={status === 'completed' || !canWrite}
              onChange={(e) => { setNotes(e.target.value); queueSave(items, e.target.value) }} />
          </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function TriState({ value, disabled, onChange }: { value: 'yes' | 'no' | 'na' | null; disabled: boolean; onChange: (v: 'yes' | 'no' | 'na') => void }) {
  const opts: { v: 'yes' | 'no' | 'na'; label: string; color: string }[] = [
    { v: 'yes', label: 'Y', color: 'var(--color-success)' },
    { v: 'no', label: 'N', color: 'var(--color-danger)' },
    { v: 'na', label: 'N/A', color: 'var(--color-text-3)' },
  ]
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {opts.map((o) => {
        const on = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)} disabled={disabled}
            style={{ minWidth: 30, padding: '2px 6px', borderRadius: 5, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-xs)', fontWeight: 700, border: `1px solid ${on ? o.color : 'var(--color-border-mid)'}`, background: on ? `color-mix(in srgb, ${o.color} 18%, transparent)` : 'transparent', color: on ? o.color : 'var(--color-text-3)' }}>{o.label}</button>
        )
      })}
    </div>
  )
}

// Read-only record viewer reusing the existing tab components. Each tab gets
// the props its signature requires (canWrite/canEnterData false → no inputs).
function RecordPanel({ tab, member, memberId, installationId, data, myUserId }: {
  tab: string; member: AmtrMember; memberId: string; installationId: string; data: Record<string, Row[]>; myUserId: string | null
}) {
  const base = { canWrite: false, canEnterData: false, isOwn: false, myRoles: [] as AmtrRole[], sign: noopAsync, reopen: noopAsync, onChange: noop }
  switch (tab) {
    case 'jqs': return <JqsTab catalog={data.jqsCat ?? []} progress={data.jqsProg ?? []} installationId={installationId} memberId={memberId} member={member} canManage={false} highlightItem={null} notifySignoff={noopAsync} {...base} />
    case '1098': return <Form1098Tab catalog={data.r1098Cat ?? []} progress={data.r1098Prog ?? []} installationId={installationId} memberId={memberId} member={member} canManage={false} highlightItem={null} {...base} />
    case '623a': return <Form623aTab entries={data.e623a ?? []} installationId={installationId} memberId={memberId} member={member} effRole={null} highlightItem={null} {...base} />
    case '797': return <Form797Tab items={data.items797 ?? []} installationId={installationId} memberId={memberId} member={member} myUserId={myUserId} highlightItem={null} {...base} />
    case '803': return <Form803Tab rows={data.items803 ?? []} installationId={installationId} memberId={memberId} member={member} {...base} />
    case 'milestones': return <MilestonesTab catalog={data.mileCat ?? []} progress={data.mileProg ?? []} canEnterData={false} installationId={installationId} memberId={memberId} onChange={noop} />
    case 'formal': return <FormalTab catalog={data.formalCat ?? []} progress={data.formalProg ?? []} canEnterData={false} canManage={false} installationId={installationId} memberId={memberId} onChange={noop} />
    case 'rat': return <RatTab catalog={data.ratCat ?? []} progress={data.ratProg ?? []} canWrite={false} canManage={false} memberId={memberId} installationId={installationId} member={member} onChange={noop} highlightItem={null} />
    case 'qual': return <QualificationsTab installationId={installationId} memberId={memberId} canEnterData={false} />
    default: return null
  }
}
