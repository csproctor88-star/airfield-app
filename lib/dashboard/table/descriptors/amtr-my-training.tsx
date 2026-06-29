'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { fetchAmtrMembers, fetchAmtrByBase } from '@/lib/supabase/amtr'
import {
  buildDueItemRows,
  type DueItemRow, type Prog1098Row, type ProgRatRow, type Catalog1098Row, type CatalogRatRow,
} from '@/lib/amtr/report-rows'
import type { TableWidgetDescriptor, ColumnDef } from '@/lib/dashboard/table/types'

// ── Status badge — matches the danger/warning tone the unit widgets use ──
function statusBadge(v: unknown): React.ReactNode {
  const row = v as DueItemRow
  if (row.status === 'overdue') {
    return <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Overdue</span>
  }
  return <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Due soon</span>
}

// My outstanding training: the signed-in user's own overdue / due-soon 1098 +
// RAT items. Self-scoped via auth.getUser(); empty if the user has no member
// record on this base.
function useRows(): { rows: DueItemRow[]; loading: boolean } {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<DueItemRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const supabase = createClient()
      const userId = supabase
        ? (await supabase.auth.getUser()).data.user?.id ?? null
        : null
      const [members, p1098, pRat, cat1098, catRat] = await Promise.all([
        fetchAmtrMembers(installationId),
        fetchAmtrByBase<Prog1098Row>('amtr_1098_progress', installationId, 'member_id'),
        fetchAmtrByBase<ProgRatRow>('amtr_rat_progress', installationId, 'member_id'),
        fetchAmtrByBase<Catalog1098Row>('amtr_1098_catalog', installationId),
        fetchAmtrByBase<CatalogRatRow>('amtr_rat_catalog', installationId),
      ])
      if (cancelled) return
      const myMember = userId ? members.find(m => m.user_id === userId) : undefined
      if (!myMember) { setRows([]); return }
      const mine = buildDueItemRows(members, p1098, pRat, cat1098, catRat)
        .filter(r => r.memberId === myMember.id && (r.status === 'overdue' || r.status === 'due_soon'))
        .sort((a, b) =>
          (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0) ||
          a.itemName.localeCompare(b.itemName)
        ) // most overdue first, then by item
      setRows(mine)
    })()
      .catch(() => { /* fetch helpers already return [] on Supabase errors; clear the spinner on any unexpected throw */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [installationId])

  return { rows, loading }
}

const columns: ColumnDef<DueItemRow>[] = [
  { key: 'itemName', label: 'Item', accessor: r => r.itemName, defaultVisible: true },
  { key: 'type', label: 'Type', accessor: r => r.type, defaultVisible: true },
  { key: 'dueDate', label: 'Due', accessor: r => r.dueDate ?? '—', defaultVisible: true, mono: true },
  { key: 'status', label: 'Status', accessor: r => r, format: statusBadge, defaultVisible: true },
  { key: 'daysUntilDue', label: 'Days', accessor: r => r.daysUntilDue ?? 0, defaultVisible: true, mono: true, align: 'right' },
]

export const amtrMyTrainingDescriptor: TableWidgetDescriptor<DueItemRow> = {
  columns,
  filters: [],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => [
    { count: rows.length, label: 'outstanding', tone: rows.length ? 'warning' : 'muted' },
  ],
  footerHref: '/amtr',
  useRows,
}
