import type { ReactNode } from 'react'

export interface ColumnDef<Row> {
  key: string
  label: string
  accessor: (row: Row) => unknown
  format?: (v: unknown, row: Row) => ReactNode
  defaultVisible?: boolean
  mono?: boolean
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

export interface DetailField<Row> {
  label: string
  value: (row: Row) => ReactNode
  hideWhenEmpty?: boolean
}

export interface RowActionCtx {
  baseId: string
  userId: string
}

export interface RowAction<Row> {
  key: string
  label: (row: Row) => string
  permission: string
  visible?: (row: Row) => boolean
  run: (row: Row, ctx: RowActionCtx) => Promise<void>
}

export type RowBehavior<Row> =
  | { mode: 'none' }
  | { mode: 'deeplink'; href: (row: Row) => string }
  | { mode: 'detail'; title: (row: Row) => string; fields: DetailField<Row>[] }
  | { mode: 'detail+actions'; title: (row: Row) => string; fields: DetailField<Row>[]; actions: RowAction<Row>[] }

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
  useRows: (config: TableWidgetConfig) => { rows: Row[]; loading: boolean }
}
