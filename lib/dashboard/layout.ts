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

/**
 * Return a new layout with `source` copied onto the end: a fresh `newId`, a
 * deep-copied `config`, placed at x:0 below all existing widgets. Pure — the
 * input `layout` is not mutated and `newId` is injected so callers stay
 * deterministic/testable.
 */
export function appendWidgetToLayout(
  layout: WidgetInstance[],
  source: WidgetInstance,
  newId: string,
): WidgetInstance[] {
  const bottomY = layout.reduce((m, w) => Math.max(m, w.y + w.h), 0)
  const placed: WidgetInstance = {
    ...source,
    i: newId,
    // config is typed non-optional, but unvalidated DB rows can bypass the type — guard before cloning
    config: structuredClone(source.config ?? {}),
    x: 0,
    y: bottomY,
  }
  return [...layout, placed]
}

// ---------------------------------------------------------------------------
// Multi-breakpoint board layout helpers
// ---------------------------------------------------------------------------

export type DeviceClass = 'lg' | 'md' | 'sm'
export type BoardLayout = { lg: WidgetInstance[]; md?: WidgetInstance[]; sm?: WidgetInstance[]; gridScale?: number }

/**
 * Current grid scale. The grid moved from 12 cols / 80px rows to 24 cols / 40px
 * rows (finer sizing on both axes). Layouts stored before that change are on the
 * old (×1) scale; we detect the absence of `gridScale === GRID_SCALE` and double
 * each widget's x/y/w/h once on read (sm stays single-column, so only y/h scale).
 * Write boundaries stamp `gridScale: GRID_SCALE`, so this is idempotent and the
 * old code (which ignores the marker) keeps rendering pre-migration boards 1:1.
 */
export const GRID_SCALE = 2

function scaleWidget(w: WidgetInstance, scaleXW: boolean): WidgetInstance {
  return scaleXW
    ? { ...w, x: w.x * GRID_SCALE, y: w.y * GRID_SCALE, w: w.w * GRID_SCALE, h: w.h * GRID_SCALE }
    : { ...w, x: 0, y: w.y * GRID_SCALE, w: 1, h: w.h * GRID_SCALE }
}

/** Ensure md/sm contain exactly lg's widget set: keep each variant widget's
 *  position where present, append lg widgets missing from the variant, drop
 *  stale ids. lg is canonical (set + config). Absent variants stay undefined. */
export function reconcileBoardLayout(bl: BoardLayout): BoardLayout {
  const fix = (variant: WidgetInstance[] | undefined): WidgetInstance[] | undefined => {
    if (!variant) return undefined
    const byId = new Map(variant.map(v => [v.i, v]))
    return bl.lg.map(c => {
      const v = byId.get(c.i)
      return v ? { ...c, x: v.x, y: v.y, w: v.w, h: v.h } : { ...c }
    })
  }
  return { lg: bl.lg, md: fix(bl.md), sm: fix(bl.sm), gridScale: bl.gridScale }
}

/**
 * Normalize raw stored JSON into a BoardLayout. Legacy flat arrays → { lg }.
 * Boards not yet on the current grid scale are doubled once (see GRID_SCALE) and
 * tagged, so every BoardLayout returned here is on the current scale.
 */
export function validateBoardLayout(raw: unknown): BoardLayout {
  const isObj = !!raw && typeof raw === 'object' && !Array.isArray(raw)
  const alreadyScaled = isObj && (raw as Record<string, unknown>).gridScale === GRID_SCALE

  let bl: BoardLayout
  if (Array.isArray(raw)) {
    bl = { lg: validateLayout(raw) }
  } else if (isObj && Array.isArray((raw as Record<string, unknown>).lg)) {
    const r = raw as Record<string, unknown>
    bl = reconcileBoardLayout({
      lg: validateLayout(r.lg),
      md: Array.isArray(r.md) ? validateLayout(r.md) : undefined,
      sm: Array.isArray(r.sm) ? validateLayout(r.sm) : undefined,
    })
  } else {
    bl = { lg: [] }
  }

  if (alreadyScaled) return { ...bl, gridScale: GRID_SCALE }
  // Legacy (old grid) → scale once into the current grid and tag.
  return {
    lg: bl.lg.map(w => scaleWidget(w, true)),
    md: bl.md ? bl.md.map(w => scaleWidget(w, true)) : undefined,
    sm: bl.sm ? bl.sm.map(w => scaleWidget(w, false)) : undefined,
    gridScale: GRID_SCALE,
  }
}

/** Append a copied widget (new id, deep-copied config) to every present device array. */
export function appendWidgetToBoardLayout(bl: BoardLayout, source: WidgetInstance, newId: string): BoardLayout {
  return {
    lg: appendWidgetToLayout(bl.lg, source, newId),
    md: bl.md ? appendWidgetToLayout(bl.md, source, newId) : undefined,
    sm: bl.sm ? appendWidgetToLayout(bl.sm, source, newId) : undefined,
    gridScale: bl.gridScale,
  }
}
