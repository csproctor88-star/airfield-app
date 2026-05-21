'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchAmtrByBase, fetchAmtrByMember, type AmtrMember } from '@/lib/supabase/amtr'
import { dueStatus, ratApplies } from '@/lib/amtr/status'
import { pct } from '@/lib/amtr/rollup'
import { NotificationCenter } from '@/components/amtr/notification-center'

type Row = Record<string, unknown>

export function MemberOverview({ installationId, member }: { installationId: string; member: AmtrMember }) {
  const memberId = member.id
  const [stats, setStats] = useState<{
    jqsPct: number; jqsDone: number; jqsReq: number
    formalPct: number; formalDone: number; formalReq: number
    complete: number; dueSoon: number; overdue: number
  } | null>(null)

  const load = useCallback(async () => {
    const currentYear = String(new Date().getUTCFullYear())
    const [jqsCat, jqsProg, formalCat, formalProg, r1098Prog, ratProg] = await Promise.all([
      fetchAmtrByBase<Row>('amtr_jqs_catalog', installationId),
      fetchAmtrByMember<Row>('amtr_jqs_progress', memberId),
      fetchAmtrByBase<Row>('amtr_formal_catalog', installationId),
      fetchAmtrByMember<Row>('amtr_formal_progress', memberId),
      fetchAmtrByMember<Row>('amtr_1098_progress', memberId),
      fetchAmtrByMember<Row>('amtr_rat_progress', memberId),
    ])
    const jqsReq = jqsCat.filter((c) => c.kind === 'item').length
    const jqsDone = jqsProg.filter((r) => r.complete_date || r.certifier_initials).length
    const formalReq = formalCat.length
    const formalDone = formalProg.filter((r) => r.complete_date).length

    let complete = 0, dueSoon = 0, overdue = 0
    const tally = (s: ReturnType<typeof dueStatus>) => {
      if (s === 'complete') complete++; else if (s === 'due_soon') dueSoon++; else if (s === 'overdue') overdue++
    }
    for (const r of r1098Prog.filter((r) => String(r.year_label) === currentYear)) {
      tally(dueStatus({ dueDate: r.next_due as string, completedDate: r.last_completed as string }))
    }
    if (ratApplies(member.status)) for (const r of ratProg) {
      tally(dueStatus({ dueDate: r.due as string, completedDate: r.completed as string }))
    }
    setStats({ jqsPct: pct(jqsDone, jqsReq), jqsDone, jqsReq, formalPct: pct(formalDone, formalReq), formalDone, formalReq, complete, dueSoon, overdue })
  }, [installationId, memberId, member.status])

  useEffect(() => { load() }, [load])

  const cards = stats ? [
    { label: 'JQS-CFETP', value: `${stats.jqsPct}%`, sub: `${stats.jqsDone}/${stats.jqsReq} tasks`, color: 'var(--color-accent)' },
    { label: 'Formal Training', value: `${stats.formalPct}%`, sub: `${stats.formalDone}/${stats.formalReq} courses`, color: 'var(--color-accent)' },
    { label: 'Recurring Current', value: stats.complete, sub: '1098 + RAT', color: 'var(--color-success)' },
    { label: 'Due Soon', value: stats.dueSoon, sub: 'within 30 days', color: 'var(--color-warning)' },
    { label: 'Overdue', value: stats.overdue, sub: 'past due', color: 'var(--color-danger)' },
  ] : []

  return (
    <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Training Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {cards.map((c) => (
            <div key={c.label} className="card" style={{ padding: '14px 16px' }}>
              <div className="section-label" style={{ marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <NotificationCenter />
    </div>
  )
}
