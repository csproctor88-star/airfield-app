'use client'

import { formatDiscrepancyType, type OpenDiscrepanciesData } from '@/lib/reports/open-discrepancies-data'

const sortDesc = (rec: Record<string, number>) => Object.entries(rec).sort((a, b) => b[1] - a[1])

// Presentational discrepancy-report view — the results body of
// app/(app)/reports/discrepancies/page.tsx: total + aging callout + By Area /
// By Type / By Shop breakdowns. No fetching, no filter card, no export.
export function OpenReportView({ data }: { data: OpenDiscrepanciesData }) {
  const { summary } = data
  return (
    <div>
      {/* Count + aging callout */}
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>{summary.total}</span>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>discrepancies</span>
        </div>
        {summary.agingOver30 > 0 && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', fontWeight: 600, marginTop: 4 }}>
            {summary.agingOver30} open &gt; 30 days
          </div>
        )}
      </div>

      {/* Breakdowns */}
      {summary.total > 0 ? (
        <div className="card" style={{ padding: 14, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
          {sortDesc(summary.byArea).length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--color-text-3)', marginRight: 6 }}>By Area:</span>
              {sortDesc(summary.byArea).map(([area, count]) => `${area} (${count})`).join(', ')}
            </div>
          )}
          {sortDesc(summary.byType).length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--color-text-3)', marginRight: 6 }}>By Type:</span>
              {sortDesc(summary.byType).map(([type, count]) => `${formatDiscrepancyType(type)} (${count})`).join(', ')}
            </div>
          )}
          {sortDesc(summary.byShop).length > 0 && (
            <div>
              <span style={{ fontWeight: 700, color: 'var(--color-text-3)', marginRight: 6 }}>By Shop:</span>
              {sortDesc(summary.byShop).map(([shop, count]) => `${shop} (${count})`).join(', ')}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          No discrepancies match these filters.
        </div>
      )}
    </div>
  )
}
