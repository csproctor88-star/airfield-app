'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, fetchAmtrByBase } from '@/lib/supabase/amtr'
import { buildUnitKpis, type UnitKpis } from '@/lib/amtr/rollup'

type Prog1098 = { member_id: string; next_due: string | null; last_completed: string | null }
type ProgRat = { member_id: string; due: string | null; completed: string | null }

function Tile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: color ?? 'var(--color-text-1)' }}>{value}</div>
    </div>
  )
}

export function AmtrKpisWidget() {
  const { installationId } = useInstallation()
  const [kpis, setKpis] = useState<UnitKpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Prog1098>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<ProgRat>('amtr_rat_progress', installationId, 'member_id'),
    ])
      .then(([members, p1098, pRat]) => {
        const statusOf = new Map(members.map(m => [m.id, m.status]))
        const recurring: { memberStatus: string; isRat: boolean; dueDate?: string | null; completedDate?: string | null }[] = []
        for (const r of p1098) recurring.push({ memberStatus: statusOf.get(r.member_id) ?? 'Active', isRat: false, dueDate: r.next_due, completedDate: r.last_completed })
        for (const r of pRat) recurring.push({ memberStatus: statusOf.get(r.member_id) ?? 'Active', isRat: true, dueDate: r.due, completedDate: r.completed })
        setKpis(buildUnitKpis(members, recurring))
      })
      .catch(() => { /* fetch helpers already return [] on Supabase errors; clear the spinner on any unexpected throw */ })
      .finally(() => setLoading(false))
  }, [installationId])

  const k = kpis ?? { members: 0, requiredTasks: 0, complete: 0, dueSoon: 0, overdue: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end', flex: 1 }}>
        <Tile label="Members" value={loading ? '…' : k.members} />
        <Tile label="Required" value={loading ? '…' : k.requiredTasks} />
        <Tile label="Complete" value={loading ? '…' : k.complete} color={k.complete > 0 ? 'var(--color-success)' : undefined} />
        <Tile label="Due Soon" value={loading ? '…' : k.dueSoon} color={k.dueSoon > 0 ? 'var(--color-warning)' : undefined} />
        <Tile label="Overdue" value={loading ? '…' : k.overdue} color={k.overdue > 0 ? 'var(--color-danger)' : undefined} />
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/amtr" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>Open AMTR →</Link>
      </div>
    </div>
  )
}
