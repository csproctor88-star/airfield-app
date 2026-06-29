'use client'
import { useRef, memo } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import type ReactGridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { WidgetFrame } from './widget-frame'
import { getWidgetDef } from '@/lib/dashboard/registry'
import type { WidgetInstance, BoardLayout, DeviceClass } from '@/lib/dashboard/layout'

type Layout = ReactGridLayout.Layout

const ResponsiveGrid = WidthProvider(Responsive)
const COLS = { lg: 12, md: 8, sm: 1 }
const BREAKPOINTS = { lg: 996, md: 600, sm: 0 }

type DashboardWidgetProps = {
  id: string
  type: string
  config: Record<string, unknown>
  editing: boolean
  copyBoards: { id: string; name: string }[]
  onRemove: (id: string) => void
  onConfigure: (id: string) => void
  onWidgetConfigChange: (id: string, config: Record<string, unknown>) => void
  onCopyWidget: (id: string, target: string) => void
}
const DashboardWidget = memo(function DashboardWidget(p: DashboardWidgetProps) {
  const def = getWidgetDef(p.type)
  return (
    <WidgetFrame
      title={((p.config?.title as string) || '').trim() || def?.title || 'Unavailable'}
      editing={p.editing}
      onRemove={() => p.onRemove(p.id)}
      onConfigure={def?.ConfigForm ? () => p.onConfigure(p.id) : undefined}
      color={(p.config?.color as string) || undefined}
      onSetColor={(c) => p.onWidgetConfigChange(p.id, { ...p.config, color: c })}
      copyTargets={p.copyBoards}
      onCopyTo={(target) => p.onCopyWidget(p.id, target)}
    >
      {def ? <def.Component config={p.config} editing={p.editing} onConfigChange={(c) => p.onWidgetConfigChange(p.id, c)} />
           : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>This widget is unavailable.</div>}
    </WidgetFrame>
  )
})

export function WidgetGrid({
  boardLayout, editing, onDeviceLayoutChange, onRemove, onConfigure, onWidgetConfigChange, copyBoards, onCopyWidget,
}: {
  boardLayout: BoardLayout
  editing: boolean
  onDeviceLayoutChange: (device: DeviceClass, layout: WidgetInstance[]) => void
  onRemove: (id: string) => void
  onConfigure: (id: string) => void
  onWidgetConfigChange: (id: string, config: Record<string, unknown>) => void
  copyBoards: { id: string; name: string }[]
  onCopyWidget: (id: string, target: string) => void
}) {
  // A ref (not state) because react-grid-layout fires onBreakpointChange and
  // onLayoutChange synchronously back-to-back on the crossing tick; a state
  // value would still be the previous breakpoint inside handleChange's closure,
  // letting a collapsed md/sm layout overwrite the wrong device slot. A ref is
  // updated synchronously and read live.
  const breakpointRef = useRef<string>('lg')

  const toRgl = (ws: WidgetInstance[]): Layout[] => ws.map(w => {
    const def = getWidgetDef(w.type)
    return { i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: def?.minSize.w ?? 1, minH: def?.minSize.h ?? 1 }
  })

  const layouts: ReactGridLayout.Layouts = {
    lg: toRgl(boardLayout.lg),
    ...(boardLayout.md ? { md: toRgl(boardLayout.md) } : {}),
    ...(boardLayout.sm ? { sm: toRgl(boardLayout.sm) } : {}),
  }

  function handleChange(current: Layout[]) {
    const byId = new Map(current.map(l => [l.i, l]))
    const next = boardLayout.lg.map(c => {
      const l = byId.get(c.i)
      return l ? { ...c, x: l.x, y: l.y, w: l.w, h: l.h } : c
    })
    onDeviceLayoutChange(breakpointRef.current as DeviceClass, next)
  }

  return (
    <ResponsiveGrid
      className="dashboard-grid"
      layouts={layouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={80}
      margin={[12, 12]}
      isDraggable={editing}
      isResizable={editing}
      resizeHandles={['nw', 'ne', 'sw', 'se']}
      onBreakpointChange={(bp) => { breakpointRef.current = bp }}
      onLayoutChange={(cur) => { if (editing) handleChange(cur) }}
      draggableCancel="a,button,.wt-col-resize"
    >
      {boardLayout.lg.map(w => (
        <div key={w.i}>
          <DashboardWidget
            id={w.i} type={w.type} config={w.config} editing={editing}
            copyBoards={copyBoards}
            onRemove={onRemove} onConfigure={onConfigure}
            onWidgetConfigChange={onWidgetConfigChange} onCopyWidget={onCopyWidget}
          />
        </div>
      ))}
    </ResponsiveGrid>
  )
}
