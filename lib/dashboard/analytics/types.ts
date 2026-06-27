export type MeasureKind = 'count' | 'avg' | 'sum'
export type ChartType = 'number' | 'bar' | 'line' | 'donut' | 'table'
export type TimePreset = '7d' | '30d' | '90d' | 'ytd' | 'all'
export type FilterOp = 'eq' | 'neq'

export interface Dimension { key: string; label: string }
export interface Measure { key: string; label: string; kind: MeasureKind; field?: string }
export interface FilterDef { field: string; label: string; options: { value: string; label: string }[] }

export interface QuerySpec {
  dataset: string
  measure: string                 // a Measure.key
  groupBy?: string                // a Dimension.key (omit → single number)
  filters?: { field: string; op: FilterOp; value: string }[]
  timePreset?: TimePreset
  chart: ChartType
  title?: string
}

export interface AggregateResult { labels: string[]; values: number[] }

export interface Dataset {
  key: string
  label: string
  permission: string
  moduleHref?: string
  timeField?: string
  dimensions: Dimension[]
  measures: Measure[]
  filters: FilterDef[]
  fetchRows: (baseId: string, timePreset?: TimePreset) => Promise<Record<string, unknown>[]>
  getDimensionValue: (row: Record<string, unknown>, dimKey: string) => string
}
