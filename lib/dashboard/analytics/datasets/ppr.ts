import type { Dataset } from '@/lib/dashboard/analytics/types'
import { timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import { fetchPprEntries } from '@/lib/supabase/ppr'

export const pprDataset: Dataset = {
  key: 'ppr',
  label: 'PPR Requests',
  permission: 'ppr:view',
  moduleHref: '/ppr',
  timeField: 'arrival_date',
  dimensions: [
    { key: 'status', label: 'Status' },
    { key: 'month', label: 'Month' },
  ],
  measures: [
    { key: 'count', label: 'Count', kind: 'count' },
  ],
  filters: [
    {
      field: 'status',
      label: 'Status',
      options: [
        { value: 'pending_amops_triage', label: 'Pending Triage' },
        { value: 'pending_coordination', label: 'Pending Coordination' },
        { value: 'pending_amops_approval', label: 'Pending Approval' },
        { value: 'approved', label: 'Approved' },
        { value: 'denied', label: 'Denied' },
        { value: 'canceled', label: 'Canceled' },
      ],
    },
  ],
  async fetchRows(baseId, timePreset) {
    const all = await fetchPprEntries(baseId)
    const rows = all as unknown as Record<string, unknown>[]
    const since = timePresetSince(timePreset)
    if (!since) return rows
    // arrival_date is date-only (YYYY-MM-DD); compare first 10 chars of since
    const sinceDate = since.slice(0, 10)
    return rows.filter(
      r => typeof r.arrival_date === 'string' && (r.arrival_date as string) >= sinceDate,
    )
  },
  getDimensionValue(row, dimKey) {
    if (dimKey === 'month') {
      const d = row.arrival_date
      return typeof d === 'string' ? d.slice(0, 7) : '—'   // YYYY-MM
    }
    return String(row[dimKey] ?? '—')
  },
}
