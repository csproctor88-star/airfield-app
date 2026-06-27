import type { AggregateResult, FilterOp, Measure, QuerySpec, TimePreset } from './types'

export function applyFilters(
  rows: Record<string, unknown>[],
  filters?: { field: string; op: FilterOp; value: string }[],
): Record<string, unknown>[] {
  if (!filters || filters.length === 0) return rows
  return rows.filter(r =>
    filters.every(f => {
      const v = String(r[f.field] ?? '')
      return f.op === 'eq' ? v === f.value : v !== f.value
    }),
  )
}

function measureValue(rows: Record<string, unknown>[], m: Measure): number {
  if (m.kind === 'count') return rows.length
  const field = m.field
  if (!field) return 0
  const nums = rows.map(r => Number(r[field])).filter(n => Number.isFinite(n))
  if (nums.length === 0) return 0
  const sum = nums.reduce((a, b) => a + b, 0)
  return m.kind === 'sum' ? sum : sum / nums.length
}

/** Pure aggregation: rows + spec → labels/values. Throws on an unknown measure. */
export function aggregate(
  rows: Record<string, unknown>[],
  spec: QuerySpec,
  measures: Measure[],
  getDimensionValue: (row: Record<string, unknown>, dimKey: string) => string,
): AggregateResult {
  const m = measures.find(x => x.key === spec.measure)
  if (!m) throw new Error(`Unknown measure: ${spec.measure}`)
  if (!spec.groupBy) return { labels: ['Total'], values: [round(measureValue(rows, m))] }

  const groups = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const k = getDimensionValue(r, spec.groupBy)
    const arr = groups.get(k)
    if (arr) arr.push(r); else groups.set(k, [r])
  }
  const labels: string[] = []
  const values: number[] = []
  for (const [k, gr] of Array.from(groups.entries())) { labels.push(k); values.push(round(measureValue(gr, m))) }
  return { labels, values }
}

function round(n: number): number { return Math.round(n * 100) / 100 }

/** ISO timestamp for the start of a preset window, or null for all/undefined. */
export function timePresetSince(preset: TimePreset | undefined, now: number = Date.now()): string | null {
  if (!preset || preset === 'all') return null
  if (preset === 'ytd') return new Date(new Date(now).getUTCFullYear(), 0, 1).toISOString()
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  return new Date(now - days * 86_400_000).toISOString()
}
