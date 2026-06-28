'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancyTrendsData } from '@/lib/reports/discrepancy-trends-data'

interface Summary {
  totalOpened: number
  totalClosed: number
  net: number
  avgDaysToClose: number | null
}

export function ReportTrendsWidget() {
  const { installationId } = useInstallation()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    fetchDiscrepancyTrendsData('30d', installationId).then((data) => {
      setSummary({
        totalOpened: data.summary.totalOpened,
        totalClosed: data.summary.totalClosed,
        net: data.summary.net,
        avgDaysToClose: data.summary.avgDaysToClose,
      })
      setLoading(false)
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 8, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opened</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.totalOpened ?? 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Closed</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.totalClosed ?? 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Net</div>
          <div style={{
            fontSize: 'var(--fs-lg)', fontWeight: 800,
            color: !loading && summary && summary.net > 0
              ? 'var(--color-status-fail)'
              : !loading && summary && summary.net < 0
                ? 'var(--color-status-pass)'
                : 'var(--color-text-1)',
          }}>
            {loading ? '…' : (summary ? (summary.net > 0 ? `+${summary.net}` : String(summary.net)) : '0')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
        {!loading && summary && summary.avgDaysToClose != null && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
            Avg close time: <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{summary.avgDaysToClose}d</span>
          </div>
        )}
        {!loading && summary && summary.totalOpened === 0 && summary.totalClosed === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No activity in last 30 days.</div>
        )}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/trends" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}
