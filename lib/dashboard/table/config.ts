import type { ColumnDef, FilterDef, ExtraConfigDef, TableWidgetConfig } from './types'

interface NormalizableDescriptor<Row> {
  filters: FilterDef<Row>[]
  extras?: ExtraConfigDef[]
}

/**
 * Trust boundary between stored JSON and the renderer (mirrors validateLayout).
 * - columns: keep only known keys (preserve order); undefined when caller passed none.
 * - filters: keep only descriptor keys; fill each descriptor filter's default when absent.
 * - extras: every descriptor extra resolves to a valid option value or its default.
 * Back-compat: an empty raw config returns the descriptor defaults, so a widget
 * saved before Phase 4 renders exactly as it does today.
 */
export function normalizeTableConfig<Row>(
  raw: TableWidgetConfig | undefined | null,
  descriptor: NormalizableDescriptor<Row>,
  allColumns: ColumnDef<Row>[],
): TableWidgetConfig {
  const r = raw ?? {}
  const known = new Set(allColumns.map(c => c.key))
  const columns = Array.isArray(r.columns)
    ? r.columns.filter(k => known.has(k))
    : undefined

  const filters: Record<string, string[] | string> = {}
  for (const f of descriptor.filters) {
    const v = r.filters?.[f.key]
    if (v !== undefined) filters[f.key] = v
    else if (f.defaultSelected !== undefined) filters[f.key] = f.defaultSelected
  }

  const extras: Record<string, string> = {}
  for (const e of descriptor.extras ?? []) {
    const v = r.extras?.[e.key]
    extras[e.key] = e.options.some(o => o.value === v) ? (v as string) : e.default
  }

  // Pass columnWidths through, keeping only entries for known column keys
  let columnWidths: Record<string, number> | undefined
  if (r.columnWidths && typeof r.columnWidths === 'object') {
    const filtered: Record<string, number> = {}
    for (const [k, v] of Object.entries(r.columnWidths)) {
      if (known.has(k) && typeof v === 'number' && v > 0) filtered[k] = v
    }
    if (Object.keys(filtered).length) columnWidths = filtered
  }

  return {
    title: typeof r.title === 'string' && r.title.trim() ? r.title : undefined,
    columns: columns && columns.length ? columns : undefined,
    filters: Object.keys(filters).length ? filters : undefined,
    extras: Object.keys(extras).length ? extras : undefined,
    columnWidths,
  }
}
