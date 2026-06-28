'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/lib/permissions'
import type { TableWidgetConfig, TableWidgetDescriptor, RowActionCtx, ColumnDef } from '@/lib/dashboard/table/types'
import { resolveVisibleColumns } from '@/lib/dashboard/table/columns'
import { applyFilters } from '@/lib/dashboard/table/filtering'
import { normalizeTableConfig } from '@/lib/dashboard/table/config'
import { RowDetailDialog } from './row-detail-dialog'

export function TableWidget<Row>({
  descriptor, config,
}: { descriptor: TableWidgetDescriptor<Row>; config: Record<string, unknown> }) {
  const { installationId } = useInstallation()
  const { has } = usePermissions()

  const allColumns: ColumnDef<Row>[] = descriptor.useColumns ? descriptor.useColumns() : (descriptor.columns ?? [])
  const cfg: TableWidgetConfig = useMemo(
    () => normalizeTableConfig(config as TableWidgetConfig, descriptor, allColumns),
    [config, descriptor, allColumns],
  )

  const { rows, loading } = descriptor.useRows(cfg)
  const filtered = useMemo(() => applyFilters(rows, cfg, descriptor.filters), [rows, cfg, descriptor.filters])
  const visibleCols = useMemo(() => resolveVisibleColumns(allColumns, cfg.columns), [allColumns, cfg.columns])

  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null))
  }, [])
  const ctx: RowActionCtx | null = installationId && userId ? { baseId: installationId, userId } : null

  const [detailRow, setDetailRow] = useState<Row | null>(null)
  const summary = descriptor.summary?.(filtered) ?? []

  function toneColor(tone?: string): string {
    if (tone === 'warning') return 'var(--color-warning)'
    if (tone === 'danger') return 'var(--color-danger)'
    if (tone === 'accent') return 'var(--color-accent)'
    return 'var(--color-text-1)'
  }

  function onRowClick(row: Row) {
    const b = descriptor.row
    if (b.mode === 'deeplink') return // handled by <Link> wrapper
    if (b.mode === 'detail' || b.mode === 'detail+actions') setDetailRow(row)
  }

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

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '6px 0' }}>Nothing to show.</div>
        )}
        {!loading && filtered.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr>
                {visibleCols.map(c => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '2px 6px 4px 0', fontSize: 'var(--fs-2xs)',
                    color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, ri) => {
                const cells = visibleCols.map(c => {
                  const raw = c.accessor(row)
                  const content = c.format ? c.format(raw, row) : (raw as React.ReactNode) ?? '—'
                  return (
                    <td key={c.key} style={{ padding: '4px 6px 4px 0', color: 'var(--color-text-1)', borderBottom: '1px solid var(--color-border)',
                      fontFamily: c.mono ? 'var(--font-family-mono)' : undefined, maxWidth: 180,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content}</td>
                  )
                })
                const b = descriptor.row
                if (b.mode === 'deeplink') {
                  return (
                    <tr key={ri} style={{ cursor: 'pointer' }}>
                      <td colSpan={visibleCols.length} style={{ padding: 0 }}>
                        <Link href={b.href(row)} style={{ display: 'table', width: '100%', textDecoration: 'none', tableLayout: 'fixed' }}>
                          <span style={{ display: 'table-row' }}>{cells}</span>
                        </Link>
                      </td>
                    </tr>
                  )
                }
                const clickable = b.mode === 'detail' || b.mode === 'detail+actions'
                return (
                  <tr key={ri} onClick={clickable ? () => onRowClick(row) : undefined}
                    style={{ cursor: clickable ? 'pointer' : 'default' }}>{cells}</tr>
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

      {detailRow && (descriptor.row.mode === 'detail' || descriptor.row.mode === 'detail+actions') && (
        <RowDetailDialog
          row={detailRow}
          title={descriptor.row.title(detailRow)}
          fields={descriptor.row.fields}
          actions={descriptor.row.mode === 'detail+actions' ? descriptor.row.actions : undefined}
          ctx={ctx}
          has={has}
          onClose={() => setDetailRow(null)}
          onActed={() => toast.success('Saved.')}
        />
      )}
    </div>
  )
}
