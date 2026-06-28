import type { Dataset } from '@/lib/dashboard/analytics/types'
import { timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import { createClient } from '@/lib/supabase/client'

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
    { key: 'avg_duration', label: 'Avg Duration (min)', kind: 'avg', field: 'duration_minutes' },
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
    const supabase = createClient()
    if (!supabase) return []

    let query = supabase
      .from('inspections')
      .select('id, inspection_type, status, inspection_date, started_at, filed_at, created_at')
      .eq('base_id', baseId)
      .order('created_at', { ascending: false })

    // Apply time filter on inspection_date (date-only column — compare first 10 chars)
    const since = timePresetSince(timePreset)
    if (since) {
      const sinceDate = since.slice(0, 10)
      query = query.gte('inspection_date', sinceDate)
    }

    const { data, error } = await query
    if (error) {
      console.error('Failed to fetch inspections for analytics:', error.message)
      return []
    }

    const rawRows = (data ?? []) as {
      id: string
      inspection_type: string
      status: string
      inspection_date: string
      started_at: string | null
      filed_at: string | null
      created_at: string
    }[]

    return rawRows.map(r => {
      // Compute duration_minutes using the same clamped logic as analytics-data.ts:
      //   start = started_at ?? created_at (fallback for legacy rows)
      //   clamp: >=1 min and <1440 min (24 h); outside that range → null (excluded from avg)
      let duration_minutes: number | null = null
      if (r.filed_at) {
        const start = r.started_at ?? r.created_at
        const mins = (new Date(r.filed_at).getTime() - new Date(start).getTime()) / 60000
        if (mins >= 1 && mins < 1440) {
          duration_minutes = Math.round(mins * 100) / 100
        }
      }
      return {
        id: r.id,
        inspection_type: r.inspection_type,
        status: r.status,
        inspection_date: r.inspection_date,
        created_at: r.created_at,
        duration_minutes,
      } as Record<string, unknown>
    })
  },
  getDimensionValue(row, dimKey) {
    if (dimKey === 'month') {
      const d = row.inspection_date
      return typeof d === 'string' ? d.slice(0, 7) : '—'   // YYYY-MM
    }
    return String(row[dimKey] ?? '—')
  },
}
