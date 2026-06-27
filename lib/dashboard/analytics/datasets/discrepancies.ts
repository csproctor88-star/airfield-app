import type { Dataset } from '@/lib/dashboard/analytics/types'
import { timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import { fetchDiscrepancies } from '@/lib/supabase/discrepancies'

export const discrepanciesDataset: Dataset = {
  key: 'discrepancies',
  label: 'Discrepancies',
  permission: 'discrepancies:view',
  moduleHref: '/discrepancies',
  timeField: 'created_at',
  dimensions: [
    { key: 'status', label: 'Status' },
    { key: 'assigned_shop', label: 'Assigned Shop' },
    { key: 'month', label: 'Month opened' },
  ],
  measures: [
    { key: 'count', label: 'Count', kind: 'count' },
  ],
  filters: [
    {
      field: 'status',
      label: 'Status',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
  ],
  async fetchRows(baseId, timePreset) {
    const all = await fetchDiscrepancies(baseId)
    const rows = all as unknown as Record<string, unknown>[]
    const since = timePresetSince(timePreset)
    if (!since) return rows
    return rows.filter(
      r => typeof r.created_at === 'string' && (r.created_at as string) >= since,
    )
  },
  getDimensionValue(row, dimKey) {
    if (dimKey === 'month') {
      const c = row.created_at
      return typeof c === 'string' ? c.slice(0, 7) : '—'   // YYYY-MM
    }
    return String(row[dimKey] ?? '—')
  },
}
