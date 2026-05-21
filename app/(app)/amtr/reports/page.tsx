'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { fetchAmtrMembers, fetchAmtrByBase, type AmtrMember } from '@/lib/supabase/amtr'
import { dueStatus, ratApplies, parseDate, daysBetween, type DueStatus } from '@/lib/amtr/status'
import { buildMemberRollup, buildUnitKpis, complianceCounts, type MemberRollup, type UnitKpis } from '@/lib/amtr/rollup'
import { generateAmtrRosterPdf, generateAmtrMemberPrintPdf } from '@/lib/amtr-pdf'
import { StatusPill } from '@/components/amtr/status-pill'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { DateRangeBar, defaultRange, inRange, type DateRange } from '@/components/amtr/reports/date-range-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import { ArrowLeft, FileDown } from 'lucide-react'

type Row = Record<string, unknown>

const SUBTABS = [
  ['overview', 'Overview'], ['rollup', 'Unit Roll-up'], ['overdue', 'Overdue / Due Soon'],
  ['recurring', '1098 & RAT'], ['formal', 'Formal Training'], ['activity', '797 Activity'],
  ['quals', 'Quals & SEI'], ['print', 'Member Print'],
] as const

type DueItem = { memberId: string; memberName: string; due: string; delta: number; task: string; source: string; status: DueStatus }

