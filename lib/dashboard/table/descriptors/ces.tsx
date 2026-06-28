import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const CES_STATUSES = ['submitted_to_ces', 'awaiting_action_by_ces', 'waiting_for_project', 'work_completed_awaiting_verification']
const CES_SET = new Set(CES_STATUSES)
const CES_LABEL: Record<string, string> = {
  submitted_to_ces: 'Submitted', awaiting_action_by_ces: 'In Work',
  waiting_for_project: 'Project', work_completed_awaiting_verification: 'Verify',
}
const ageDays = (iso: string) => `${Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)}d`

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchDiscrepancies(installationId).then(all => {
      setRows(all.filter(d => d.status === 'open' && CES_SET.has(d.current_status ?? '')))
      setLoading(false)
    })
  }, [installationId])
  return { rows, loading }
}

export const cesDescriptor: TableWidgetDescriptor<DiscrepancyRow> = {
  columns: [
    { key: 'title', label: 'Title', accessor: r => r.title, defaultVisible: true },
    { key: 'current_status', label: 'Status', accessor: r => r.current_status ?? '—',
      format: v => CES_LABEL[v as string] ?? (v as string), defaultVisible: true },
    { key: 'assigned_shop', label: 'Shop', accessor: r => r.assigned_shop ?? '—', defaultVisible: true },
    { key: 'age', label: 'Age', accessor: r => r.created_at, format: v => ageDays(v as string), mono: true, defaultVisible: true },
    { key: 'display_id', label: 'ID', accessor: r => r.display_id, mono: true },
    { key: 'work_order_number', label: 'WO #', accessor: r => r.work_order_number ?? '—', mono: true },
  ],
  filters: [
    { key: 'current_status', label: 'Status', kind: 'status',
      options: CES_STATUSES.map(s => ({ value: s, label: CES_LABEL[s] })),
      predicate: (r, sel) => (sel as string[]).includes(r.current_status ?? '') },
    { key: 'assigned_shop', label: 'Shop', kind: 'text',
      predicate: (r, sel) => (r.assigned_shop ?? '').toLowerCase().includes((sel as string).toLowerCase()) },
  ],
  row: { mode: 'deeplink', href: r => `/discrepancies/${r.id}` },
  footerHref: '/ces',
  useRows,
}
