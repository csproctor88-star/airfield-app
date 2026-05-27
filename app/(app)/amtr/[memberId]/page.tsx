'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchAmtrMember, fetchAmtrMembers, updateAmtrMember, fetchAmtrByBase, fetchAmtrByMember,
  upsertAmtrRow, deleteAmtrRow, amtrSign, fetchAmtrRoleAssignments,
  createAmtrNotification,
  type AmtrMember, type AmtrRole, type AmtrSignableTable,
} from '@/lib/supabase/amtr'
import { AMTR_MEMBER_STATUSES } from '@/lib/amtr/reference-data'
import { amtrReopen } from '@/lib/supabase/amtr'
import { canSignSlot, effectiveRoleForRecord, canEnterDataOnRecord, canViewRecord, AMTR_ROLE_LABELS, type SignSlot } from '@/lib/amtr/roles'
import { buildSignoff } from '@/lib/amtr/notifications'
import { Field, Btn } from '@/components/amtr/ui'
import { RecordSidebar } from '@/components/amtr/record-sidebar'
import { JqsTab } from '@/components/amtr/jqs-tab'
import { Form623aTab } from '@/components/amtr/form623a-tab'
import { Form797Tab } from '@/components/amtr/form797-tab'
import { Form1098Tab } from '@/components/amtr/form1098-tab'
import { RatTab } from '@/components/amtr/rat-tab'
import { Form803Tab } from '@/components/amtr/form803-tab'
import { MilestonesTab } from '@/components/amtr/milestones-tab'
import { QualificationsTab } from '@/components/amtr/qualifications-tab'
import { FormalTab } from '@/components/amtr/formal-tab'
import { HistoryTab } from '@/components/amtr/history-tab'
import { MemberOverview } from '@/components/amtr/member-overview'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import { ArrowLeft, Award, ClipboardCheck, FileSpreadsheet, Upload, X } from 'lucide-react'
import type { ParsedRecord, ImportSummary } from '@/lib/amtr-record-import'

type Row = Record<string, unknown>

const TAB_LABELS: Record<string, string> = {
  cover: 'Cover', qualifications: 'Qualifications', formal: 'Formal Training',
  '623a': 'DAF 623A', '797': 'DAF 797', '803': 'DAF 803',
  milestones: 'Milestones', '1098': 'DAF 1098', jqs: 'JQS-CFETP',
  rat: 'RAT', files: 'Files', history: 'History',
}

const RAT_EXEMPT = new Set(['Contractor', 'Civilian', 'Separated'])

