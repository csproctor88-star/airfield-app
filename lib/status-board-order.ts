// Pure helpers for the Airfield Status board section layout (drag-to-reorder,
// base-admin only — see 2026071901_status_board_layouts_table.sql).

/**
 * Resolve the render order of the board's section cards from a saved
 * per-base order. Saved keys that no longer exist (deleted custom boards)
 * are dropped; sections the saved order doesn't know yet (new custom
 * boards, future built-ins) append after it in default relative order.
 * No saved order → default order.
 */
export function applyBoardOrder(
  defaultKeys: readonly string[],
  saved: readonly string[] | null | undefined,
): string[] {
  if (!saved || saved.length === 0) return [...defaultKeys]
  const known = new Set(defaultKeys)
  const valid = saved.filter((k) => known.has(k))
  const seen = new Set(valid)
  const missing = defaultKeys.filter((k) => !seen.has(k))
  return [...valid, ...missing]
}

/**
 * Drop semantics shared with hooks/use-drag-reorder: the dragged section
 * lands BEFORE the drop target (takes the target's position; the target
 * shifts right). No-ops on self-drops and unknown keys.
 */
export function moveSectionBefore(
  order: readonly string[],
  sourceKey: string,
  targetKey: string,
): string[] {
  if (sourceKey === targetKey) return [...order]
  const fromIdx = order.indexOf(sourceKey)
  const toIdx = order.indexOf(targetKey)
  if (fromIdx === -1 || toIdx === -1) return [...order]
  const next = [...order]
  next.splice(fromIdx, 1)
  const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
  next.splice(insertIdx, 0, sourceKey)
  return next
}
