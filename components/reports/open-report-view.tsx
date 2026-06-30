'use client'

import { formatDiscrepancyType, type OpenDiscrepanciesData } from '@/lib/reports/open-discrepancies-data'

const sortDesc = (rec: Record<string, number>) => Object.entries(rec).sort((a, b) => b[1] - a[1])

// One breakdown column: a titled mini-table of label → count rows, each with a
// proportional bar so the distribution reads at a glance. Labels WRAP (never
// truncate) — discrepancy *type* values can be comma-joined multi-types
// (e.g. "FOD Hazard, Pavement"), which an inline comma-separated list rendered
// both cramped and ambiguous (was the value a multi-type or two categories?).
function Breakdown({ title, rows, format }: { title: string; rows: [string, number][]; format?: (k: string) => string }) {
  if (rows.length === 0) return null
  const max = rows[0][1] || 1
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>{rows.length}</span>
      </div>
      {rows.map(([key, count], i) => (
        <div key={key} style={{ padding: '4px 0', borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.3 }}>{format ? format(key) : key}</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text-1)', flexShrink: 0 }}>{count}</span>
          </div>
          <div style={{ marginTop: 4, height: 3, borderRadius: 2, minWidth: 4, width: `${Math.max((count / max) * 100, 3)}%`, background: 'color-mix(in srgb, var(--color-accent) 50%, transparent)' }} />
        </div>
      ))}
    </div>
  )
}

// Presentational discrepancy-report view — the results body of
// app/(app)/reports/discrepancies/page.tsx: total + aging callout + By Area /
// By Type / By Shop breakdowns. No fetching, no filter card, no export.
// `filterLabel` (optional) renders the active-filter caption the report page
// shows under the count; the dashboard widget omits it.
export function OpenReportView({ data, filterLabel }: { data: OpenDiscrepanciesData; filterLabel?: string }) {
  const { summary } = data
  return (
    <div>
      {/* Count + aging callout */}
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>{summary.total}</span>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>discrepancies</span>
        </div>
        {filterLabel && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{filterLabel}</div>
        )}
        {summary.agingOver30 > 0 && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', fontWeight: 600, marginTop: 4 }}>
            {summary.agingOver30} open &gt; 30 days
          </div>
        )}
      </div>

      {/* Breakdowns — three mini-tables, side-by-side on wide layouts (the
          report page) and stacked on narrow ones (the dashboard widget). */}
      {summary.total > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10, alignItems: 'start' }}>
          <Breakdown title="By Area" rows={sortDesc(summary.byArea)} />
          <Breakdown title="By Type" rows={sortDesc(summary.byType)} format={formatDiscrepancyType} />
          <Breakdown title="By Shop" rows={sortDesc(summary.byShop)} />
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          No discrepancies match these filters.
        </div>
      )}
    </div>
  )
}
