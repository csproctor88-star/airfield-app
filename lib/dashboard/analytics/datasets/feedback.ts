import type { Dataset } from '@/lib/dashboard/analytics/types'
import { timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import { fetchFeedback } from '@/lib/supabase/feedback'

export const feedbackDataset: Dataset = {
  key: 'feedback',
  label: 'Customer Feedback',
  permission: 'feedback:view',
  moduleHref: '/feedback',
  timeField: 'submitted_at',
  dimensions: [
    { key: 'rating', label: 'Rating' },
    { key: 'month', label: 'Month' },
  ],
  measures: [
    { key: 'count', label: 'Count', kind: 'count' },
    { key: 'avg_rating', label: 'Avg Rating', kind: 'avg', field: 'overall_rating' },
  ],
  filters: [
    {
      field: 'rating',
      label: 'Rating',
      options: [
        { value: '1', label: '1 Star' },
        { value: '2', label: '2 Stars' },
        { value: '3', label: '3 Stars' },
        { value: '4', label: '4 Stars' },
        { value: '5', label: '5 Stars' },
      ],
    },
  ],
  async fetchRows(baseId, timePreset) {
    const all = await fetchFeedback(baseId)
    const rows = all as unknown as Record<string, unknown>[]
    const since = timePresetSince(timePreset)
    if (!since) return rows
    // submitted_at is a full ISO timestamp
    return rows.filter(
      r => typeof r.submitted_at === 'string' && (r.submitted_at as string) >= since,
    )
  },
  getDimensionValue(row, dimKey) {
    if (dimKey === 'month') {
      const s = row.submitted_at
      return typeof s === 'string' ? s.slice(0, 7) : '—'   // YYYY-MM
    }
    if (dimKey === 'rating') {
      const v = row.overall_rating
      return v != null ? String(v) : '—'
    }
    return String(row[dimKey] ?? '—')
  },
}
