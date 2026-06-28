import { useEffect, useMemo, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import {
  fetchPprColumns, fetchPprEntries, isActivePpr,
  type PprColumn, type PprEntry,
} from '@/lib/supabase/ppr'
import { departPpr } from '@/lib/dashboard/row-actions'
import { PERM } from '@/lib/permissions'
import type { ColumnDef, TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const SYSTEM_COLUMNS: ColumnDef<PprEntry>[] = [
  { key: 'ppr_number', label: 'PPR #', accessor: r => r.ppr_number, mono: true, defaultVisible: true },
  { key: 'arrival_date', label: 'Arrival', accessor: r => r.arrival_date, defaultVisible: true },
  { key: 'status', label: 'Status', accessor: r => r.status, defaultVisible: true },
  { key: 'requester_name', label: 'Requester', accessor: r => r.requester_name ?? '—', defaultVisible: true },
  { key: 'requester_email', label: 'Email', accessor: r => r.requester_email ?? '—' },
  { key: 'requester_phone', label: 'Phone', accessor: r => r.requester_phone ?? '—', mono: true },
  { key: 'departed_at', label: 'Departed', accessor: r => r.departed_at ?? '—' },
  { key: 'notes', label: 'Notes', accessor: r => r.notes ?? '—' },
]

/** Dynamic catalog: system columns + this base's show_on_log PPR columns. */
function usePprColumns(): ColumnDef<PprEntry>[] {
  const { installationId } = useInstallation()
  const [baseCols, setBaseCols] = useState<PprColumn[]>([])
  useEffect(() => {
    if (!installationId) return
    fetchPprColumns(installationId).then(cols => setBaseCols(cols.filter(c => c.show_on_log)))
  }, [installationId])
  return useMemo(() => [
    ...SYSTEM_COLUMNS,
    ...baseCols.map<ColumnDef<PprEntry>>(c => ({
      key: `col:${c.column_name}`,
      label: c.column_name,
      accessor: r => r.column_values?.[c.column_name] ?? '—',
    })),
  ], [baseCols])
}

function dateRange(scope: string, tz: string): { start?: string; end?: string } {
  const fmt = (d: Date) => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d) }
    catch { return d.toISOString().slice(0, 10) }
  }
  const today = fmt(new Date())
  if (scope === 'all') return {} // no bounds — fetchPprEntries skips undefined args
  if (scope === 'upcoming-7d') {
    const week = new Date(Date.now() + 7 * 86_400_000)
    return { start: today, end: fmt(week) }
  }
  return { start: today, end: today } // today
}

function useRows(config: TableWidgetConfig) {
  const { installationId, currentInstallation } = useInstallation()
  const tz = currentInstallation?.timezone || 'UTC'
  const scope = config.extras?.dateScope ?? 'today'
  const [rows, setRows] = useState<PprEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    const { start, end } = dateRange(scope, tz)
    fetchPprEntries(installationId, start, end).then(data => {
      setRows(data.filter(e => isActivePpr(e.status)))
      setLoading(false)
    })
  }, [installationId, tz, scope])
  return { rows, loading }
}

export const pprDescriptor: TableWidgetDescriptor<PprEntry> = {
  useColumns: usePprColumns,
  filters: [
    { key: 'status', label: 'Status', kind: 'status',
      options: [
        { value: 'approved', label: 'Approved' },
        { value: 'pending_amops_triage', label: 'Triage' },
        { value: 'pending_coordination', label: 'Coordination' },
        { value: 'pending_amops_approval', label: 'Pending' },
        { value: 'denied', label: 'Denied' },
      ],
      predicate: (r, sel) => (sel as string[]).includes(r.status) },
  ],
  extras: [
    { key: 'dateScope', label: 'Date range', default: 'today',
      options: [
        { value: 'today', label: 'Today' },
        { value: 'upcoming-7d', label: 'Next 7 days' },
        { value: 'all', label: 'All' },
      ] },
  ],
  row: {
    mode: 'detail+actions',
    title: r => `PPR ${r.ppr_number}`,
    fields: [
      { label: 'Status', value: r => r.status },
      { label: 'Arrival', value: r => r.arrival_date },
      { label: 'Requester', value: r => r.requester_name ?? '—' },
      { label: 'Email', value: r => r.requester_email ?? '—' },
      { label: 'Phone', value: r => r.requester_phone ?? '—' },
      { label: 'Notes', value: r => r.notes ?? '—', hideWhenEmpty: true },
      { label: 'Departed', value: r => r.departed_at ?? 'Not departed' },
    ],
    actions: [
      { key: 'depart', permission: PERM.PPR_WRITE,
        label: r => r.departed_at ? 'Clear Departure' : 'Mark Departed',
        run: (r, ctx) => departPpr(r.id, !r.departed_at, ctx) },
    ],
  },
  footerHref: '/ppr',
  useRows,
}
