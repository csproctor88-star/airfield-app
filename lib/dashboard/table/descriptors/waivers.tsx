import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchWaivers, type WaiverRow } from '@/lib/supabase/waivers'
import { formatZuluDate } from '@/lib/utils'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const ACTIVE = new Set(['active', 'approved'])
function daysToExpiry(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<WaiverRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchWaivers(installationId).then(all => { setRows(all); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const waiversDescriptor: TableWidgetDescriptor<WaiverRow> = {
  columns: [
    { key: 'waiver_number', label: 'Waiver #', accessor: r => r.waiver_number, mono: true, defaultVisible: true },
    { key: 'classification', label: 'Class', accessor: r => r.classification, format: v => titleCase(v as string), defaultVisible: true },
    { key: 'status', label: 'Status', accessor: r => r.status, format: v => titleCase(v as string), defaultVisible: true },
    { key: 'expiration_date', label: 'Expires', accessor: r => r.expiration_date,
      format: v => v ? formatZuluDate(v as string) : '—', defaultVisible: true },
  ],
  filters: [
    { key: 'status', label: 'Status', kind: 'status', defaultSelected: ['active', 'approved'],
      options: ['active', 'approved', 'draft', 'pending', 'expired', 'cancelled'].map(s => ({ value: s, label: titleCase(s) })),
      predicate: (r, sel) => (sel as string[]).includes(r.status) },
    { key: 'classification', label: 'Classification', kind: 'text',
      predicate: (r, sel) => r.classification.toLowerCase().includes((sel as string).toLowerCase()) },
    { key: 'expiring', label: 'Expiring ≤90d', kind: 'enum-multi',
      options: [{ value: 'yes', label: 'Expiring soon' }],
      predicate: r => { const d = daysToExpiry(r.expiration_date); return d !== null && d >= 0 && d <= 90 } },
  ],
  row: { mode: 'deeplink', href: r => `/waivers/${r.id}` },
  summary: rows => {
    const active = rows.filter(w => ACTIVE.has(w.status))
    const expiring = active.filter(w => { const d = daysToExpiry(w.expiration_date); return d !== null && d >= 0 && d <= 90 })
    return [{ count: active.length, label: 'active' }, ...(expiring.length ? [{ count: expiring.length, label: 'expiring', tone: 'warning' as const }] : [])]
  },
  footerHref: '/waivers',
  newHref: '/waivers/new',
  useRows,
}
