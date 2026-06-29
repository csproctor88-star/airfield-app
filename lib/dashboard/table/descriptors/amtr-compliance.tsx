'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, fetchAmtrByBase, type AmtrMember } from '@/lib/supabase/amtr'
import { ratApplies } from '@/lib/amtr/status'
import { complianceCounts } from '@/lib/amtr/rollup'
import { buildTaskComplianceRows, type TaskComplianceRow } from '@/lib/amtr/report-rows'
import type { TableWidgetDescriptor, ColumnDef } from '@/lib/dashboard/table/types'

type Row = Record<string, unknown>

function currentOf(v: unknown): string {
  const r = v as TaskComplianceRow
  return `${r.current}/${r.total}`
}

// Per-task recurring compliance (1098 + RAT) across the unit, computed exactly
// as the AMTR Unit Training Reports page (app/(app)/amtr/reports). Unit-scoped
// to the active installation.
function useRows(): { rows: TaskComplianceRow[]; loading: boolean } {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<TaskComplianceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Row>('amtr_1098_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<Row>('amtr_rat_catalog', installationId),
      fetchAmtrByBase<Row>('amtr_rat_progress', installationId, 'member_id'),
    ])
      .then(([mem, r1098Cat, r1098Prog, ratCat, ratProg]) => {
        if (cancelled) return
        const members = mem as AmtrMember[]
        const build = (catalog: Row[], prog: Row[], dueField: string, doneField: string, ratOnly: boolean) =>
          catalog.map(c => {
            const progRows = prog.filter(p => p.catalog_id === c.id)
            const applicable = members.filter(m => !ratOnly || ratApplies(m.status))
            const items = applicable.map(m => {
              const p = progRows.find(r => r.member_id === m.id)
              return { dueDate: p?.[dueField] as string | undefined, completedDate: p?.[doneField] as string | undefined }
            })
            return {
              id: String(c.id),
              name: String(c.task ?? c.course ?? ''),
              freq: String(c.frequency ?? ''),
              counts: complianceCounts(items, applicable.length),
            }
          })
        const tasks = [
          ...build(r1098Cat, r1098Prog, 'next_due', 'last_completed', false),
          ...build(ratCat, ratProg, 'due', 'completed', true),
        ]
        setRows(buildTaskComplianceRows(tasks))
      })
      .catch(() => { /* fetch helpers already return [] on Supabase errors; clear the spinner on any unexpected throw */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [installationId])

  return { rows, loading }
}

const columns: ColumnDef<TaskComplianceRow>[] = [
  { key: 'name', label: 'Task', accessor: r => r.name, defaultVisible: true },
  { key: 'freq', label: 'Frequency', accessor: r => r.freq, defaultVisible: true },
  { key: 'current', label: 'Current', accessor: r => r, format: currentOf, defaultVisible: true },
  { key: 'pct', label: '%', accessor: r => r.pct, defaultVisible: true, mono: true, align: 'right' },
]

export const amtrComplianceDescriptor: TableWidgetDescriptor<TaskComplianceRow> = {
  columns,
  filters: [],
  row: { mode: 'none' },
  summary: rows => [
    { count: rows.length, label: 'tasks' },
  ],
  footerHref: '/amtr/reports',
  useRows,
}
