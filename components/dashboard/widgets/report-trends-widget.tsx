'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancyTrendsData, type DiscrepancyTrendsData, type TrendPeriod } from '@/lib/reports/discrepancy-trends-data'
import { TrendsReportView } from '@/components/reports/trends-report-view'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
]

export function ReportTrendsWidget({ config }: WidgetProps) {
  const { installationId } = useInstallation()
  const period = (config?.period as TrendPeriod) || '30d'
  const [data, setData] = useState<DiscrepancyTrendsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    setLoading(true)
    fetchDiscrepancyTrendsData(period, installationId).then((d) => {
      if (!cancelled) { setData(d); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [installationId, period])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
          : data ? <TrendsReportView data={data} />
          : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No data.</div>}
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/trends" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}

export function ReportTrendsConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as { title?: string; period?: TrendPeriod }
  const [title, setTitle] = useState(c.title ?? '')
  const [period, setPeriod] = useState<TrendPeriod>(c.period ?? '30d')

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <select style={input} value={period} onChange={(e) => setPeriod(e.target.value as TrendPeriod)}>
        {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ ...config, title: title.trim() || undefined, period })}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
