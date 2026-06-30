import type { Dataset, QuerySpec, AggregateResult } from '@/lib/dashboard/analytics/types'
import { aggregate, applyFilters } from '@/lib/dashboard/analytics/aggregate'
import { discrepanciesDataset } from './discrepancies'
import { inspectionsDataset } from './inspections'
import { checksDataset } from './checks'
import { wildlifeDataset } from './wildlife'
import { pprDataset } from './ppr'
import { feedbackDataset } from './feedback'

export const DATASETS: Dataset[] = [
  discrepanciesDataset,
  inspectionsDataset,
  checksDataset,
  wildlifeDataset,
  pprDataset,
  feedbackDataset,
]

export function getDataset(key: string): Dataset | undefined {
  return DATASETS.find(d => d.key === key)
}

/** Title-case a raw enum value, upper-casing short acronym-like tokens
 *  (fod → FOD, rsc → RSC, ces → CES) and leaving YYYY-MM month buckets alone. */
function humanizeLabel(s: string): string {
  if (s === '—' || /^\d{4}-\d{2}$/.test(s)) return s
  const out = s.split(/[_\s]+/).filter(Boolean).map(w =>
    (w.length <= 3 && /^[a-z0-9]+$/.test(w))
      ? w.toUpperCase()
      : w.charAt(0).toUpperCase() + w.slice(1),
  ).join(' ')
  return out || s
}

/** Display label for a grouped dimension value: prefer the dataset's filter
 *  option label for that field (e.g. check_type 'fod' → 'FOD Check'), else a
 *  humanized form. Keeps raw values out of the rendered chart. */
function dimensionLabel(ds: Dataset, dimKey: string | undefined, raw: string): string {
  if (!dimKey) return raw
  const opt = ds.filters.find(f => f.field === dimKey)?.options.find(o => o.value === raw)
  return opt ? opt.label : humanizeLabel(raw)
}

/** Fetch rows for the dataset, apply filters, aggregate per the spec. */
export async function runQuery(spec: QuerySpec, baseId: string): Promise<AggregateResult> {
  const ds = getDataset(spec.dataset)
  if (!ds) throw new Error(`Unknown dataset: ${spec.dataset}`)
  const rows = await ds.fetchRows(baseId, spec.timePreset)
  const filtered = applyFilters(rows, spec.filters)
  const result = aggregate(filtered, spec, ds.measures, ds.getDimensionValue)
  if (spec.groupBy) result.labels = result.labels.map(l => dimensionLabel(ds, spec.groupBy, l))
  return result
}
