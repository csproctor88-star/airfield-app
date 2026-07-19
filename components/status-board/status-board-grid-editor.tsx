'use client'
import { memo } from 'react'
import GridLayoutBase, { WidthProvider } from 'react-grid-layout'
import type ReactGridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  STATUS_GRID_COLS, STATUS_GRID_ROW_HEIGHT, STATUS_GRID_MARGIN,
  STATUS_SECTION_MIN_W, STATUS_SECTION_MIN_H,
  type StatusBoardGridLayout,
} from '@/lib/status-board-grid'

const Grid = WidthProvider(GridLayoutBase)

type Props = {
  layout: StatusBoardGridLayout
  /** Fired on every local drag/resize — the CALLER buffers it in state.
   *  Nothing here ever touches the server; persistence happens only when
   *  the page's explicit Save action runs (owner ruling — the dashboard's
   *  while-you-drag writes were what made it feel choppy). */
  onChange: (next: StatusBoardGridLayout) => void
  /** Section card content by key; keys missing from the map render nothing. */
  sectionsByKey: ReadonlyMap<string, React.ReactNode>
}

/**
 * Dashboard-style drag + resize editor for the status board sections.
 * Deliberately simpler than components/dashboard/widget-grid.tsx: one
 * fixed 24-column layout (no responsive breakpoint variants — crossing
 * reflows were another source of the dashboard's original jank), no
 * widget palette, no per-widget chrome. Dynamically imported by the
 * status page so viewers never load react-grid-layout.
 */
export const StatusBoardGridEditor = memo(function StatusBoardGridEditor({ layout, onChange, sectionsByKey }: Props) {
  const rglLayout: ReactGridLayout.Layout[] = layout.sections.map((s) => ({
    i: s.key, x: s.x, y: s.y, w: s.w, h: s.h,
    minW: STATUS_SECTION_MIN_W, minH: STATUS_SECTION_MIN_H,
  }))

  const handleChange = (current: ReactGridLayout.Layout[]) => {
    const byKey = new Map(current.map((l) => [l.i, l]))
    const next = layout.sections.map((s) => {
      const l = byKey.get(s.key)
      return l ? { ...s, x: l.x, y: l.y, w: l.w, h: l.h } : s
    })
    if (next.every((s, i) => {
      const p = layout.sections[i]
      return p.key === s.key && p.x === s.x && p.y === s.y && p.w === s.w && p.h === s.h
    })) return // reflow echo, not a user change — don't dirty the buffer
    onChange({ sections: next })
  }

  return (
    <Grid
      className="status-board-grid"
      layout={rglLayout}
      cols={STATUS_GRID_COLS}
      rowHeight={STATUS_GRID_ROW_HEIGHT}
      margin={[STATUS_GRID_MARGIN, STATUS_GRID_MARGIN]}
      isDraggable
      isResizable
      resizeHandles={['nw', 'ne', 'sw', 'se']}
      onLayoutChange={handleChange}
      // Interactive controls inside a section keep working mid-edit —
      // including the inline label rename (.sb-rename).
      draggableCancel="a,button,input,textarea,select,.sb-rename"
    >
      {layout.sections.map((s) => (
        // flex column so the section card (flex-basis sized) stretches to
        // fill its cell; overflow scrolls content that outgrows the rect.
        <div key={s.key} style={{ overflow: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {sectionsByKey.get(s.key) ?? null}
        </div>
      ))}
    </Grid>
  )
})

export default StatusBoardGridEditor
