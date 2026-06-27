/** One widget placed on a board. Stored verbatim in dashboard_boards.layout. */
export interface WidgetInstance {
  i: string                          // stable id (crypto.randomUUID())
  type: string                       // registry key; unknown types render a placeholder
  config: Record<string, unknown>
  x: number; y: number; w: number; h: number
}

function num(v: unknown, fallback: number, min: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return n < min ? min : Math.floor(n)
}

/**
 * Coerce arbitrary stored/parsed JSON into a safe WidgetInstance[].
 * Tolerant by design: drops malformed entries and duplicate ids rather than
 * throwing, so a corrupt board never crashes the grid.
 */
export function validateLayout(raw: unknown): WidgetInstance[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: WidgetInstance[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.i !== 'string' || !r.i) continue
    if (typeof r.type !== 'string' || !r.type) continue
    if (seen.has(r.i)) continue
    seen.add(r.i)
    out.push({
      i: r.i,
      type: r.type,
      config: (r.config && typeof r.config === 'object') ? r.config as Record<string, unknown> : {},
      x: num(r.x, 0, 0),
      y: num(r.y, 0, 0),
      w: num(r.w, 1, 1),
      h: num(r.h, 1, 1),
    })
  }
  return out
}
