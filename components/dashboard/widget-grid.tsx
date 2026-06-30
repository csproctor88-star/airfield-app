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
const COLS = { lg: 24, md: 16, sm: 1 }
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
      collapsed={!p.editing && (p.config?.minimized as boolean) === true}
      onToggleCollapse={() => p.onWidgetConfigChange(p.id, { ...p.config, minimized: !(p.config?.minimized as boolean) })}
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
  const justCrossedRef = useRef(false)

  const toRgl = (ws: WidgetInstance[]): Layout[] => ws.map(w => {
    const def = getWidgetDef(w.type)
    // Minimized (view mode only): collapse to a single header row. The stored h
    // is left untouched so expanding restores the user's size. Vertical
    // compaction reclaims the freed space. Ignored while editing so layout/
    // resize work on the full widget and onLayoutChange never persists h=1.
    const minimized = !editing && (w.config as { minimized?: boolean })?.minimized === true
    return {
      i: w.i, x: w.x, y: w.y, w: w.w,
      h: minimized ? 1 : w.h,
      minW: def?.minSize.w ?? 1,
      minH: minimized ? 1 : (def?.minSize.h ?? 1),
    }
  })

  const layouts: ReactGridLayout.Layouts = {
    lg: toRgl(boardLayout.lg),
    ...(boardLayout.md ? { md: toRgl(boardLayout.md) } : {}),
    ...(boardLayout.sm ? { sm: toRgl(boardLayout.sm) } : {}),
  }

  function samePositions(a: WidgetInstance[], b: WidgetInstance[] | undefined): boolean {
    if (!b || a.length !== b.length) return false
    const m = new Map(b.map(w => [w.i, w]))
    return a.every(w => { const o = m.get(w.i); return !!o && o.x === w.x && o.y === w.y && o.w === w.w && o.h === w.h })
  }

  function handleChange(current: Layout[]) {
    // Ignore the reflow react-grid-layout emits right after a breakpoint cross —
    // it's not a user drag, and would otherwise persist an auto-derived layout.
    if (justCrossedRef.current) { justCrossedRef.current = false; return }
    const byId = new Map(current.map(l => [l.i, l]))
    const next = boardLayout.lg.map(c => {
      const l = byId.get(c.i)
      return l ? { ...c, x: l.x, y: l.y, w: l.w, h: l.h } : c
    })
    const device = breakpointRef.current as DeviceClass
    const currentArr = device === 'lg' ? boardLayout.lg : device === 'md' ? boardLayout.md : boardLayout.sm
    if (samePositions(next, currentArr)) return   // no real change — don't dirty / write
    onDeviceLayoutChange(device, next)
  }

  return (
    <ResponsiveGrid
      className="dashboard-grid"
      layouts={layouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={40}
      margin={[6, 6]}
      isDraggable={editing}
      isResizable={editing}
      resizeHandles={['nw', 'ne', 'sw', 'se']}
      onBreakpointChange={(bp) => { breakpointRef.current = bp; justCrossedRef.current = true }}
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
