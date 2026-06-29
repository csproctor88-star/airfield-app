import { useEffect, useMemo, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import {
  fetchPprColumns, fetchPprEntries, isActivePpr, formatPprColumnValue,
  type PprColumn, type PprEntry,
} from '@/lib/supabase/ppr'
import type { ColumnDef, TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const PPR_STATUS_LABELS: Record<string, string> = {
  approved:               'Approved',
  denied:                 'Denied',
  canceled:               'Canceled',
  pending_amops_triage:   'Pending Triage',
  pending_coordination:   'Pending Coordination',
  pending_amops_approval: 'Pending Approval',
}

const SYSTEM_COLUMNS: ColumnDef<PprEntry>[] = [
  { key: 'ppr_number', label: 'PPR #', accessor: r => r.ppr_number, mono: true, defaultVisible: true },
  { key: 'arrival_date', label: 'Arrival', accessor: r => r.arrival_date, defaultVisible: true },
  { key: 'status', label: 'Status', accessor: r => PPR_STATUS_LABELS[r.status] ?? r.status, defaultVisible: true },
  { key: 'requester_name', label: 'Requester', accessor: r => r.requester_name ?? '—', defaultVisible: true },
  { key: 'requester_email', label: 'Email', accessor: r => r.requester_email ?? '—' },
  { key: 'requester_phone', label: 'Phone', accessor: r => r.requester_phone ?? '—', mono: true },
  { key: 'departed_at', label: 'Departed', accessor: r => r.departed_at ?? '—' },
  { key: 'notes', label: 'Notes', accessor: r => r.notes ?? '—' },
]

/** Dynamic catalog: system columns + this base's show_on_log PPR columns. */
function usePprColumns(): ColumnDef<PprEntry>[] {
  const { installationId, currentInstallation } = useInstallation()
  const baseTimezone = (currentInstallation as { timezone?: string | null } | null)?.timezone || 'UTC'
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
      accessor: r => formatPprColumnValue(c, r.column_values?.[c.id], { tz: baseTimezone }) || '—',
    })),
  ], [baseCols, baseTimezone])
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
  // Row click deep-links to the PPR Log and auto-opens the full detail dialog.
  row: { mode: 'deeplink', href: r => `/ppr?detail=${r.id}` },
  footerHref: '/ppr',
  useRows,
}