export default function AmtrReportsPage() {
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const router = useRouter()
  const canExport = has(PERM.AMTR_EXPORT)

  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<string>('overview')
  const [range, setRange] = useState<DateRange>(defaultRange())

  const [members, setMembers] = useState<AmtrMember[]>([])
  const [data, setData] = useState<Record<string, Row[]>>({})
  const [rollups, setRollups] = useState<MemberRollup[]>([])
  const [kpis, setKpis] = useState<UnitKpis>({ members: 0, requiredTasks: 0, complete: 0, dueSoon: 0, overdue: 0 })

  const baseInfo = { baseName: currentInstallation?.name, baseIcao: (currentInstallation as { icao?: string } | null)?.icao }

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [mem, jqsCat, jqsProg, formalCat, formalProg, r1098Cat, r1098Prog, ratCat, ratProg, items797, quals, qtps] = await Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Row>('amtr_jqs_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_jqs_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_formal_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_formal_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_1098_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_rat_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_rat_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_797', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_quals', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_qtp', installationId, 'member_id'),
    ])
    setMembers(mem)
    setData({ jqsCat, jqsProg, formalCat, formalProg, r1098Cat, r1098Prog, ratCat, ratProg, items797, quals, qtps })

    const jqsRequired = jqsCat.filter((c) => c.kind === 'item').length
    const formalRequired = formalCat.length
    const byMember = (rows: Row[], id: string) => rows.filter((r) => r.member_id === id)
    const recurring: { memberStatus: string; isRat: boolean; dueDate?: string | null; completedDate?: string | null }[] = []
    const built = mem.map((m) => {
      const jqsDone = byMember(jqsProg, m.id).filter((r) => r.complete_date || r.certifier_initials).length
      const formalDone = byMember(formalProg, m.id).filter((r) => r.complete_date).length
      let overdue = 0, dueSoon = 0
      for (const r of byMember(r1098Prog, m.id)) {
        recurring.push({ memberStatus: m.status, isRat: false, dueDate: r.next_due as string, completedDate: r.last_completed as string })
        const s = dueStatus({ dueDate: r.next_due as string, completedDate: r.last_completed as string })
        if (s === 'overdue') overdue++; else if (s === 'due_soon') dueSoon++
      }
      if (ratApplies(m.status)) for (const r of byMember(ratProg, m.id)) {
        recurring.push({ memberStatus: m.status, isRat: true, dueDate: r.due as string, completedDate: r.completed as string })
        const s = dueStatus({ dueDate: r.due as string, completedDate: r.completed as string })
        if (s === 'overdue') overdue++; else if (s === 'due_soon') dueSoon++
      }
      return buildMemberRollup({ memberId: m.id, name: m.full_name, grade: m.grade, status: m.status, jqsRequired, jqsDone, formalRequired, formalDone, overdueCount: overdue, dueSoonCount: dueSoon, lastUpdated: m.updated_at })
    })
    setRollups(built)
    setKpis(buildUnitKpis(mem, recurring))
    setLoading(false)
  }, [installationId])

  useEffect(() => { load() }, [load])

  const nameOf = useMemo(() => new Map(members.map((m) => [m.id, m.full_name])), [members])
  const statusOf = useMemo(() => new Map(members.map((m) => [m.id, m.status])), [members])

  // ── derived: overdue / due-soon items across the unit ──
  const dueItems = useMemo<DueItem[]>(() => {
    const out: DueItem[] = []
    const today = new Date()
    for (const r of data.r1098Prog ?? []) {
      const s = dueStatus({ dueDate: r.next_due as string, completedDate: r.last_completed as string }, today)
      if (s !== 'overdue' && s !== 'due_soon') continue
      const due = parseDate(r.next_due as string)
      out.push({ memberId: String(r.member_id), memberName: nameOf.get(String(r.member_id)) ?? '—', due: (r.next_due as string)?.slice(0, 10) ?? '', delta: due ? daysBetween(today, due) : 0, task: '1098 task', source: 'DAF 1098', status: s })
    }
    for (const r of data.ratProg ?? []) {
      if (!ratApplies(statusOf.get(String(r.member_id)) ?? 'Active')) continue
      const s = dueStatus({ dueDate: r.due as string, completedDate: r.completed as string }, today)
      if (s !== 'overdue' && s !== 'due_soon') continue
      const due = parseDate(r.due as string)
      out.push({ memberId: String(r.member_id), memberName: nameOf.get(String(r.member_id)) ?? '—', due: (r.due as string)?.slice(0, 10) ?? '', delta: due ? daysBetween(today, due) : 0, task: 'RAT course', source: 'RAT', status: s })
    }
    return out.sort((a, b) => a.due.localeCompare(b.due))
  }, [data, nameOf, statusOf])

  // ── derived: 797 activity (date-filtered) ──
  const activity = useMemo(() => {
    return (data.items797 ?? [])
      .map((r) => ({ id: String(r.id), memberId: String(r.member_id), memberName: nameOf.get(String(r.member_id)) ?? '—', task: String(r.task ?? ''), trainer: (r.trainer_initials as string) ?? '', date: (r.complete_date as string) || (r.created_at as string) || '' }))
      .filter((a) => inRange(a.date, range))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [data, nameOf, range])

  // ── derived: recurring compliance per task ──
  const compliance = useMemo(() => {
    const build = (catalog: Row[], prog: Row[], dueField: string, doneField: string, ratOnly: boolean) =>
      catalog.map((c) => {
        const rows = prog.filter((p) => p.catalog_id === c.id)
        const applicable = members.filter((m) => !ratOnly || ratApplies(m.status))
        const items = applicable.map((m) => {
          const p = rows.find((r) => r.member_id === m.id)
          return { dueDate: p?.[dueField] as string | undefined, completedDate: p?.[doneField] as string | undefined }
        })
        return { name: String(c.task ?? c.course ?? ''), freq: String(c.frequency ?? ''), ...complianceCounts(items, applicable.length) }
      })
    return {
      r1098: build(data.r1098Cat ?? [], data.r1098Prog ?? [], 'next_due', 'last_completed', false),
      rat: build(data.ratCat ?? [], data.ratProg ?? [], 'due', 'completed', true),
    }
  }, [data, members])

  const exportRosterPdf = () => {
    const { doc, filename } = generateAmtrRosterPdf(rollups, kpis, baseInfo)
    doc.save(filename); toast.success('Roster PDF exported')
  }

  if (loading) return <div style={{ padding: 24 }}><LoadingState message="Aggregating unit data…" /></div>

  const kpiCards = [
    { label: 'Members', value: kpis.members },
    { label: 'Required Tasks', value: kpis.requiredTasks },
    { label: 'Complete', value: kpis.complete, color: 'var(--color-success)' },
    { label: 'Due Soon', value: kpis.dueSoon, color: 'var(--color-warning)' },
    { label: 'Overdue', value: kpis.overdue, color: 'var(--color-danger)' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}><Btn variant="ghost" onClick={() => router.push('/amtr')}><ArrowLeft size={15} /> Roster</Btn></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Unit Training Reports</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <DateRangeBar value={range} onChange={setRange} />
          {canExport && <Btn variant="primary" onClick={exportRosterPdf} disabled={rollups.length === 0}><FileDown size={15} /> Roster PDF</Btn>}
        </div>
      </div>

      {/* sub-tab nav */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, marginBottom: 16, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)' }}>
        {SUBTABS.map(([k, label]) => (
          <button key={k} onClick={() => setSub(k)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: sub === k ? 700 : 600, background: sub === k ? 'var(--color-accent)' : 'transparent', color: sub === k ? '#fff' : 'var(--color-text-3)' }}>{label}</button>
        ))}
      </div>

      {members.length === 0 ? <EmptyState message="No members to report on yet." /> : (
        <>
          {sub === 'overview' && <Overview kpiCards={kpiCards} dueItems={dueItems} rollups={rollups} compliance={compliance} activity={activity} onMember={(id) => router.push(`/amtr/${id}`)} onGo={setSub} />}
          {sub === 'rollup' && <RollupTable rollups={rollups} onMember={(id) => router.push(`/amtr/${id}`)} />}
          {sub === 'overdue' && <OverdueTable items={dueItems} onMember={(id) => router.push(`/amtr/${id}`)} />}
          {sub === 'recurring' && <RecurringTables compliance={compliance} />}
          {sub === 'formal' && <FormalTable members={members} data={data} />}
          {sub === 'activity' && <ActivityTable activity={activity} onMember={(id) => router.push(`/amtr/${id}`)} />}
          {sub === 'quals' && <QualsMatrix members={members} data={data} />}
          {sub === 'print' && <MemberPrint members={members} rollups={rollups} dueItems={dueItems} baseInfo={baseInfo} canExport={canExport} />}
        </>
      )}
    </div>
  )
}

