'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchAnalyticsData } from '@/lib/reports/analytics-data'

interface Summary {
  inspections: number
  checks: number
  discrepanciesOpened: number
}

export function ReportDailyWidget() {
  const { installationId } = useInstallation()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    // Use a 30-day window — fetchAnalyticsData's fields (openedLast30, etc.) are
    // designed for this window. A 1-day window produces near-zero values most days.
    fetchAnalyticsData(installationId, 30).then((data) => {
      setSummary({
        inspections: data.airfieldInspections.completed + data.lightingInspections.completed,
        checks: data.checks.last30Days,
        discrepanciesOpened: data.discrepancies.openedLast30,
      })
      setLoading(false)
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 8, alignItems: 'flex-end', justifyContent: 'center' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inspections</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.inspections ?? 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Checks</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.checks ?? 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New Discrep.</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.discrepanciesOpened ?? 0)}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Last 30 days</div>
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/daily" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}
