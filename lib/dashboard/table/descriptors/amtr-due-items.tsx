'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, fetchAmtrByBase } from '@/lib/supabase/amtr'
import {
  buildDueItemRows,
  type DueItemRow, type Prog1098Row, type ProgRatRow, type Catalog1098Row, type CatalogRatRow,
} from '@/lib/amtr/report-rows'
import type { TableWidgetDescriptor, ColumnDef, FilterDef } from '@/lib/dashboard/table/types'

// ── Shared fetch: every classified due item for the unit ─────────
function useAllDueItems(): { all: DueItemRow[]; loading: boolean } {
  const { installationId } = useInstallation()
  const [all, setAll] = useState<DueItemRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Prog1098Row>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<ProgRatRow>('amtr_rat_progress', installationId, 'member_id'),
      fetchAmtrByBase<Catalog1098Row>('amtr_1098_catalog', installationId),
      fetchAmtrByBase<CatalogRatRow>('amtr_rat_catalog', installationId),
    ]).then(([members, p1098, pRat, cat1098, catRat]) => {
      setAll(buildDueItemRows(members, p1098, pRat, cat1098, catRat))
      setLoading(false)
    })
  }, [installationId])

  return { all, loading }
}

// ── Shared columns ───────────────────────────────────────────────
const baseColumns: ColumnDef<DueItemRow>[] = [
  { key: 'memberName', label: 'Member', accessor: r => r.memberName, defaultVisible: true },
  { key: 'grade', label: 'Grade', accessor: r => r.grade ?? '—', defaultVisible: true },
  { key: 'itemName', label: 'Item', accessor: r => r.itemName, defaultVisible: true },
  { key: 'type', label: 'Type', accessor: r => r.type, defaultVisible: true },
  { key: 'dueDate', label: 'Due', accessor: r => r.dueDate ?? '—', defaultVisible: true, mono: true },
]

const typeFilter: FilterDef<DueItemRow> = {
  key: 'type',
  label: 'Type',
  kind: 'enum-multi',
  options: [{ value: '1098', label: '1098' }, { value: 'RAT', label: 'RAT' }],
  predicate: (r, sel) => (sel as string[]).includes(r.type),
}

const distinctMembers = (rows: DueItemRow[]) => new Set(rows.map(r => r.memberId)).size

// ── Overdue Training ─────────────────────────────────────────────
function useOverdueRows() {
  const { all, loading } = useAllDueItems()
  const rows = all
    .filter(r => r.status === 'overdue')
    .sort((a, b) =>
      (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0) ||
      a.memberName.localeCompare(b.memberName) ||
      a.itemName.localeCompare(b.itemName)
    ) // most overdue first, then by member, then item
  return { rows, loading }
}

export const amtrOverdueDescriptor: TableWidgetDescriptor<DueItemRow> = {
  columns: [
    ...baseColumns,
    { key: 'daysOverdue', label: 'Days Overdue', accessor: r => (r.daysUntilDue == null ? 0 : Math.abs(r.daysUntilDue)), defaultVisible: true, mono: true, align: 'right' },
  ],
  filters: [typeFilter],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => [
    { count: rows.length, label: 'overdue', tone: 'danger' },
    { count: distinctMembers(rows), label: 'members' },
  ],
  footerHref: '/amtr',
  useRows: useOverdueRows,
}

// ── Due Soon (next 30 days) ──────────────────────────────────────
function useDueSoonRows() {
  const { all, loading } = useAllDueItems()
  const rows = all
    .filter(r => r.status === 'due_soon')
    .sort((a, b) =>
      (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0) ||
      a.memberName.localeCompare(b.memberName) ||
      a.itemName.localeCompare(b.itemName)
    ) // soonest first, then by member, then item
  return { rows, loading }
}

export const amtrDueSoonDescriptor: TableWidgetDescriptor<DueItemRow> = {
  columns: [
    ...baseColumns,
    { key: 'daysLeft', label: 'Days Left', accessor: r => r.daysUntilDue ?? 0, defaultVisible: true, mono: true, align: 'right' },
  ],
  filters: [typeFilter],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => [
    { count: rows.length, label: 'due within 30 days', tone: 'warning' },
    { count: distinctMembers(rows), label: 'members' },
  ],
  footerHref: '/amtr',
  useRows: useDueSoonRows,
}
