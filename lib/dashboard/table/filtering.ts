import type { FilterDef, TableWidgetConfig } from './types'

function selectionFor<Row>(f: FilterDef<Row>, config: TableWidgetConfig): string[] | string {
  const raw = config.filters?.[f.key]
  if (raw !== undefined) return raw
  if (f.defaultSelected !== undefined) return f.defaultSelected
  return f.kind === 'text' ? '' : []
}

function isActive<Row>(f: FilterDef<Row>, selection: string[] | string): boolean {
  if (f.kind === 'text') return (selection as string).trim() !== ''
  return (selection as string[]).length > 0
}

/**
 * Apply every descriptor filter to rows. A filter with an empty selection is a
 * passthrough. Filters AND across keys; within an enum key the predicate decides
 * OR semantics. Pure — no fetch, no React.
 */
export function applyFilters<Row>(
  rows: Row[],
  config: TableWidgetConfig,
  filters: FilterDef<Row>[],
): Row[] {
  const active = filters
    .map(f => ({ f, sel: selectionFor(f, config) }))
    .filter(({ f, sel }) => isActive(f, sel))
  return rows.filter(row => active.every(({ f, sel }) => f.predicate(row, sel)))
}
