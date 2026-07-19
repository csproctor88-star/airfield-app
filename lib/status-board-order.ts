// Pure helper for the Airfield Status board's legacy section order — the
// reorder-era fallback used when a base has a section_order row but no grid
// layout yet (grid rects took over in 2026071902; see lib/status-board-grid.ts).

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
