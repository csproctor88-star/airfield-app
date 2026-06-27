import type { Dataset } from '@/lib/dashboard/analytics/types'
import { timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import { fetchChecks } from '@/lib/supabase/checks'

export const checksDataset: Dataset = {
  key: 'checks',
  label: 'Airfield Checks',
  permission: 'checks:view',
  moduleHref: '/checks',
  timeField: 'completed_at',
  dimensions: [
    { key: 'check_type', label: 'Check Type' },
    { key: 'month', label: 'Month' },
  ],
  measures: [
    { key: 'count', label: 'Count', kind: 'count' },
  ],
  filters: [
    {
      field: 'check_type',
      label: 'Check Type',
      options: [
        { value: 'fod', label: 'FOD Check' },
        { value: 'bash', label: 'BASH Check' },
        { value: 'rsc', label: 'RSC Check' },
        { value: 'lighting', label: 'Lighting Check' },
        { value: 'bird_dispersal', label: 'Bird Dispersal' },
        { value: 'customs', label: 'Customs Check' },
        { value: 'ops_check', label: 'Ops Check' },
      ],
    },
  ],
  async fetchRows(baseId, timePreset) {
    // fetchChecks returns { data, error } — unwrap the wrapper
    const result = await fetchChecks(baseId)
    const rows = result.data as unknown as Record<string, unknown>[]
    const since = timePresetSince(timePreset)
    if (!since) return rows
    // completed_at is a full ISO timestamp
    return rows.filter(
      r => typeof r.completed_at === 'string' && (r.completed_at as string) >= since,
    )
  },
  getDimensionValue(row, dimKey) {
    if (dimKey === 'month') {
      const c = row.completed_at
      return typeof c === 'string' ? c.slice(0, 7) : '—'   // YYYY-MM
    }
    return String(row[dimKey] ?? '—')
  },
}
