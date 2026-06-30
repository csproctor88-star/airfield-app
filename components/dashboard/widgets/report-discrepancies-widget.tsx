'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchOpenDiscrepanciesData, type OpenDiscrepanciesData, type DiscrepancyReportFilters } from '@/lib/reports/open-discrepancies-data'
import { OpenReportView } from '@/components/reports/open-report-view'
import { DISCREPANCY_TYPES } from '@/lib/constants'
import { getDiscrepancyStatusOptions } from '@/lib/airport-mode'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

export function ReportDiscrepanciesWidget({ config }: WidgetProps) {
  const { installationId } = useInstallation()
  const filters = ((config?.filters as DiscrepancyReportFilters) || { status: 'open' })
  const filterKey = JSON.stringify(filters)
  const [data, setData] = useState<OpenDiscrepanciesData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    setLoading(true)
    // skipMedia=true — the widget only needs the summary breakdown, not photos/maps.
    fetchOpenDiscrepanciesData(false, installationId, filters, true).then((d) => {
      if (!cancelled) { setData(d); setLoading(false) }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, filterKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
          : data ? <OpenReportView data={data} />
          : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No data.</div>}
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/discrepancies" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}

export function ReportDiscrepanciesConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const { currentInstallation, ceShops, areas } = useInstallation()
  const c = config as { title?: string; filters?: DiscrepancyReportFilters }
  const f = c.filters ?? { status: 'open' }
  const [title, setTitle] = useState(c.title ?? '')
  const [status, setStatus] = useState(f.status ?? 'open')
  const [currentStatus, setCurrentStatus] = useState(f.currentStatus ?? 'all')
  const [type, setType] = useState(f.type ?? 'all')
  const [shop, setShop] = useState(f.shop ?? 'all')
  const [location, setLocation] = useState(f.location ?? 'all')

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const label: React.CSSProperties = { fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 3, display: 'block' }

  const save = () => onSave({
    ...config,
    title: title.trim() || undefined,
    filters: { status, currentStatus, type, shop, location } as DiscrepancyReportFilters,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div>
        <span style={label}>Status</span>
        <select style={input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All</option>
        </select>
      </div>
      <div>
        <span style={label}>Workflow Status</span>
        <select style={input} value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value)}>
          <option value="all">All</option>
          {getDiscrepancyStatusOptions(currentInstallation).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <span style={label}>Type</span>
        <select style={input} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All Types</option>
          {DISCREPANCY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <span style={label}>Assigned Shop</span>
        <select style={input} value={shop} onChange={(e) => setShop(e.target.value)}>
          <option value="all">All Shops</option>
          {ceShops.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <span style={label}>Location</span>
        <select style={input} value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="all">All Locations</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={save} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
