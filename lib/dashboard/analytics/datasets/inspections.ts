import type { Dataset } from '@/lib/dashboard/analytics/types'
import { timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import { fetchInspections } from '@/lib/supabase/inspections'

export const inspectionsDataset: Dataset = {
  key: 'inspections',
  label: 'Inspections',
  permission: 'inspections:view',
  moduleHref: '/inspections',
  timeField: 'inspection_date',
  dimensions: [
    { key: 'inspection_type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'month', label: 'Month' },
  ],
  measures: [
    { key: 'count', label: 'Count', kind: 'count' },
  ],
  filters: [
    {
      field: 'inspection_type',
      label: 'Type',
      options: [
        { value: 'airfield', label: 'Airfield' },
        { value: 'lighting', label: 'Lighting' },
        { value: 'construction_meeting', label: 'Construction Meeting' },
        { value: 'joint_monthly', label: 'Joint Monthly' },
      ],
    },
    {
      field: 'status',
      label: 'Status',
      options: [
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
      ],
    },
  ],
  async fetchRows(baseId, timePreset) {
    const all = await fetchInspections(baseId)
    const rows = all as unknown as Record<string, unknown>[]
    const since = timePresetSince(timePreset)
    if (!since) return rows
    // inspection_date is date-only (YYYY-MM-DD); compare first 10 chars of since
    const sinceDate = since.slice(0, 10)
    return rows.filter(
      r => typeof r.inspection_date === 'string' && (r.inspection_date as string) >= sinceDate,
    )
  },
  getDimensionValue(row, dimKey) {
    if (dimKey === 'month') {
      const d = row.inspection_date
      return typeof d === 'string' ? d.slice(0, 7) : '—'   // YYYY-MM
    }
    return String(row[dimKey] ?? '—')
  },
}
