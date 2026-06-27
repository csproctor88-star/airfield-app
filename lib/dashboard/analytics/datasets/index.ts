import type { Dataset, QuerySpec, AggregateResult } from '@/lib/dashboard/analytics/types'
import { aggregate, applyFilters } from '@/lib/dashboard/analytics/aggregate'
import { discrepanciesDataset } from './discrepancies'

export const DATASETS: Dataset[] = [discrepanciesDataset]

export function getDataset(key: string): Dataset | undefined {
  return DATASETS.find(d => d.key === key)
}

/** Fetch rows for the dataset, apply filters, aggregate per the spec. */
export async function runQuery(spec: QuerySpec, baseId: string): Promise<AggregateResult> {
  const ds = getDataset(spec.dataset)
  if (!ds) throw new Error(`Unknown dataset: ${spec.dataset}`)
  const rows = await ds.fetchRows(baseId, spec.timePreset)
  const filtered = applyFilters(rows, spec.filters)
  return aggregate(filtered, spec, ds.measures, ds.getDimensionValue)
}
