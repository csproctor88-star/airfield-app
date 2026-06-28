'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchLightingReportData } from '@/lib/reports/lighting-report-data'

interface Summary {
  totalFeatures: number
  totalInoperative: number
  operationalPct: number | null
}

export function ReportLightingWidget() {
  const { installationId } = useInstallation()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    fetchLightingReportData(installationId).then((data) => {
      const operationalPct = data.totalFeatures > 0
        ? Math.round(((data.totalFeatures - data.totalInoperative) / data.totalFeatures) * 100)
        : null
      setSummary({
        totalFeatures: data.totalFeatures,
        totalInoperative: data.totalInoperative,
        operationalPct,
      })
      setLoading(false)
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 8, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.totalFeatures ?? 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inoperative</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: (!loading && summary && summary.totalInoperative > 0) ? 'var(--color-status-fail)' : 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.totalInoperative ?? 0)}
          </div>
        </div>
        {!loading && summary && summary.operationalPct != null && (
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Operational</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: summary.operationalPct === 100 ? 'var(--color-status-pass)' : 'var(--color-warning)' }}>
              {summary.operationalPct}%
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
        {!loading && summary && summary.totalFeatures === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No lighting features configured.</div>
        )}
        {!loading && summary && summary.totalFeatures > 0 && summary.totalInoperative === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-status-pass)' }}>All lights operational.</div>
        )}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/lighting" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}
