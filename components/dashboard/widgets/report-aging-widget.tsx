'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchAgingDiscrepanciesData } from '@/lib/reports/aging-discrepancies-data'

interface Summary {
  total: number
  avgDaysOpen: number | null
  ninetyPlusCount: number
  oldestDays: number | null
}

export function ReportAgingWidget() {
  const { installationId } = useInstallation()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    fetchAgingDiscrepanciesData(installationId).then((data) => {
      // Find the "90+" tier — label includes "90"
      const ninetyTier = data.tiers.find((t) => t.label.includes('90') && t.min >= 90)
      const ninetyPlusCount = ninetyTier ? ninetyTier.discrepancies.length : 0
      setSummary({
        total: data.summary.total,
        avgDaysOpen: data.summary.avgDaysOpen,
        ninetyPlusCount,
        oldestDays: data.summary.oldest?.days_open ?? null,
      })
      setLoading(false)
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 8, alignItems: 'flex-end', justifyContent: 'center' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Open</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.total ?? 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>90+ Days</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: (!loading && summary && summary.ninetyPlusCount > 0) ? 'var(--color-status-fail)' : 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.ninetyPlusCount ?? 0)}
          </div>
        </div>
        {!loading && summary && summary.avgDaysOpen != null && (
          <div>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg Days</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              {summary.avgDaysOpen}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {!loading && summary && summary.total === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No open discrepancies.</div>
        )}
        {!loading && summary && summary.oldestDays != null && summary.total > 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
            Oldest: <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{summary.oldestDays}d</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/aging" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}
