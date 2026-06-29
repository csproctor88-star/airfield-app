'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchOpenDiscrepanciesData } from '@/lib/reports/open-discrepancies-data'

interface Summary {
  total: number
  agingOver30: number
  topShop: string | null
}

export function ReportDiscrepanciesWidget() {
  const { installationId } = useInstallation()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    fetchOpenDiscrepanciesData(false, installationId, { status: 'open' }).then((data) => {
      const byShop = data.summary.byShop
      const entries = Object.entries(byShop).sort((a, b) => b[1] - a[1])
      const topShop = entries.length > 0 ? entries[0][0] : null
      setSummary({
        total: data.summary.total,
        agingOver30: data.summary.agingOver30,
        topShop,
      })
      setLoading(false)
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 8, alignItems: 'flex-end', justifyContent: 'center' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Open</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.total ?? 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Aging {'>'} 30d</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: (!loading && summary && summary.agingOver30 > 0) ? 'var(--color-status-fail)' : 'var(--color-text-1)' }}>
            {loading ? '…' : (summary?.agingOver30 ?? 0)}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {!loading && summary && summary.total === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No open discrepancies.</div>
        )}
        {!loading && summary && summary.total > 0 && summary.topShop && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
            Top shop: <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{summary.topShop}</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/discrepancies" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}
