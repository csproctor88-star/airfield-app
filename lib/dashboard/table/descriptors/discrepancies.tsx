import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancies, formatReporter, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { DISCREPANCY_TYPES, CURRENT_STATUS_OPTIONS, STATUS_CONFIG } from '@/lib/constants'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

function fmtCurrentStatus(value: unknown): string {
  const v = value as string
  const found = CURRENT_STATUS_OPTIONS.find(o => o.value === v)
  if (found) return found.label
  const sc = STATUS_CONFIG[v as keyof typeof STATUS_CONFIG]
  if (sc) return sc.label
  return v ?? '—'
}

function ageDays(iso: string): string {
  return `${Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)}d`
}
const TYPE_LABEL = new Map(DISCREPANCY_TYPES.map(t => [t.value, t.label]))

function useRows(_config: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchDiscrepancies(installationId).then(all => { setRows(all); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const discrepanciesDescriptor: TableWidgetDescriptor<DiscrepancyRow> = {
  columns: [
    { key: 'display_id', label: 'ID', accessor: r => r.display_id, mono: true },
    { key: 'title', label: 'Title', accessor: r => r.title, defaultVisible: true },
    { key: 'type', label: 'Type', accessor: r => r.type, format: v => TYPE_LABEL.get(v as string) ?? (v as string) },
    { key: 'current_status', label: 'Status', accessor: r => r.current_status ?? r.status, format: v => fmtCurrentStatus(v), defaultVisible: true },
    { key: 'assigned_shop', label: 'Shop', accessor: r => r.assigned_shop ?? '—', defaultVisible: true },
    { key: 'age', label: 'Age', accessor: r => r.created_at, format: v => ageDays(v as string), mono: true, align: 'right', defaultVisible: true },
    { key: 'location_text', label: 'Location', accessor: r => r.location_text },
    { key: 'work_order_number', label: 'WO #', accessor: r => r.work_order_number ?? '—', mono: true },
    { key: 'reporter', label: 'Reporter', accessor: r => formatReporter(r.reporter) },
  ],
  filters: [
    { key: 'type', label: 'Type', kind: 'enum-multi',
      options: DISCREPANCY_TYPES.map(t => ({ value: t.value, label: t.label })),
      predicate: (r, sel) => (sel as string[]).includes(r.type) },
    { key: 'status', label: 'Status', kind: 'status', defaultSelected: ['open'],
      options: [{ value: 'open', label: 'Open' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }],
      predicate: (r, sel) => (sel as string[]).includes(r.status) },
    { key: 'assigned_shop', label: 'Shop', kind: 'enum-multi',
      options: Array.from(new Set(DISCREPANCY_TYPES.map(t => t.defaultShop).filter((s): s is string => !!s)))
        .map(s => ({ value: s, label: s })),
      predicate: (r, sel) => !!r.assigned_shop && (sel as string[]).includes(r.assigned_shop) },
  ],
  row: { mode: 'deeplink', href: r => `/discrepancies/${r.id}` },
  footerHref: '/discrepancies',
  newHref: '/discrepancies/new',
  useRows,
}
