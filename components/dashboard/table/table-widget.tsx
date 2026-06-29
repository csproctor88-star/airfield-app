'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TableWidgetConfig, TableWidgetDescriptor, ColumnDef } from '@/lib/dashboard/table/types'
import { resolveVisibleColumns } from '@/lib/dashboard/table/columns'
import { applyFilters } from '@/lib/dashboard/table/filtering'
import { normalizeTableConfig } from '@/lib/dashboard/table/config'

type SortState = { key: string; dir: 'asc' | 'desc' } | null

function sortRows<Row>(rows: Row[], sort: SortState, visibleCols: ColumnDef<Row>[]): Row[] {
  if (!sort) return rows
  const col = visibleCols.find(c => c.key === sort.key)
  if (!col) return rows
  return [...rows].sort((a, b) => {
    const av = col.accessor(a)
    const bv = col.accessor(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    let cmp: number
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
    }
    return sort.dir === 'asc' ? cmp : -cmp
  })
}

const MIN_COL_WIDTH = 48

export function TableWidget<Row>({
  descriptor, config, onConfigChange,
}: {
  descriptor: TableWidgetDescriptor<Row>
  config: Record<string, unknown>
  onConfigChange?: (config: Record<string, unknown>) => void
}) {
  const router = useRouter()

  const allColumns: ColumnDef<Row>[] = descriptor.useColumns ? descriptor.useColumns() : (descriptor.columns ?? [])
  const cfg: TableWidgetConfig = useMemo(
    () => normalizeTableConfig(config as TableWidgetConfig, descriptor, allColumns),
    [config, descriptor, allColumns],
  )

  const { rows, loading } = descriptor.useRows(cfg)
  const filtered = useMemo(() => applyFilters(rows, cfg, descriptor.filters), [rows, cfg, descriptor.filters])
  const visibleCols = useMemo(() => resolveVisibleColumns(allColumns, cfg.columns), [allColumns, cfg.columns])

  const [sort, setSort] = useState<SortState>(null)
  const [search, setSearch] = useState('')

  const summary = descriptor.summary?.(filtered) ?? []

  // Apply search on top of filtered rows
  const searched = useMemo(() => {
    if (!search.trim()) return filtered
    const q = search.trim().toLowerCase()
    return filtered.filter(row =>
      visibleCols.some(c => {
        const v = c.accessor(row)
        return v != null && String(v).toLowerCase().includes(q)
      }),
    )
  }, [filtered, search, visibleCols])

  // Sort last
  const displayRows = useMemo(() => sortRows(searched, sort, visibleCols), [searched, sort, visibleCols])

  function toneColor(tone?: string): string {
    if (tone === 'warning') return 'var(--color-warning)'
    if (tone === 'danger') return 'var(--color-danger)'
    if (tone === 'accent') return 'var(--color-accent)'
    return 'var(--color-text-1)'
  }

  function handleHeaderClick(key: string) {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  // ── Column resize ─────────────────────────────────────────────────────────
  // Refs to each <th> so we can read rendered widths without layout thrash
  const thRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())

  // Live override during an active drag: { colKey → currentWidth }
  const [dragWidths, setDragWidths] = useState<Record<string, number>>({})
  const dragState = useRef<{
    key: string
    startX: number
    startWidth: number
  } | null>(null)

  // Merged column widths: persisted overrides + live drag override
  const mergedWidths: Record<string, number> = useMemo(() => {
    return { ...(cfg.columnWidths ?? {}), ...dragWidths }
  }, [cfg.columnWidths, dragWidths])

  // Only use fixed layout when at least one width is stored
  const hasPersistedWidths = Object.keys(cfg.columnWidths ?? {}).length > 0
  const isDragging = Object.keys(dragWidths).length > 0
  const useFixedLayout = hasPersistedWidths || isDragging

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, colKey: string) => {
    e.stopPropagation()
    e.preventDefault()

    const th = thRefs.current.get(colKey)
    const startWidth = th ? th.getBoundingClientRect().width : (mergedWidths[colKey] ?? 140)

    dragState.current = { key: colKey, startX: e.clientX, startWidth }
    // seed dragWidths with all current rendered widths so the table doesn't jump
    const snapshot: Record<string, number> = {}
    for (const col of visibleCols) {
      const el = thRefs.current.get(col.key)
      snapshot[col.key] = el ? el.getBoundingClientRect().width : (mergedWidths[col.key] ?? 140)
    }
    setDragWidths(snapshot)

    function onMouseMove(me: MouseEvent) {
      const ds = dragState.current
      if (!ds) return
      const delta = me.clientX - ds.startX
      const newWidth = Math.max(MIN_COL_WIDTH, ds.startWidth + delta)
      setDragWidths(prev => ({ ...prev, [ds.key]: newWidth }))
    }

    function onMouseUp(me: MouseEvent) {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      const ds = dragState.current
      if (!ds) return
      const delta = me.clientX - ds.startX
      const finalWidth = Math.max(MIN_COL_WIDTH, ds.startWidth + delta)
      dragState.current = null
      setDragWidths({})
      if (onConfigChange) {
        onConfigChange({
          ...config,
          columnWidths: {
            ...(cfg.columnWidths ?? {}),
            [ds.key]: finalWidth,
          },
        })
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [visibleCols, mergedWidths, cfg.columnWidths, config, onConfigChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {summary.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          {summary.map((s, i) => (
            <span key={i} style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
              <b style={{ fontSize: 'var(--fs-sm)', color: toneColor(s.tone) }}>{s.count}</b> {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Search box */}
      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          marginBottom: 6,
          padding: '3px 7px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-input, var(--color-bg-surface))',
          color: 'var(--color-text-1)',
          fontSize: 'var(--fs-xs)',
          fontFamily: 'inherit',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>…</div>}
        {!loading && displayRows.length === 0 && (
          <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '6px 0' }}>Nothing to show.</div>
        )}
        {!loading && displayRows.length > 0 && (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--fs-sm)',
            tableLayout: useFixedLayout ? 'fixed' : undefined,
          }}>
            {useFixedLayout && (
              <colgroup>
                {visibleCols.map(c => (
                  <col key={c.key} style={{ width: mergedWidths[c.key] ?? 140 }} />
                ))}
              </colgroup>
            )}
            <thead>
              <tr>
                {visibleCols.map(c => {
                  const isActive = sort?.key === c.key
                  const align = c.align ?? 'left'
                  return (
                    <th
                      key={c.key}
                      ref={el => {
                        if (el) thRefs.current.set(c.key, el)
                        else thRefs.current.delete(c.key)
                      }}
                      onClick={() => handleHeaderClick(c.key)}
                      style={{
                        position: 'relative',
                        textAlign: align,
                        padding: '2px 16px 4px 0',
                        fontSize: 'var(--fs-2xs)',
                        color: isActive ? 'var(--color-text-1)' : 'var(--color-text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 700,
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        overflow: useFixedLayout ? 'hidden' : undefined,
                        textOverflow: useFixedLayout ? 'ellipsis' : undefined,
                      }}
                    >
                      {c.label}
                      {isActive && (
                        <span style={{ marginLeft: 3, fontSize: 'var(--fs-2xs)' }}>
                          {sort?.dir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                      {/* Resize handle */}
                      <span
                        className="wt-col-resize"
                        onMouseDown={e => handleResizeMouseDown(e, c.key)}
                        onClick={e => { e.stopPropagation(); e.preventDefault() }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 5,
                          cursor: 'col-resize',
                          zIndex: 1,
                          // Subtle visual hint on hover via inline style — theme-neutral
                          background: 'transparent',
                        }}
                      />
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, ri) => {
                const cells = visibleCols.map(c => {
                  const raw = c.accessor(row)
                  const content = c.format ? c.format(raw, row) : (raw as React.ReactNode) ?? '—'
                  const align = c.align ?? 'left'
                  return (
                    <td key={c.key} style={{
                      textAlign: align,
                      padding: '4px 6px 4px 0',
                      color: 'var(--color-text-1)',
                      borderBottom: '1px solid var(--color-border)',
                      fontFamily: c.mono ? 'var(--font-family-mono)' : undefined,
                      maxWidth: useFixedLayout ? undefined : 180,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{content}</td>
                  )
                })
                const b = descriptor.row
                if (b.mode === 'deeplink') {
                  return (
                    <tr
                      key={ri}
                      onClick={() => router.push(b.href(row))}
                      style={{ cursor: 'pointer' }}
                    >
                      {cells}
                    </tr>
                  )
                }
                return (
                  <tr key={ri} style={{ cursor: 'default' }}>{cells}</tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {descriptor.footerHref && (
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
          {descriptor.newHref && <Link href={descriptor.newHref} style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>+ New</Link>}
          <Link href={descriptor.footerHref} style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
        </div>
      )}

    </div>
  )
}
