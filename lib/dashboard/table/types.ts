import type { ComponentType, ReactNode } from 'react'

export interface ColumnDef<Row> {
  key: string
  label: string
  accessor: (row: Row) => unknown
  format?: (v: unknown, row: Row) => ReactNode
  defaultVisible?: boolean
  mono?: boolean
  wrap?: boolean
  align?: 'left' | 'right' | 'center'
}

export interface FilterDef<Row> {
  key: string
  label: string
  kind: 'enum-multi' | 'status' | 'text'
  options?: { value: string; label: string }[]
  predicate: (row: Row, selected: string[] | string) => boolean
  defaultSelected?: string[] | string
}

export interface ExtraConfigDef {
  key: string
  label: string
  options: { value: string; label: string }[]
  default: string
}

export type RowBehavior<Row> =
  | { mode: 'none' }
  | { mode: 'deeplink'; href: (row: Row) => string }

export interface SummaryStat {
  count: number
  label: string
  tone?: 'accent' | 'warning' | 'danger' | 'muted'
}

export interface TableWidgetConfig {
  title?: string
  columns?: string[]
  filters?: Record<string, string[] | string>
  extras?: Record<string, string>
  columnWidths?: Record<string, number>
}

export interface TableWidgetDescriptor<Row> {
  columns?: ColumnDef<Row>[]
  useColumns?: () => ColumnDef<Row>[]
  filters: FilterDef<Row>[]
  extras?: ExtraConfigDef[]
  row: RowBehavior<Row>
  footerHref?: string
  newHref?: string
  summary?: (rows: Row[]) => SummaryStat[]
  useRows: (config: TableWidgetConfig, reloadNonce?: number) => { rows: Row[]; loading: boolean }
  Toolbar?: ComponentType<{ reload: () => void }>
}
