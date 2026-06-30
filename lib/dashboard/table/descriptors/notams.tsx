import { useCallback, useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

interface NotamRow {
  id: string; notam_number: string; source: 'faa' | 'local'; status: 'active' | 'expired'
  title: string; full_text?: string; effective_start?: string; effective_end: string
}

const lastSync = new Map<string, { at: number; rows: NotamRow[] }>()
function expiresSoon(end: string): boolean {
  if (!end || end.toUpperCase() === 'PERM') return false
  const m = end.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})(\d{2})$/)
  const p = m ? new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5])) : new Date(end)
  if (isNaN(p.getTime())) return false
  const diff = p.getTime() - Date.now()
  return diff > 0 && diff <= 86_400_000
}

function useRows(_c: TableWidgetConfig) {
  const { currentInstallation } = useInstallation()
  const icao = currentInstallation?.icao || ''
  const [rows, setRows] = useState<NotamRow[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!icao || !createClient()) { setLoading(false); return }
    const cached = lastSync.get(icao)
    if (cached && Date.now() - cached.at < 60_000) { setRows(cached.rows); setLoading(false); return }
    try {
      const res = await fetch(`/api/notams/sync?icao=${encodeURIComponent(icao)}`)
      if (res.ok) {
        const data = await res.json()
        const active: NotamRow[] = (data.notams || []).filter((n: NotamRow) => n.status === 'active')
        lastSync.set(icao, { at: Date.now(), rows: active })
        setRows(active)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [icao])
  useEffect(() => { load() }, [load])
  return { rows, loading }
}

export const notamsDescriptor: TableWidgetDescriptor<NotamRow> = {
  columns: [
    { key: 'notam_number', label: 'NOTAM', accessor: r => r.notam_number, mono: true, defaultVisible: true },
    { key: 'text', label: 'Text', accessor: r => r.full_text || r.title, mono: true, wrap: true, defaultVisible: true },
    { key: 'effective_end', label: 'Valid until', accessor: r => r.effective_end, defaultVisible: true },
  ],
  // /notams is an FAA-feed-only module — there is no "local" source, so no source filter.
  filters: [
    { key: 'expiring', label: 'Expiring ≤24h', kind: 'enum-multi',
      options: [{ value: 'yes', label: 'Expiring soon' }],
      predicate: r => expiresSoon(r.effective_end) },
  ],
  row: { mode: 'deeplink', href: r => `/notams/${r.id}` },
  summary: rows => {
    const soon = rows.filter(n => expiresSoon(n.effective_end))
    return [{ count: rows.length, label: 'active' }, ...(soon.length ? [{ count: soon.length, label: 'expiring', tone: 'warning' as const }] : [])]
  },
  footerHref: '/notams',
  useRows,
}