// ── KPI strip ──
function Kpis({ cards }: { cards: { label: string; value: number; color?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
      {cards.map((k) => (
        <div key={k.label} className="card" style={{ padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: k.color ?? 'var(--color-text-1)' }}>{k.value}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{k.label}</div>
        </div>
      ))}
    </div>
  )
}

type Compliance = { r1098: ComplianceRow[]; rat: ComplianceRow[] }
type ComplianceRow = { name: string; freq: string; required: number; complete: number; dueSoon: number; overdue: number; pct: number }
type DueItemT = { memberId: string; memberName: string; due: string; delta: number; task: string; source: string; status: DueStatus }
type Activity = { id: string; memberId: string; memberName: string; task: string; trainer: string; date: string }[]

function Card({ title, link, onLink, children }: { title: string; link?: string; onLink?: () => void; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <strong>{title}</strong>
        {link && <button onClick={onLink} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}>{link} →</button>}
      </div>
      {children}
    </div>
  )
}

function Overview({ kpiCards, dueItems, rollups, compliance, activity, onMember, onGo }: {
  kpiCards: { label: string; value: number; color?: string }[]
  dueItems: DueItemT[]; rollups: MemberRollup[]; compliance: Compliance; activity: Activity
  onMember: (id: string) => void; onGo: (t: string) => void
}) {
  const lowest = [...rollups].sort((a, b) => a.jqsPct - b.jqsPct).filter((r) => r.jqsPct < 100).slice(0, 5)
  const worst = [...compliance.r1098, ...compliance.rat].filter((c) => c.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 5)
  const small: React.CSSProperties = { fontSize: 'var(--fs-sm)' }
  return (
    <>
      <Kpis cards={kpiCards} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card title="Attention Required" link="View all" onLink={() => onGo('overdue')}>
          {dueItems.length === 0 ? <Muted>Everyone current.</Muted> : dueItems.slice(0, 5).map((d, i) => (
            <div key={i} onClick={() => onMember(d.memberId)} style={{ ...small, display: 'flex', gap: 8, padding: '4px 0', cursor: 'pointer', borderTop: i ? '1px solid var(--color-border)' : 'none' }}>
              <span style={{ color: d.status === 'overdue' ? 'var(--color-danger)' : 'var(--color-warning)', width: 70 }}>{d.due}</span>
              <span style={{ flex: 1 }}>{d.memberName}</span><span style={{ color: 'var(--color-text-3)' }}>{d.source}</span>
            </div>
          ))}
        </Card>
        <Card title="Lowest JQS Completion" link="View all" onLink={() => onGo('rollup')}>
          {lowest.length === 0 ? <Muted>All members complete.</Muted> : lowest.map((r, i) => (
            <div key={r.memberId} onClick={() => onMember(r.memberId)} style={{ ...small, display: 'flex', gap: 8, padding: '4px 0', cursor: 'pointer', borderTop: i ? '1px solid var(--color-border)' : 'none' }}>
              <span style={{ flex: 1 }}>{r.name}</span><span style={{ color: 'var(--color-text-3)' }}>{r.jqsPct}%</span>
            </div>
          ))}
        </Card>
        <Card title="1098 & RAT — Worst Compliance" link="View all" onLink={() => onGo('recurring')}>
          {worst.length === 0 ? <Muted>No overdue recurring training.</Muted> : worst.map((c, i) => (
            <div key={i} style={{ ...small, display: 'flex', gap: 8, padding: '4px 0', borderTop: i ? '1px solid var(--color-border)' : 'none' }}>
              <span style={{ flex: 1 }}>{c.name}</span><span style={{ color: 'var(--color-danger)' }}>{c.overdue} over</span>
            </div>
          ))}
        </Card>
        <Card title="DAF 797 — Recent Activity" link="View all" onLink={() => onGo('activity')}>
          {activity.length === 0 ? <Muted>No activity in range.</Muted> : activity.slice(0, 5).map((a, i) => (
            <div key={a.id} onClick={() => onMember(a.memberId)} style={{ ...small, display: 'flex', gap: 8, padding: '4px 0', cursor: 'pointer', borderTop: i ? '1px solid var(--color-border)' : 'none' }}>
              <span style={{ color: 'var(--color-text-3)', width: 78 }}>{a.date?.slice(0, 10)}</span>
              <span style={{ flex: 1 }}>{a.memberName}</span><span style={{ color: 'var(--color-text-3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.task}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>{children}</div>
}

function RollupTable({ rollups, onMember }: { rollups: MemberRollup[]; onMember: (id: string) => void }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={thStyle}>Member</th><th style={thStyle}>Grade</th><th style={thStyle}>Status</th><th style={thStyle}>JQS %</th><th style={thStyle}>Formal %</th><th style={thStyle}>Overdue</th><th style={thStyle}>Due Soon</th><th style={thStyle}>Updated</th></tr></thead>
        <tbody>
          {rollups.map((r) => {
            const bg = r.overdueCount > 0 ? 'color-mix(in srgb, var(--color-danger) 8%, transparent)' : r.dueSoonCount > 0 ? 'color-mix(in srgb, var(--color-warning) 10%, transparent)' : undefined
            return (
              <tr key={r.memberId} onClick={() => onMember(r.memberId)} style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: bg }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td><td style={tdStyle}>{r.grade ?? '—'}</td><td style={tdStyle}>{r.status}</td>
                <td style={tdStyle}>{r.jqsPct}%</td><td style={tdStyle}>{r.formalPct}%</td>
                <td style={{ ...tdStyle, color: r.overdueCount > 0 ? 'var(--color-danger)' : undefined, fontWeight: r.overdueCount > 0 ? 700 : 400 }}>{r.overdueCount}</td>
                <td style={tdStyle}>{r.dueSoonCount}</td><td style={tdStyle}>{r.lastUpdated?.slice(0, 10) ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function OverdueTable({ items, onMember }: { items: DueItemT[]; onMember: (id: string) => void }) {
  if (items.length === 0) return <EmptyState message="No overdue or due-soon items — the unit is current." />
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={thStyle}>Due</th><th style={thStyle}>Δ days</th><th style={thStyle}>Member</th><th style={thStyle}>Source</th><th style={thStyle}>Status</th></tr></thead>
        <tbody>
          {items.map((d, i) => (
            <tr key={i} onClick={() => onMember(d.memberId)} style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: d.status === 'overdue' ? 'color-mix(in srgb, var(--color-danger) 8%, transparent)' : 'color-mix(in srgb, var(--color-warning) 10%, transparent)' }}>
              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{d.due}</td>
              <td style={{ ...tdStyle, color: d.delta < 0 ? 'var(--color-danger)' : 'var(--color-text-2)' }}>{d.delta > 0 ? `+${d.delta}` : d.delta}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{d.memberName}</td><td style={tdStyle}>{d.source}</td>
              <td style={tdStyle}><StatusPill status={d.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ComplianceTable({ title, rows }: { title: string; rows: ComplianceRow[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 16 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={thStyle}>Task</th><th style={thStyle}>Freq</th><th style={thStyle}>Req</th><th style={thStyle}>Complete</th><th style={thStyle}>Due Soon</th><th style={thStyle}>Overdue</th><th style={thStyle}>Compliance</th></tr></thead>
        <tbody>
          {rows.map((c, i) => {
            const tone = c.overdue > 0 ? 'var(--color-danger)' : c.dueSoon > 0 ? 'var(--color-warning)' : 'var(--color-success)'
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={tdStyle}>{c.name}</td><td style={tdStyle}>{c.freq}</td><td style={tdStyle}>{c.required}</td><td style={tdStyle}>{c.complete}</td>
                <td style={tdStyle}>{c.dueSoon || '—'}</td><td style={{ ...tdStyle, color: c.overdue ? 'var(--color-danger)' : undefined }}>{c.overdue || '—'}</td>
                <td style={tdStyle}><Bar pct={c.pct} color={tone} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 90, height: 8, borderRadius: 4, background: 'var(--color-bg-inset)', overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color }} />
      </span>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{pct}%</span>
    </span>
  )
}

function RecurringTables({ compliance }: { compliance: Compliance }) {
  return (
    <>
      <ComplianceTable title="DAF Form 1098 — Recurring Training" rows={compliance.r1098} />
      <ComplianceTable title="Ready Airman Training" rows={compliance.rat} />
    </>
  )
}

function FormalTable({ members, data }: { members: AmtrMember[]; data: Record<string, Row[]> }) {
  const cat = data.formalCat ?? []; const prog = data.formalProg ?? []
  const sections = ['haf', 'initial', 'continuation'] as const
  const counts = (sec: string) => cat.filter((c) => c.section === sec).length
  const frac = (memberId: string, sec: string) => {
    const ids = new Set(cat.filter((c) => c.section === sec).map((c) => String(c.id)))
    const done = prog.filter((p) => p.member_id === memberId && ids.has(String(p.catalog_id)) && p.complete_date).length
    return { done, total: counts(sec) }
  }
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={thStyle}>Member</th><th style={thStyle}>HAF</th><th style={thStyle}>Initial</th><th style={thStyle}>Continuation</th><th style={thStyle}>Overall</th></tr></thead>
        <tbody>
          {members.map((m) => {
            const f = sections.map((s) => frac(m.id, s))
            const done = f.reduce((a, b) => a + b.done, 0), total = f.reduce((a, b) => a + b.total, 0)
            const pct = total ? Math.round((done / total) * 100) : 0
            return (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{m.full_name}</td>
                {f.map((x, i) => <td key={i} style={tdStyle}>{x.total ? `${x.done}/${x.total}` : '—'}</td>)}
                <td style={tdStyle}><Bar pct={pct} color={pct === 100 ? 'var(--color-success)' : 'var(--color-accent)'} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ActivityTable({ activity, onMember }: { activity: Activity; onMember: (id: string) => void }) {
  if (activity.length === 0) return <EmptyState message="No 797 activity in the selected date range." />
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={thStyle}>Date</th><th style={thStyle}>Member</th><th style={thStyle}>Task</th><th style={thStyle}>Trainer</th></tr></thead>
        <tbody>
          {activity.map((a) => (
            <tr key={a.id} onClick={() => onMember(a.memberId)} style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}>
              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{a.date?.slice(0, 10) || '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{a.memberName}</td><td style={tdStyle}>{a.task}</td><td style={tdStyle}>{a.trainer || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function QualsMatrix({ members, data }: { members: AmtrMember[]; data: Record<string, Row[]> }) {
  const quals = data.quals ?? []; const qtps = data.qtps ?? []
  const qtpNames = Array.from(new Set(qtps.map((q) => String(q.name)))).filter(Boolean)
  const qualNames = Array.from(new Set(quals.map((q) => String(q.name)))).filter(Boolean)
  const cols = [...qtpNames, ...qualNames]
  const filled = (memberId: string, col: string) => {
    const q = qtps.find((x) => x.member_id === memberId && x.name === col)
    if (q) return !!q.complete_date
    const v = quals.find((x) => x.member_id === memberId && x.name === col)
    return v?.value === 'Yes'
  }
  if (cols.length === 0) return <EmptyState message="No qualifications recorded yet." />
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={thStyle}>Member</th>{cols.map((c) => <th key={c} style={{ ...thStyle, textAlign: 'center' }}>{c}</th>)}</tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{m.full_name}</td>
              {cols.map((c) => <td key={c} style={{ ...tdStyle, textAlign: 'center', color: filled(m.id, c) ? 'var(--color-success)' : 'var(--color-text-3)' }}>{filled(m.id, c) ? '●' : '○'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MemberPrint({ members, rollups, dueItems, baseInfo, canExport }: {
  members: AmtrMember[]; rollups: MemberRollup[]; dueItems: DueItemT[]
  baseInfo: { baseName?: string | null; baseIcao?: string | null }; canExport: boolean
}) {
  const [sel, setSel] = useState<string>(members[0]?.id ?? '')
  const member = members.find((m) => m.id === sel)
  const rollup = rollups.find((r) => r.memberId === sel)
  const outstanding = dueItems.filter((d) => d.memberId === sel).map((d) => ({ due: d.due, task: d.task, source: d.source, status: d.status }))
  const print = () => {
    if (!member || !rollup) return
    const { doc, filename } = generateAmtrMemberPrintPdf(member, rollup, outstanding, baseInfo)
    doc.save(filename); toast.success('Member summary exported')
  }
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="input-dark" style={{ maxWidth: 280 }} value={sel} onChange={(e) => setSel(e.target.value)}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        {canExport && <Btn variant="primary" onClick={print} disabled={!member}><FileDown size={15} /> Print to PDF</Btn>}
      </div>
      {member && rollup && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <Stat label="JQS-CFETP" value={`${rollup.jqsDone}/${rollup.jqsRequired} (${rollup.jqsPct}%)`} />
            <Stat label="Formal Training" value={`${rollup.formalDone}/${rollup.formalRequired} (${rollup.formalPct}%)`} />
            <Stat label="Overdue" value={String(rollup.overdueCount)} color={rollup.overdueCount ? 'var(--color-danger)' : undefined} />
            <Stat label="Due Soon" value={String(rollup.dueSoonCount)} color={rollup.dueSoonCount ? 'var(--color-warning)' : undefined} />
          </div>
          <strong style={{ fontSize: 'var(--fs-sm)' }}>Outstanding Items</strong>
          {outstanding.length === 0 ? <Muted>None — member is current.</Muted> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
              <thead><tr><th style={thStyle}>Due</th><th style={thStyle}>Source</th><th style={thStyle}>Status</th></tr></thead>
              <tbody>{outstanding.map((o, i) => <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}><td style={tdStyle}>{o.due}</td><td style={tdStyle}>{o.source}</td><td style={tdStyle}><StatusPill status={o.status} /></td></tr>)}</tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card" style={{ padding: 12, textAlign: 'center', background: 'var(--color-bg-inset)' }}>
      <div style={{ fontWeight: 700, color: color ?? 'var(--color-text-1)' }}>{value}</div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{label}</div>
    </div>
  )
}
