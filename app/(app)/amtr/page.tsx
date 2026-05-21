'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchAmtrMembers, fetchAmtrByBase, createAmtrMember, type AmtrMember,
} from '@/lib/supabase/amtr'
import { dueStatus, ratApplies } from '@/lib/amtr/status'
import { buildUnitKpis, type UnitKpis } from '@/lib/amtr/rollup'
import { AMTR_MEMBER_STATUSES } from '@/lib/amtr/reference-data'
import { NotificationCenter } from '@/components/amtr/notification-center'
import { TrainingReferences } from '@/components/amtr/training-references'
import { HowToGuide } from '@/components/amtr/how-to-guide'
import { Field, Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Award, Plus, BarChart3, UsersRound, ChevronRight, BookOpen, ClipboardCheck, HelpCircle } from 'lucide-react'

type Row = Record<string, unknown>

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
  borderRadius: 6, fontSize: 'var(--fs-sm)', fontWeight: 600,
  border: '1.5px solid var(--color-border-mid)', color: 'var(--color-text-1)',
  textDecoration: 'none',
}

export default function AmtrRosterPage() {
  const { installationId } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()
  const router = useRouter()
  const canWrite = has(PERM.AMTR_WRITE)
  const canManage = has(PERM.AMTR_MANAGE)
  const canView = has(PERM.AMTR_VIEW)

  const [members, setMembers] = useState<AmtrMember[]>([])
  const [kpis, setKpis] = useState<UnitKpis>({ members: 0, requiredTasks: 0, complete: 0, dueSoon: 0, overdue: 0 })
  const [memberDue, setMemberDue] = useState<Record<string, { overdue: number; dueSoon: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showRefs, setShowRefs] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [dafsc, setDafsc] = useState('')
  const [status, setStatus] = useState<typeof AMTR_MEMBER_STATUSES[number]>('Active')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [mem, r1098Prog, ratProg] = await Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Row>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_rat_progress', installationId, 'member_id'),
    ])
    setMembers(mem)

    const statusOf = new Map(mem.map((m) => [m.id, m.status]))
    const recurring: { memberStatus: string; isRat: boolean; dueDate?: string | null; completedDate?: string | null }[] = []
    const perMember: Record<string, { overdue: number; dueSoon: number }> = {}
    const bump = (id: string, s: ReturnType<typeof dueStatus>) => {
      if (s !== 'overdue' && s !== 'due_soon') return
      perMember[id] = perMember[id] ?? { overdue: 0, dueSoon: 0 }
      if (s === 'overdue') perMember[id].overdue++; else perMember[id].dueSoon++
    }
    for (const r of r1098Prog) {
      const ms = statusOf.get(String(r.member_id)) ?? 'Active'
      recurring.push({ memberStatus: ms, isRat: false, dueDate: r.next_due as string, completedDate: r.last_completed as string })
      bump(String(r.member_id), dueStatus({ dueDate: r.next_due as string, completedDate: r.last_completed as string }))
    }
    for (const r of ratProg) {
      const ms = statusOf.get(String(r.member_id)) ?? 'Active'
      if (!ratApplies(ms)) continue
      recurring.push({ memberStatus: ms, isRat: true, dueDate: r.due as string, completedDate: r.completed as string })
      bump(String(r.member_id), dueStatus({ dueDate: r.due as string, completedDate: r.completed as string }))
    }
    setKpis(buildUnitKpis(mem, recurring))
    setMemberDue(perMember)
    setLoading(false)
  }, [installationId])

  useEffect(() => { load() }, [load])

  const addMember = async () => {
    if (!installationId || !name.trim()) return
    setSaving(true)
    const { error } = await createAmtrMember({
      base_id: installationId, full_name: name.trim(),
      grade: grade || null, dafsc: dafsc || null, status,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Member added')
    setName(''); setGrade(''); setDafsc(''); setStatus('Active'); setShowForm(false)
    load()
  }

  if (permsLoaded && !canView) {
    return <div style={{ padding: 24 }}><EmptyState message="You don't have access to Training Records." /></div>
  }

  const compliancePct = kpis.requiredTasks > 0 ? Math.round((kpis.complete / kpis.requiredTasks) * 100) : 100
  const complianceColor = compliancePct >= 90 ? 'var(--color-success)' : compliancePct >= 75 ? 'var(--color-warning)' : 'var(--color-danger)'
  const kpiCards = [
    { label: 'Members', value: kpis.members, color: 'var(--color-accent)', onClick: () => document.getElementById('amtr-roster')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Compliance', value: `${compliancePct}%`, color: complianceColor },
    { label: 'Recurring Items', value: kpis.requiredTasks },
    { label: 'Complete', value: kpis.complete, color: 'var(--color-success)' },
    { label: 'Due Soon', value: kpis.dueSoon, color: 'var(--color-warning)' },
    { label: 'Overdue', value: kpis.overdue, color: 'var(--color-danger)' },
  ]

  const filtered = members.filter((m) =>
    !search || m.full_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Award size={24} style={{ color: 'var(--color-accent)' }} />
        <h1 style={{ margin: 0, fontSize: 22 }}>Training Records</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant={showGuide ? 'primary' : 'secondary'} onClick={() => setShowGuide((s) => !s)}><HelpCircle size={15} /> How it works</Btn>
          <Btn variant={showRefs ? 'primary' : 'secondary'} onClick={() => setShowRefs((s) => !s)}><BookOpen size={15} /> Training References</Btn>
          <Link href="/amtr/reports" style={linkBtnStyle}><BarChart3 size={15} /> Reports</Link>
          {canManage && <Link href="/amtr/roles" style={linkBtnStyle}><UsersRound size={15} /> Training Admin</Link>}
          {canWrite && (
            <Btn variant="primary" onClick={() => setShowForm((s) => !s)}><Plus size={15} /> New Member</Btn>
          )}
        </div>
      </div>

      {/* Analytics KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 18 }}>
        {kpiCards.map((k) => (
          <div key={k.label} className="card" style={{ padding: '14px 16px', cursor: k.onClick ? 'pointer' : 'default' }} onClick={k.onClick}>
            <div className="section-label" style={{ marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color ?? 'var(--color-text-1)' }}>{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      {showGuide && (
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <HowToGuide />
        </div>
      )}

      {showRefs && (
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <TrainingReferences installationId={installationId} canManage={canManage} />
        </div>
      )}

      <div style={{ marginBottom: 18 }}><NotificationCenter /></div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12 }}>
            <Field label="Full name"><input className="input-dark" value={name} onChange={(e) => setName(e.target.value)} placeholder="Last, First M." /></Field>
            <Field label="Grade"><input className="input-dark" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="SrA / E-4" /></Field>
            <Field label="DAFSC"><input className="input-dark" value={dafsc} onChange={(e) => setDafsc(e.target.value)} placeholder="1C751" /></Field>
            <Field label="Status">
              <select className="input-dark" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {AMTR_MEMBER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={addMember} disabled={saving || !name.trim()}>Add Member</Btn>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      <div id="amtr-roster" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Assigned Members</h2>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{members.length}</span>
        <input
          className="input-dark"
          style={{ marginLeft: 'auto', maxWidth: 280 }}
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? <LoadingState message="Loading roster…" />
        : filtered.length === 0 ? <EmptyState message="No members on the training roster yet." icon="🎓" />
        : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Member</th>
                  <th style={thStyle}>Grade</th>
                  <th style={thStyle}>DAFSC</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Currency</th>
                  <th style={thStyle}>Linked</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const due = memberDue[m.id]
                  return (
                    <tr
                      key={m.id}
                      onClick={() => router.push(`/amtr/${m.id}`)}
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{m.full_name}</td>
                      <td style={tdStyle}>{m.grade ?? '—'}</td>
                      <td style={tdStyle}>{m.dafsc ?? '—'}</td>
                      <td style={tdStyle}>{m.status}</td>
                      <td style={tdStyle}>
                        {!due || (due.overdue === 0 && due.dueSoon === 0)
                          ? <Badge label="Current" color="var(--color-success)" />
                          : (
                            <span style={{ display: 'inline-flex', gap: 6 }}>
                              {due.overdue > 0 && <Badge label={`${due.overdue} overdue`} color="var(--color-danger)" />}
                              {due.dueSoon > 0 && <Badge label={`${due.dueSoon} due soon`} color="var(--color-warning)" />}
                            </span>
                          )}
                      </td>
                      <td style={tdStyle}>
                        {m.user_id ? <Badge label="Account" color="var(--color-success)" /> : <Badge label="Roster" color="#94A3B8" />}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {canWrite && (
                          <button onClick={(e) => { e.stopPropagation(); window.open(`/amtr/${m.id}/inspect`, '_blank') }}
                            title="Inspect record (new tab)"
                            style={{ background: 'none', border: '1px solid var(--color-border-mid)', borderRadius: 6, padding: '3px 8px', marginRight: 8, cursor: 'pointer', color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>
                            <ClipboardCheck size={13} style={{ verticalAlign: '-2px' }} /> Inspect
                          </button>
                        )}
                        <ChevronRight size={16} style={{ color: 'var(--color-text-3)', verticalAlign: 'middle' }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
