'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { fetchAmtrByBase, fetchAmtrByMember, type AmtrMember } from '@/lib/supabase/amtr'
import { createClient } from '@/lib/supabase/client'
import { fetchAmtrInspectionsByMember, deleteAmtrInspection, type AmtrInspection } from '@/lib/supabase/amtr-inspections'
import { usePermissions, PERM } from '@/lib/permissions'
import { dueStatus, ratApplies } from '@/lib/amtr/status'
import { pct } from '@/lib/amtr/rollup'
import { NotificationCenter } from '@/components/amtr/notification-center'
import { ClipboardCheck, Trash2 } from 'lucide-react'

type Row = Record<string, unknown>

export function MemberOverview({ installationId, member }: { installationId: string; member: AmtrMember }) {
  const memberId = member.id
  const { has } = usePermissions()
  const canDelete = has(PERM.AMTR_DELETE)
  const [stats, setStats] = useState<{
    jqsPct: number; jqsDone: number; jqsReq: number
    formalPct: number; formalDone: number; formalReq: number
    complete: number; dueSoon: number; overdue: number
  } | null>(null)
  const [inspections, setInspections] = useState<AmtrInspection[]>([])
  // The notification center shows the CURRENT user's notifications, so only
  // surface it on the viewer's own record — not when looking at someone else's.
  const [isOwnRecord, setIsOwnRecord] = useState(false)
  useEffect(() => {
    let active = true
    void (async () => {
      const supabase = createClient()
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      if (active) setIsOwnRecord(!!session?.user && !!member.user_id && session.user.id === member.user_id)
    })()
    return () => { active = false }
  }, [member.user_id])

  const load = useCallback(async () => {
    const currentYear = String(new Date().getUTCFullYear())
    setInspections(await fetchAmtrInspectionsByMember(memberId))
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

  const removeInspection = async (e: React.MouseEvent, i: AmtrInspection) => {
    e.stopPropagation()
    if (!window.confirm(`Delete the ${i.status === 'completed' ? 'completed' : 'draft'} inspection from ${i.inspection_date}? This cannot be undone.`)) return
    const { error } = await deleteAmtrInspection(i.id)
    if (error) { toast.error(error); return }
    toast.success('Inspection deleted')
    load()
  }

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
      {isOwnRecord && <NotificationCenter />}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <ClipboardCheck size={16} /> Record Inspections
          <button onClick={() => window.open(`/amtr/${memberId}/inspect`, '_blank')}
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--color-border-mid)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }}>
            New / open inspection ↗
          </button>
        </div>
        {inspections.length === 0 ? (
          <div style={{ padding: '10px 16px', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No inspections recorded yet.</div>
        ) : inspections.slice(0, 6).map((i) => (
          <div key={i.id} onClick={() => window.open(`/amtr/${memberId}/inspect`, '_blank')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
            <span style={{ width: 90 }}>{i.inspection_date}</span>
            <span style={{ color: i.status === 'completed' ? 'var(--color-success)' : 'var(--color-warning)' }}>{i.status === 'completed' ? 'Completed' : 'Draft'}</span>
            <span style={{ marginLeft: 'auto', color: i.gap_count > 0 ? 'var(--color-danger)' : 'var(--color-text-3)' }}>{i.gap_count} gap{i.gap_count === 1 ? '' : 's'}</span>
            {canDelete && (
              <button onClick={(e) => removeInspection(e, i)} title="Delete inspection"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
