import type { ColumnDef } from './types'

/**
 * Resolve the ordered visible columns. `saved` is config.columns (an ordered
 * list of column keys). Unknown keys are dropped; an empty/undefined result
 * falls back to the descriptor's defaultVisible set.
 */
export function resolveVisibleColumns<Row>(
  all: ColumnDef<Row>[],
  saved: string[] | undefined,
): ColumnDef<Row>[] {
  const byKey = new Map(all.map(c => [c.key, c]))
  if (saved && saved.length) {
    const picked = saved.map(k => byKey.get(k)).filter((c): c is ColumnDef<Row> => !!c)
    if (picked.length) return picked
  }
  return all.filter(c => c.defaultVisible)
}
