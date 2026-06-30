'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, fetchAmtrByBase, type AmtrMember } from '@/lib/supabase/amtr'
import { dueStatus, ratApplies } from '@/lib/amtr/status'
import { pct } from '@/lib/amtr/rollup'
import { buildProgressRows, type ProgressRow, type ProgressInput } from '@/lib/amtr/report-rows'
import type { TableWidgetDescriptor, ColumnDef } from '@/lib/dashboard/table/types'

type Row = Record<string, unknown>

// ── FQ badge ─────────────────────────────────────────────────
// Fully qualified = JQS 100% AND Formal 100%. Green check when FQ,
// muted ✗ otherwise.
function fqBadge(v: unknown): React.ReactNode {
  const row = v as ProgressRow
  if (row.fq) {
    return (
      <span style={{ color: 'var(--color-success)', fontWeight: 700 }} title="Fully qualified = JQS 100% and Formal 100%">✓</span>
    )
  }
  return (
    <span style={{ color: 'var(--color-text-3)' }} title="Not fully qualified (JQS <100% or Formal <100%)">✗</span>
  )
}

// Per-member training progress — FQ status plus JQS %, 1098 %, 797 %, and
// Formal % — computed exactly as the AMTR Unit Training Reports page
// (app/(app)/amtr/reports). Unit-scoped to the active installation.
function useRows(): { rows: ProgressRow[]; loading: boolean } {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ProgressRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Row>('amtr_jqs_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_jqs_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_formal_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_formal_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_rat_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_797', installationId, 'member_id'),
    ])
      .then(([mem, jqsCat, jqsProg, formalCat, formalProg, r1098Prog, ratProg, items797]) => {
        if (cancelled) return
        const jqsRequired = jqsCat.filter(c => c.kind === 'item').length
        const formalRequired = formalCat.length
        const byMember = (src: Row[], id: string) => src.filter(r => r.member_id === id)

        const inputs: ProgressInput[] = (mem as AmtrMember[]).map(m => {
          // JQS %
          const jqsDone = byMember(jqsProg, m.id).filter(r => r.complete_date || r.certifier_initials).length
          const jqsPct = pct(jqsDone, jqsRequired)

          // Formal %
          const formalDone = byMember(formalProg, m.id).filter(r => r.complete_date).length
          const formalPct = pct(formalDone, formalRequired)

          // 1098 % — recurring items (1098 + applicable RAT). "Done" = not overdue.
          const recurring: { dueDate: string | null; completedDate: string | null }[] = byMember(r1098Prog, m.id)
            .map(r => ({ dueDate: r.next_due as string | null, completedDate: r.last_completed as string | null }))
          if (ratApplies(m.status)) {
            for (const r of byMember(ratProg, m.id)) {
              recurring.push({ dueDate: r.due as string | null, completedDate: r.completed as string | null })
            }
          }
          const total1098 = recurring.length
          const done1098 = recurring.filter(it => dueStatus(it) !== 'overdue').length
          const p1098Pct = total1098 ? Math.round((done1098 / total1098) * 100) : null
          const overdue = recurring.filter(it => dueStatus(it) === 'overdue').length

          // 797 % — per-member rows; "done" = complete_date present.
          const rows797 = byMember(items797, m.id)
          const total797 = rows797.length
          const done797 = rows797.filter(r => r.complete_date).length
          const p797Pct = total797 ? Math.round((done797 / total797) * 100) : null

          return {
            memberId: m.id, memberName: m.full_name, grade: m.grade,
            jqsPct, formalPct, overdue, p1098Pct, p797Pct,
          }
        })

        setRows(buildProgressRows(inputs))
      })
      .catch(() => { /* fetch helpers already return [] on Supabase errors; clear the spinner on any unexpected throw */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [installationId])

  return { rows, loading }
}

const columns: ColumnDef<ProgressRow>[] = [
  { key: 'memberName', label: 'Member', accessor: r => r.memberName, defaultVisible: true },
  { key: 'fq', label: 'FQ', accessor: r => r, format: fqBadge, defaultVisible: true, align: 'center' },
  { key: 'jqsPct', label: 'JQS %', accessor: r => r.jqsPct, defaultVisible: true, mono: true, align: 'right' },
  { key: 'p1098Pct', label: '1098 %', accessor: r => r.p1098Pct ?? '—', defaultVisible: true, mono: true, align: 'right' },
  { key: 'p797Pct', label: '797 %', accessor: r => r.p797Pct ?? '—', defaultVisible: true, mono: true, align: 'right' },
  { key: 'formalPct', label: 'Formal %', accessor: r => r.formalPct, defaultVisible: true, mono: true, align: 'right' },
]

export const amtrProgressDescriptor: TableWidgetDescriptor<ProgressRow> = {
  columns,
  filters: [],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => [
    { count: rows.length, label: 'members' },
  ],
  footerHref: '/amtr/reports',
  useRows,
}
