'use client'
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
  widgets, editing, onLayoutChange, onRemove, onConfigure,
}: {
  widgets: WidgetInstance[]
  editing: boolean
  onLayoutChange: (next: WidgetInstance[]) => void
  onRemove: (id: string) => void
  onConfigure: (id: string) => void
}) {
  const rglLayout: Layout[] = widgets.map(w => {
    const def = getWidgetDef(w.type)
    return { i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: def?.minSize.w ?? 1, minH: def?.minSize.h ?? 1 }
  })

  function handleChange(current: Layout[]) {
    const byId = new Map(current.map(l => [l.i, l]))
    onLayoutChange(widgets.map(w => {
      const l = byId.get(w.i)
      return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w
    }))
  }

  return (
    <ResponsiveGrid
      className="dashboard-grid"
      layouts={{ lg: rglLayout, md: rglLayout, sm: rglLayout }}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={80}
      margin={[12, 12]}
      isDraggable={editing}
      isResizable={editing}
      onLayoutChange={(cur) => { if (editing) handleChange(cur) }}
      draggableCancel="a,button"
    >
      {widgets.map(w => {
        const def = getWidgetDef(w.type)
        return (
          <div key={w.i}>
            <WidgetFrame
              title={def?.title ?? 'Unavailable'}
              editing={editing}
              onRemove={() => onRemove(w.i)}
              onConfigure={def?.ConfigForm ? () => onConfigure(w.i) : undefined}
            >
              {def ? <def.Component config={w.config} editing={editing} />
                   : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>This widget is unavailable.</div>}
            </WidgetFrame>
          </div>
        )
      })}
    </ResponsiveGrid>
  )
}
