'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, fetchAmtrByBase, type AmtrMember } from '@/lib/supabase/amtr'
import { dueStatus, ratApplies } from '@/lib/amtr/status'
import { buildMemberRollup, type MemberRollup } from '@/lib/amtr/rollup'
import { buildProgressRows, type ProgressRow } from '@/lib/amtr/report-rows'
import type { TableWidgetDescriptor, ColumnDef } from '@/lib/dashboard/table/types'

type Row = Record<string, unknown>

// Per-member training progress — JQS %, Formal %, and overdue count — computed
// exactly as the AMTR Unit Training Reports page (app/(app)/amtr/reports). Unit-
// scoped to the active installation.
function useRows(): { rows: ProgressRow[]; loading: boolean } {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ProgressRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
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
    ])
      .then(([mem, jqsCat, jqsProg, formalCat, formalProg, r1098Prog, ratProg]) => {
        if (cancelled) return
        const jqsRequired = jqsCat.filter(c => c.kind === 'item').length
        const formalRequired = formalCat.length
        const byMember = (src: Row[], id: string) => src.filter(r => r.member_id === id)
        const rollups: MemberRollup[] = (mem as AmtrMember[]).map(m => {
          const jqsDone = byMember(jqsProg, m.id).filter(r => r.complete_date || r.certifier_initials).length
          const formalDone = byMember(formalProg, m.id).filter(r => r.complete_date).length
          let overdue = 0, dueSoon = 0
          for (const r of byMember(r1098Prog, m.id)) {
            const s = dueStatus({ dueDate: r.next_due as string, completedDate: r.last_completed as string })
            if (s === 'overdue') overdue++; else if (s === 'due_soon') dueSoon++
          }
          if (ratApplies(m.status)) for (const r of byMember(ratProg, m.id)) {
            const s = dueStatus({ dueDate: r.due as string, completedDate: r.completed as string })
            if (s === 'overdue') overdue++; else if (s === 'due_soon') dueSoon++
          }
          return buildMemberRollup({
            memberId: m.id, name: m.full_name, grade: m.grade, status: m.status,
            jqsRequired, jqsDone, formalRequired, formalDone,
            overdueCount: overdue, dueSoonCount: dueSoon, lastUpdated: m.updated_at,
          })
        })
        setRows(buildProgressRows(rollups))
      })
      .catch(() => { /* fetch helpers already return [] on Supabase errors; clear the spinner on any unexpected throw */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [installationId])

  return { rows, loading }
}

const columns: ColumnDef<ProgressRow>[] = [
  { key: 'memberName', label: 'Member', accessor: r => r.memberName, defaultVisible: true },
  { key: 'grade', label: 'Grade', accessor: r => r.grade ?? '—', defaultVisible: true },
  { key: 'jqsPct', label: 'JQS %', accessor: r => r.jqsPct, defaultVisible: true, mono: true, align: 'right' },
  { key: 'formalPct', label: 'Formal %', accessor: r => r.formalPct, defaultVisible: true, mono: true, align: 'right' },
  { key: 'overdue', label: 'Overdue', accessor: r => r.overdue, defaultVisible: true, mono: true, align: 'right' },
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
