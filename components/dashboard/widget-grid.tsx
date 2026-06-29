'use client'
import { useRef } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import type ReactGridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { WidgetFrame } from './widget-frame'
import { getWidgetDef } from '@/lib/dashboard/registry'
import type { WidgetInstance } from '@/lib/dashboard/layout'

type Layout = ReactGridLayout.Layout

const ResponsiveGrid = WidthProvider(Responsive)
const COLS = { lg: 12, md: 8, sm: 1 }
const BREAKPOINTS = { lg: 996, md: 600, sm: 0 }

export function WidgetGrid({
  widgets, editing, onLayoutChange, onRemove, onConfigure, onWidgetConfigChange, copyBoards, onCopyWidget,
}: {
  widgets: WidgetInstance[]
  editing: boolean
  onLayoutChange: (next: WidgetInstance[]) => void
  onRemove: (id: string) => void
  onConfigure: (id: string) => void
  onWidgetConfigChange: (id: string, config: Record<string, unknown>) => void
  copyBoards: { id: string; name: string }[]
  onCopyWidget: (widget: WidgetInstance, target: string) => void
}) {
  // A ref (not state) because react-grid-layout fires onBreakpointChange and
  // onLayoutChange synchronously back-to-back on the crossing tick; a state
  // value would still be the previous breakpoint inside handleChange's closure,
  // letting a collapsed md/sm layout overwrite the saved lg layout. A ref is
  // updated synchronously and read live.
  const breakpointRef = useRef<string>('lg')

  const rglLayout: Layout[] = widgets.map(w => {
    const def = getWidgetDef(w.type)
    return { i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: def?.minSize.w ?? 1, minH: def?.minSize.h ?? 1 }
  })

  function handleChange(current: Layout[]) {
    // Only persist the lg (desktop canonical) layout — md/sm are just reflows
    if (breakpointRef.current !== 'lg') return
    const byId = new Map(current.map(l => [l.i, l]))
    onLayoutChange(widgets.map(w => {
      const l = byId.get(w.i)
      return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w
    }))
  }

  return (
    <ResponsiveGrid
      className="dashboard-grid"
      layouts={{ lg: rglLayout }}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={80}
      margin={[12, 12]}
      isDraggable={editing}
      isResizable={editing}
      onBreakpointChange={(bp) => { breakpointRef.current = bp }}
      onLayoutChange={(cur) => { if (editing) handleChange(cur) }}
      draggableCancel="a,button,.wt-col-resize"
    >
      {widgets.map(w => {
        const def = getWidgetDef(w.type)
        return (
          <div key={w.i}>
            <WidgetFrame
              title={((w.config?.title as string) || '').trim() || def?.title || 'Unavailable'}
              editing={editing}
              onRemove={() => onRemove(w.i)}
              onConfigure={def?.ConfigForm ? () => onConfigure(w.i) : undefined}
              color={(w.config?.color as string) || undefined}
              onSetColor={(c) => onWidgetConfigChange(w.i, { ...w.config, color: c })}
              copyTargets={copyBoards}
              onCopyTo={(target) => onCopyWidget(w, target)}
            >
              {def ? <def.Component config={w.config} editing={editing} onConfigChange={(c) => onWidgetConfigChange(w.i, c)} />
                   : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>This widget is unavailable.</div>}
            </WidgetFrame>
          </div>
        )
      })}
    </ResponsiveGrid>
  )
}
