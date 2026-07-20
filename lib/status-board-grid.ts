// Grid-layout model for the Airfield Status board (dashboard-style drag +
// resize, base-admin only — owner ruling 2026-07-19). Mirrors the dashboard
// grid's geometry (24 columns / 40px rows / 6px gaps) so the two features
// feel identical, without widgets, breakpoint variants, or per-user boards.

import { WIDGET_COLORS } from '@/lib/dashboard/widget-colors'

// Sections share the dashboard widgets' color palette; 'default' is
// represented by OMITTING color, so pre-color saved layouts parse unchanged.
const SECTION_COLOR_KEYS = new Set(
  WIDGET_COLORS.filter((c) => c.key !== 'default').map((c) => c.key),
)

export type StatusSectionRect = {
  key: string
  x: number
  y: number
  w: number
  h: number
  /** Optional tint — a WIDGET_COLORS key (blue/cyan/green/amber/red/purple). */
  color?: string
}

export type StatusBoardGridLayout = {
  sections: StatusSectionRect[]
}

export const STATUS_GRID_COLS = 24
export const STATUS_GRID_ROW_HEIGHT = 40
export const STATUS_GRID_MARGIN = 6
// Sections narrower than this are unusable (the runway tiles alone need it).
export const STATUS_SECTION_MIN_W = 4
export const STATUS_SECTION_MIN_H = 3

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}

/** Parse an untrusted stored layout; malformed rows drop, values clamp to grid bounds. */
export function validateStatusBoardGridLayout(raw: unknown): StatusBoardGridLayout | null {
  if (!raw || typeof raw !== 'object') return null
  const sections = (raw as { sections?: unknown }).sections
  if (!Array.isArray(sections)) return null
  const out: StatusSectionRect[] = []
  const seen = new Set<string>()
  for (const s of sections) {
    if (!s || typeof s !== 'object') continue
    const key = (s as { key?: unknown }).key
    if (typeof key !== 'string' || !key || seen.has(key)) continue
    seen.add(key)
    const w = clampInt((s as { w?: unknown }).w, STATUS_SECTION_MIN_W, STATUS_GRID_COLS, 8)
    const rect: StatusSectionRect = {
      key,
      x: clampInt((s as { x?: unknown }).x, 0, STATUS_GRID_COLS - w, 0),
      y: clampInt((s as { y?: unknown }).y, 0, 999, 0),
      w,
      h: clampInt((s as { h?: unknown }).h, STATUS_SECTION_MIN_H, 200, 6),
    }
    const color = (s as { color?: unknown }).color
    if (typeof color === 'string' && SECTION_COLOR_KEYS.has(color)) rect.color = color
    out.push(rect)
  }
  return out.length > 0 ? { sections: out } : null
}

/**
 * Starting rects when a base first enters edit mode with no saved grid:
 * three sections to a row at 8 columns each, next rows below — a neutral
 * arrangement the admin immediately drags/resizes to taste.
 */
export function defaultStatusBoardGridLayout(keys: readonly string[]): StatusBoardGridLayout {
  return {
    sections: keys.map((key, i) => ({
      key,
      x: (i % 3) * 8,
      y: Math.floor(i / 3) * 6,
      w: 8,
      h: 6,
    })),
  }
}

/**
 * Reconcile a saved layout with the sections that exist right now: rects
 * for deleted sections drop; new sections append full rows below the
 * lowest rect so nothing ever renders hidden.
 */
export function syncLayoutSections(
  layout: StatusBoardGridLayout,
  keys: readonly string[],
): StatusBoardGridLayout {
  const known = new Set(keys)
  const kept = layout.sections.filter((s) => known.has(s.key))
  const have = new Set(kept.map((s) => s.key))
  const missing = keys.filter((k) => !have.has(k))
  let bottom = kept.reduce((m, s) => Math.max(m, s.y + s.h), 0)
  const appended: StatusSectionRect[] = missing.map((key) => {
    const rect = { key, x: 0, y: bottom, w: STATUS_GRID_COLS, h: 6 }
    bottom += 6
    return rect
  })
  return { sections: [...kept, ...appended] }
}

/** Phone stacking order (and the derived section_order column): top-to-bottom, then left-to-right. */
export function layoutStackOrder(layout: StatusBoardGridLayout): string[] {
  return [...layout.sections]
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .map((s) => s.key)
}