export default function AmtrMemberPage() {
  const params = useParams<{ memberId: string }>()
  const memberId = params.memberId
  const searchParams = useSearchParams()
  const router = useRouter()
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has(PERM.AMTR_WRITE)
  const canManage = has(PERM.AMTR_MANAGE)
  const canExport = has(PERM.AMTR_EXPORT)
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<{ parsed: ParsedRecord; summary: ImportSummary } | null>(null)
  const [importing, setImporting] = useState(false)

  const [member, setMember] = useState<AmtrMember | null>(null)
  const [allMembers, setAllMembers] = useState<AmtrMember[]>([])
  const [myRoles, setMyRoles] = useState<AmtrRole[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [userLabels, setUserLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>(searchParams.get('tab') ?? 'cover')
  const highlightItem = searchParams.get('item')

  // Per-tab data caches
  const [jqsCat, setJqsCat] = useState<Row[]>([])
  const [jqsProg, setJqsProg] = useState<Row[]>([])
  const [r1098Cat, setR1098Cat] = useState<Row[]>([])
  const [r1098Prog, setR1098Prog] = useState<Row[]>([])
  const [ratCat, setRatCat] = useState<Row[]>([])
  const [ratProg, setRatProg] = useState<Row[]>([])
  const [entries623a, setEntries623a] = useState<Row[]>([])
  const [items797, setItems797] = useState<Row[]>([])
  const [formalCat, setFormalCat] = useState<Row[]>([])
  const [formalProg, setFormalProg] = useState<Row[]>([])
  const [items803, setItems803] = useState<Row[]>([])
  const [mileCat, setMileCat] = useState<Row[]>([])
  const [mileProg, setMileProg] = useState<Row[]>([])

  const isOwn = !!(member?.user_id && member.user_id === myUserId)
  // Program managers (amtr:manage — AFM / NAMT / Base Admin) bypass the AMTR-role
  // layer: they act with AFM authority on every record so they can always see,
  // edit, and sign (still subject to the self-certification guard on their own
  // record). Everyone else operates strictly under their assigned AMTR roles.
  const signingRoles: AmtrRole[] = canManage ? Array.from(new Set<AmtrRole>([...myRoles, 'afm'])) : myRoles
  const effRole = effectiveRoleForRecord(signingRoles, isOwn)
  // Visibility: own record always; others' records only with a non-trainee role
  // (or manager bypass). A no-role user sees only their own record.
  const canSee = canManage || canViewRecord(myRoles, isOwn)
  const hasOversight = canManage || myRoles.some((r) => r !== 'trainee')

  const loadMember = useCallback(async () => {
    if (!memberId || !installationId) return
    setLoading(true)
    const supabase = createClient()
    let uid: string | null = null
    if (supabase) {
      try { const { data: { user } } = await supabase.auth.getUser(); uid = user?.id ?? null } catch { /* */ }
    }
    setMyUserId(uid)
    const [m, roles, all] = await Promise.all([
      fetchAmtrMember(memberId),
      fetchAmtrRoleAssignments(installationId),
      fetchAmtrMembers(installationId),
    ])
    setMember(m)
    setAllMembers(all)
    setMyRoles(roles.filter((r) => r.user_id === uid).map((r) => r.role))
    // user-id → "Rank Last, First" map for the History tab
    if (supabase) {
      try {
        const { data } = await supabase.from('profiles').select('*').limit(500)
        const rows = (data ?? []) as unknown as { id: string; rank?: string | null; first_name?: string | null; last_name?: string | null; name?: string | null }[]
        const map: Record<string, string> = {}
        for (const r of rows) {
          const last = (r.last_name || '').trim(); const first = (r.first_name || '').trim(); const rank = (r.rank || '').trim()
          map[r.id] = (last || first) ? `${rank ? rank + ' ' : ''}${last}${last && first ? ', ' : ''}${first}`.trim() : (r.name || 'User')
        }
        setUserLabels(map)
      } catch { /* RLS may block */ }
    }
    setLoading(false)
  }, [memberId, installationId])

  const loadTab = useCallback(async () => {
    if (!memberId || !installationId) return
    if (tab === 'jqs') {
      setJqsCat(await fetchAmtrByBase('amtr_jqs_catalog', installationId))
      setJqsProg(await fetchAmtrByMember('amtr_jqs_progress', memberId))
    } else if (tab === '1098') {
      setR1098Cat(await fetchAmtrByBase('amtr_1098_catalog', installationId))
      setR1098Prog(await fetchAmtrByMember('amtr_1098_progress', memberId))
    } else if (tab === 'rat') {
      setRatCat(await fetchAmtrByBase('amtr_rat_catalog', installationId))
      setRatProg(await fetchAmtrByMember('amtr_rat_progress', memberId))
    } else if (tab === '623a') {
      setEntries623a(await fetchAmtrByMember('amtr_623a', memberId, 'form_date'))
    } else if (tab === '797') {
      setItems797(await fetchAmtrByMember('amtr_797', memberId, 'sort_order'))
    } else if (tab === 'formal') {
      setFormalCat(await fetchAmtrByBase('amtr_formal_catalog', installationId))
      setFormalProg(await fetchAmtrByMember('amtr_formal_progress', memberId))
    } else if (tab === '803') {
      setItems803(await fetchAmtrByMember('amtr_803', memberId, 'sort_order'))
    } else if (tab === 'milestones') {
      setMileCat(await fetchAmtrByBase('amtr_milestone_catalog', installationId))
      setMileProg(await fetchAmtrByMember('amtr_milestone_progress', memberId))
    }
  }, [tab, memberId, installationId])

  useEffect(() => { loadMember() }, [loadMember])
  useEffect(() => { loadTab() }, [loadTab])

  // Keep the active tab in sync with the URL so a notification click lands on
  // the right tab even when we're already on this member's page (the
  // NotificationCenter also renders on the Cover tab).
  useEffect(() => {
    const t = searchParams.get('tab')
    if (t) setTab(t)
  }, [searchParams])

  // Scroll the highlighted item into view once its tab has rendered.
  useEffect(() => {
    if (!highlightItem) return
    const el = document.querySelector(`[data-amtr-item="${highlightItem}"]`)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightItem, tab, jqsProg, r1098Prog, ratProg, entries623a, items797, mileProg])

  // ── signature helper ───────────────────────────────────────
  // Per-block: signing fills one block and locks only that block; the rest
  // of the record stays editable. Authority is hierarchical (see roles.ts).
  const sign = async (
    table: AmtrSignableTable, rowId: string, slot: SignSlot,
    onSigned?: () => Promise<void>,
  ) => {
    if (!canSignSlot(signingRoles, slot, isOwn)) {
      toast.error(`You can't sign the ${slot} block on this record.`); return
    }
    const initials = window.prompt(`Enter your initials to sign the ${slot} block:`)?.trim()
    if (!initials) return
    const initialsConfirm = window.confirm(`I certify this signature for the ${slot} block. Initials "${initials}" will be recorded with my identity and timestamp. This block becomes final (only NAMT/AFM can reopen it).`)
    if (!initialsConfirm) return
    const { error } = await amtrSign(table, rowId, slot, initials)
    if (error) { toast.error(error); return }
    toast.success('Signed')
    if (onSigned) await onSigned()
    loadTab()
  }

  const reopen = async (table: AmtrSignableTable, rowId: string, slot: SignSlot) => {
    if (!window.confirm(`Reopen the ${slot} signature? This clears the initials and is logged in the History.`)) return
    const { error } = await amtrReopen(table, rowId, slot)
    if (error) { toast.error(error); return }
    toast.success('Signature reopened'); loadTab()
  }

  const exportRecord = async () => {
    if (!member || !installationId) return
    setExporting(true)
    try { const { exportAmtrRecord } = await import('@/lib/amtr-record-excel'); await exportAmtrRecord(installationId, member); toast.success('Record exported to Excel') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed') }
    finally { setExporting(false) }
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const { parseAmtrRecordWorkbook, summarizeParsed } = await import('@/lib/amtr-record-import')
      const parsed = await parseAmtrRecordWorkbook(buf)
      setImportPreview({ parsed, summary: summarizeParsed(parsed) })
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not read the workbook') }
  }
  const doImport = async () => {
    if (!member || !installationId || !importPreview) return
    setImporting(true)
    try {
      const { applyAmtrImport } = await import('@/lib/amtr-record-import')
      const { written, unmatched, errors } = await applyAmtrImport(installationId, member, importPreview.parsed)
      const parts = [`Imported ${written} item${written === 1 ? '' : 's'}`]
      if (unmatched.length) parts.push(`${unmatched.length} unmatched`)
      if (errors.length) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`)
      const msg = parts.join(' · ')
      if (errors.length) {
        toast.error(msg)
        // Log full error list to the console so the operator can copy
        // specifics if any rows failed — toast text is too short for 100+
        // RLS/constraint messages.
        // eslint-disable-next-line no-console
        console.error('[AMTR import errors]', errors)
      } else {
        toast.success(msg)
      }
      setImportPreview(null); loadMember(); loadTab()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Import failed') }
    finally { setImporting(false) }
  }

  const notifyJqsSignoff = async (slot: SignSlot, itemRef: string, itemId: string) => {
    if (slot === 'trainee' || !member?.user_id || !installationId) return
    const draft = buildSignoff(member.full_name, slot as AmtrRole, 'JQS-CFETP', itemRef, itemId, 'jqs')
    await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...draft })
  }

  if (loading) return <div style={{ padding: 24 }}><LoadingState message="Loading record…" /></div>
  if (!member) return <div style={{ padding: 24 }}><EmptyState message="Member not found." /></div>
  if (!canSee) return (
    <div style={{ padding: 24 }}>
      <Btn variant="ghost" onClick={() => router.push('/amtr')}><ArrowLeft size={15} /> Roster</Btn>
      <div style={{ marginTop: 16 }}>
        <EmptyState message="You don't have access to this training record. You can only view records you're assigned an AMTR role for." />
      </div>
    </div>
  )

  // Program managers (NAMT/AFM) may transcribe data on their OWN record —
  // a carve-out for one-person shops with no supervisor above them. The
  // signing self-certification guard is enforced separately in
  // slotsUserCanSign(isOwn=true) → only the Trainee block is self-signable.
  const dataEntryAllowed = canEnterDataOnRecord(signingRoles, isOwn)
  // Only managers / users with a non-trainee role may jump to other members.
  const memberOptions = hasOversight ? allMembers : allMembers.filter((m) => m.user_id === myUserId)
  const hiddenTabs = RAT_EXEMPT.has(member.status) ? new Set(['rat']) : undefined

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Btn variant="ghost" onClick={() => router.push('/amtr')}><ArrowLeft size={15} /> Roster</Btn>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
          Member
          <select className="input-dark" style={{ width: 'auto', minWidth: 240 }} value={memberId}
            onChange={(e) => router.push(`/amtr/${e.target.value}${tab !== 'cover' ? `?tab=${tab}` : ''}`)}>
            {memberOptions.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.grade ? ` — ${m.grade}` : ''}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <Award size={22} style={{ color: 'var(--color-accent)' }} />
        <h1 style={{ margin: 0, fontSize: 22 }}>{member.full_name}</h1>
        <span style={{ color: 'var(--color-text-3)' }}>
          {[member.grade, member.dafsc, member.status].filter(Boolean).join(' · ')}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {canExport && (
            <Btn variant="secondary" onClick={exportRecord} disabled={exporting}>
              <FileSpreadsheet size={15} /> {exporting ? 'Exporting…' : 'Export Record (Excel)'}
            </Btn>
          )}
          {canWrite && dataEntryAllowed && (
            <>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import from Excel</Btn>
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={onImportFile} />
            </>
          )}
          {canWrite && hasOversight && (
            <Btn variant="secondary" onClick={() => window.open(`/amtr/${memberId}/inspect`, '_blank')}>
              <ClipboardCheck size={15} /> Inspect record ↗
            </Btn>
          )}
        </div>
      </div>

      {importPreview && (
        <div onClick={() => !importing && setImportPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 480, maxWidth: '100%', padding: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <Upload size={16} style={{ color: 'var(--color-accent)' }} />
              <strong>Import training record for {member.full_name}</strong>
              <button onClick={() => setImportPreview(null)} disabled={importing} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 10 }}>Found in the workbook:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px', fontSize: 'var(--fs-sm)' }}>
                {Object.entries(importPreview.summary.counts).map(([k, n]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <span style={{ color: 'var(--color-text-2)' }}>{k}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600, color: n > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)' }}>{n}</span>
                  </div>
                ))}
              </div>
              {Object.keys(importPreview.summary.milestoneTopics).length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                  <div style={{ marginBottom: 4 }}>Milestone sheets (catalog reference only — no member data on these tabs):</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 16px', fontSize: 'var(--fs-xs)' }}>
                    {Object.entries(importPreview.summary.milestoneTopics).map(([k, n]) => (
                      <div key={k} style={{ display: 'contents' }}>
                        <span>{k}</span>
                        <span style={{ textAlign: 'right' }}>{n} topic{n === 1 ? '' : 's'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {importPreview.summary.unmatchedSheets.length > 0 && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
                  <strong>Unrecognized sheets — data on these tabs will NOT be imported:</strong>
                  <div style={{ marginTop: 4 }}>{importPreview.summary.unmatchedSheets.join(' · ')}</div>
                  <div style={{ marginTop: 6, color: 'var(--color-text-3)' }}>Rename them to match the canonical sheet names (see Help → AMTR) and re-import to capture this data.</div>
                </div>
              )}
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', background: 'var(--color-bg-inset)' }}>
                Initials are imported as transcribed text (not locked e-signatures). 1098 / JQS / Qualifications / RAT match the base catalog by name/number — unmatched rows are skipped. 623A, 797, and 803 rows are added to the record. Run once on a fresh record to avoid duplicates.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
              <Btn variant="ghost" onClick={() => setImportPreview(null)} disabled={importing}>Cancel</Btn>
              <Btn variant="primary" onClick={doImport} disabled={importing}>{importing ? 'Importing…' : 'Import'}</Btn>
            </div>
          </div>
        </div>
      )}
      <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginBottom: 16 }}>
        {isOwn
          ? dataEntryAllowed
            ? 'Viewing your own record — Training Manager carve-out: you may transcribe data on your own record; only the Trainee block is self-signable.'
            : 'Viewing your own record — Trainee context (you self-initial your own column).'
          : effRole ? `Viewing as ${AMTR_ROLE_LABELS[effRole] ?? effRole}.` : 'View only — no AMTR role assigned.'}
      </div>

      <div style={{ marginBottom: 16 }}>
        <RecordSidebar labels={TAB_LABELS} active={tab} onChange={setTab} hidden={hiddenTabs} />
      </div>
      <div>

      {tab === 'cover' && (
        <>
          <MemberOverview installationId={installationId!} member={member} />
          <CoverTab member={member} canWrite={canWrite && dataEntryAllowed} onSaved={loadMember} />
        </>
      )}
      {tab === 'history' && <HistoryTab memberId={memberId} userLabels={userLabels} />}

      {tab === 'jqs' && (
        <JqsTab
          catalog={jqsCat}
          progress={jqsProg}
          installationId={installationId!}
          memberId={memberId}
          member={member}
          myRoles={signingRoles}
          canWrite={canWrite}
          canEnterData={dataEntryAllowed}
          canManage={canManage}
          isOwn={isOwn}
          highlightItem={highlightItem}
          sign={sign}
          reopen={reopen}
          onChange={loadTab}
          notifySignoff={notifyJqsSignoff}
        />
      )}

      {tab === '1098' && (
        <Form1098Tab catalog={r1098Cat} progress={r1098Prog} canWrite={canWrite} canEnterData={dataEntryAllowed} canManage={canManage}
          installationId={installationId!} memberId={memberId} member={member} myRoles={signingRoles} isOwn={isOwn}
          highlightItem={highlightItem} sign={sign} reopen={reopen} onChange={loadTab} />
      )}

      {tab === 'rat' && (
        <RatTab catalog={ratCat} progress={ratProg} canWrite={canWrite && dataEntryAllowed} canManage={canManage} memberId={memberId}
          installationId={installationId!} member={member} onChange={loadTab} highlightItem={highlightItem} />
      )}

      {tab === '623a' && (
        <Form623aTab entries={entries623a} canWrite={canWrite} canEnterData={dataEntryAllowed} installationId={installationId!}
          memberId={memberId} member={member} myRoles={signingRoles} effRole={effRole} isOwn={isOwn}
          highlightItem={highlightItem} sign={sign} reopen={reopen} onChange={loadTab} />
      )}

      {tab === '797' && (
        <Form797Tab items={items797} canWrite={canWrite} canEnterData={dataEntryAllowed} installationId={installationId!}
          memberId={memberId} member={member} myRoles={signingRoles} myUserId={myUserId} isOwn={isOwn}
          highlightItem={highlightItem} sign={sign} reopen={reopen} onChange={loadTab} />
      )}

      {tab === 'qualifications' && (
        <QualificationsTab installationId={installationId!} memberId={memberId} canEnterData={dataEntryAllowed} />
      )}

      {tab === 'formal' && (
        <FormalTab catalog={formalCat} progress={formalProg} canEnterData={dataEntryAllowed} canManage={canManage}
          installationId={installationId!} memberId={memberId} onChange={loadTab} />
      )}

      {tab === '803' && (
        <Form803Tab rows={items803} canWrite={canWrite} canEnterData={dataEntryAllowed} installationId={installationId!}
          memberId={memberId} member={member} myRoles={signingRoles} isOwn={isOwn} sign={sign} reopen={reopen} onChange={loadTab} />
      )}

      {tab === 'milestones' && (
        <MilestonesTab catalog={mileCat} progress={mileProg} canEnterData={dataEntryAllowed}
          installationId={installationId!} memberId={memberId} onChange={loadTab} />
      )}

      {tab === 'files' && (
        <SimpleListTab tab="files" memberId={memberId} installationId={installationId!} canWrite={canWrite && dataEntryAllowed} />
      )}
      </div>
    </div>
  )
}

// ── Cover ──────────────────────────────────────────────────
function CoverTab({ member, canWrite, onSaved }: { member: AmtrMember; canWrite: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(member)
  const [saving, setSaving] = useState(false)
  useEffect(() => setForm(member), [member])
  const fields: [keyof AmtrMember, string][] = [
    ['full_name', 'Full name'], ['grade', 'Grade'], ['dafsc', 'DAFSC'], ['unit', 'Unit'],
    ['installation', 'Installation'], ['date_assigned', 'Date assigned'], ['tsc', 'TSC'],
    ['duty_position', 'Duty position'], ['supervisor', 'Supervisor'], ['utm', 'UTM'], ['commander', 'Commander'],
  ]
  const save = async () => {
    setSaving(true)
    const { error } = await updateAmtrMember(member.id, {
      full_name: form.full_name, grade: form.grade, dafsc: form.dafsc, unit: form.unit,
      installation: form.installation, date_assigned: form.date_assigned, status: form.status,
      tsc: form.tsc, duty_position: form.duty_position, supervisor: form.supervisor,
      utm: form.utm, commander: form.commander,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Saved'); onSaved()
  }
  return (
    <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {fields.map(([key, label]) => (
        <Field key={key as string} label={label}>
          <input className="input-dark" disabled={!canWrite}
            value={(form[key] as string) ?? ''}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        </Field>
      ))}
      <Field label="Status">
        <select className="input-dark" disabled={!canWrite} value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as AmtrMember['status'] })}>
          {AMTR_MEMBER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      {canWrite && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Btn variant="primary" onClick={save} disabled={saving}>Save Cover</Btn>
        </div>
      )}
    </div>
  )
}

// ── Simple list tab (files) ──
function SimpleListTab(props: { tab: string; memberId: string; installationId: string; canWrite: boolean }) {
  const { tab, memberId, installationId, canWrite } = props
  const CONFIG: Record<string, { table: string; label: string; nameField: string }> = {
    qualifications: { table: 'amtr_quals', label: 'Qualification / SEI', nameField: 'name' },
    files: { table: 'amtr_files', label: 'File', nameField: 'name' },
    '803': { table: 'amtr_803', label: '803 task (STS item)', nameField: 'sts_item' },
    formal: { table: 'amtr_formal_progress', label: 'Formal course', nameField: 'catalog_id' },
    milestones: { table: 'amtr_milestone_progress', label: 'Milestone', nameField: 'catalog_id' },
  }
  const cfg = CONFIG[tab]
  const [rows, setRows] = useState<Row[]>([])
  const load = useCallback(async () => {
    setRows(await fetchAmtrByMember(cfg.table, memberId))
  }, [cfg.table, memberId])
  useEffect(() => { load() }, [load])

  const isFreeAdd = tab === 'qualifications' || tab === 'files' || tab === '803'
  const add = async () => {
    const value = window.prompt(`${cfg.label}:`)?.trim()
    if (!value) return
    const row: Row = { base_id: installationId, member_id: memberId }
    if (tab === 'qualifications') { row.name = value; row.value = 'No' }
    else if (tab === 'files') { row.name = value; row.status = 'Pending'; row.uploaded_at = new Date().toISOString().slice(0, 10) }
    else if (tab === '803') { row.section = 'fiveLevel'; row.sts_item = value }
    const { error } = await upsertAmtrRow(cfg.table, row)
    if (error) { toast.error(error); return }
    load()
  }

  return (
    <div>
      {(tab === 'formal' || tab === 'milestones') && (
        <div style={{ marginBottom: 12, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          {cfg.label}s are driven by the base catalog (managed under Roles &amp; Catalogs); per-member completion shows below.
        </div>
      )}
      {canWrite && isFreeAdd && <div style={{ marginBottom: 12 }}><Btn variant="primary" onClick={add}>+ Add {cfg.label}</Btn></div>}
      {rows.length === 0 ? <EmptyState message={`No ${cfg.label.toLowerCase()} rows yet.`} /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    {String(r[cfg.nameField] ?? r.name ?? r.sts_item ?? r.catalog_id ?? '—')}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-text-3)' }}>
                    {String(r.value ?? r.status ?? r.results ?? (r.completed ? 'Complete' : ''))}
                  </td>
                  {canWrite && (
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <Btn variant="ghost" onClick={async () => { await deleteAmtrRow(cfg.table, String(r.id)); load() }}>Remove</Btn>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
