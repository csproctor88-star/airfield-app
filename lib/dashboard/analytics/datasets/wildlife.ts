import type { Dataset } from '@/lib/dashboard/analytics/types'
import { timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import { fetchSightings, fetchStrikes } from '@/lib/supabase/wildlife'

/**
 * Combined wildlife dataset: sightings + strikes merged into one row set.
 * A synthetic `record_type` field ('sighting' | 'strike') distinguishes them.
 * Sightings use `observed_at` (full ISO); strikes use `strike_date` (date-only).
 * The merged rows carry a normalized `_time` field (ISO string) for time filtering.
 */
export const wildlifeDataset: Dataset = {
  key: 'wildlife',
  label: 'Wildlife',
  permission: 'wildlife:view',
  moduleHref: '/wildlife',
  timeField: '_time',
  dimensions: [
    { key: 'record_type', label: 'Type' },
    { key: 'species_group', label: 'Species Group' },
    { key: 'species_common', label: 'Species' },
    { key: 'month', label: 'Month' },
  ],
  measures: [
    { key: 'count', label: 'Count', kind: 'count' },
  ],
  filters: [
    {
      field: 'record_type',
      label: 'Type',
      options: [
        { value: 'sighting', label: 'Sighting' },
        { value: 'strike', label: 'Strike' },
      ],
    },
  ],
  async fetchRows(baseId, timePreset) {
    const since = timePresetSince(timePreset)

    const [sightingsResult, strikesResult] = await Promise.all([
      fetchSightings(baseId),
      fetchStrikes(baseId),
    ])

    const sightingRows = (sightingsResult.data as unknown as Record<string, unknown>[]).map(r => ({
      ...r,
      record_type: 'sighting',
      _time: r.observed_at as string,
    }))

    // strike_date is date-only (YYYY-MM-DD); normalize to ISO for _time
    const strikeRows = (strikesResult.data as unknown as Record<string, unknown>[]).map(r => ({
      ...r,
      record_type: 'strike',
      // Append T00:00:00Z so the _time field is a sortable ISO string
      _time: typeof r.strike_date === 'string' ? `${r.strike_date}T00:00:00Z` : '',
    }))

    const all: Record<string, unknown>[] = [...sightingRows, ...strikeRows]

    if (!since) return all
    return all.filter(r => typeof r._time === 'string' && (r._time as string) >= since)
  },
  getDimensionValue(row, dimKey) {
    if (dimKey === 'month') {
      const t = row._time
      return typeof t === 'string' && t.length >= 7 ? t.slice(0, 7) : '—'   // YYYY-MM
    }
    return String(row[dimKey] ?? '—')
  },
}
