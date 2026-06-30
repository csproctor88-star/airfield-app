'use client'

import { formatDiscrepancyType } from '@/lib/reports/open-discrepancies-data'
import type { DiscrepancyTrendsData } from '@/lib/reports/discrepancy-trends-data'

// Presentational discrepancy-trends view — the body of app/(app)/reports/trends/page.tsx,
// lifted so the dashboard widget renders the same thing. No fetching, no export.
export function TrendsReportView({ data }: { data: DiscrepancyTrendsData }) {
  const { summary, buckets } = data
  const maxVal = Math.max(...buckets.map((bb) => Math.max(bb.opened, bb.closed)), 1)

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{summary.totalOpened}</div>
          <div className="kpi-label">Opened</div>
        </div>
        <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
          <div className="kpi-value" style={{ color: 'var(--color-status-pass)' }}>{summary.totalClosed}</div>
          <div className="kpi-label">Closed</div>
        </div>
        <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
          <div className="kpi-value" style={{ color: summary.net > 0 ? 'var(--color-danger)' : summary.net < 0 ? 'var(--color-status-pass)' : 'var(--color-text-3)' }}>
            {summary.net >= 0 ? '+' : ''}{summary.net}
          </div>
          <div className="kpi-label">Net</div>
        </div>
        {summary.avgDaysToClose !== null && (
          <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
            <div className="kpi-value" style={{ color: 'var(--color-purple)' }}>{summary.avgDaysToClose}</div>
            <div className="kpi-label">Avg Days</div>
          </div>
        )}
      </div>

      {/* Trend Bars */}
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Opened vs Closed
        </div>
        {buckets.map((b) => (
          <div key={b.label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)' }}>{b.label}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                <span style={{ color: 'var(--color-danger)' }}>{b.opened}</span>
                {' / '}
                <span style={{ color: 'var(--color-status-pass)' }}>{b.closed}</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 3, height: 6 }}>
              <div style={{ width: `${(b.opened / maxVal) * 100}%`, background: 'var(--color-danger)', borderRadius: 3, minWidth: b.opened > 0 ? 4 : 0 }} />
              <div style={{ width: `${(b.closed / maxVal) * 100}%`, background: 'var(--color-status-pass)', borderRadius: 3, minWidth: b.closed > 0 ? 4 : 0 }} />
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-danger)' }} />
            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>Opened</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-status-pass)' }} />
            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>Closed</span>
          </div>
        </div>
      </div>

      {/* Top Areas */}
      {summary.topAreas.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Top Areas
          </div>
          <div className="badge-grid">
            {summary.topAreas.map((a) => (
              <div key={a.area} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--color-purple) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-purple) 15%, transparent)', minWidth: 64 }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-purple)' }}>{a.count}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{a.area}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Types */}
      {summary.topTypes.length > 0 && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Top Types
          </div>
          <div className="badge-grid">
            {summary.topTypes.map((t) => (
              <div key={t.type} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: 10, background: 'color-mix(in srgb, var(--color-purple) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-purple) 15%, transparent)', minWidth: 64 }}>
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-purple)' }}>{t.count}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{formatDiscrepancyType(t.type)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
