'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchAgingDiscrepanciesData, type AgingDiscrepanciesData } from '@/lib/reports/aging-discrepancies-data'
import { AgingReportView } from '@/components/reports/aging-report-view'

export function ReportAgingWidget() {
  const { installationId } = useInstallation()
  const [data, setData] = useState<AgingDiscrepanciesData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    setLoading(true)
    fetchAgingDiscrepanciesData(installationId).then((d) => {
      if (!cancelled) { setData(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
          : data ? <AgingReportView data={data} />
          : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No data.</div>}
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/aging" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}
