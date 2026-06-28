import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchRecentReviews, type DailyReviewRow } from '@/lib/supabase/daily-reviews'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const SLOTS = ['day_amsl', 'swing_amsl', 'mid_amsl', 'namo', 'afm'] as const
function pendingSlots(r: DailyReviewRow): number {
  return SLOTS.filter(s => r[`${s}_signed_at` as keyof DailyReviewRow] == null).length
}
function fmtDate(iso: string): string { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y.slice(2)}` }

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<DailyReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchRecentReviews(installationId, 7).then(all => { setRows(all); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const dailyReviewsDescriptor: TableWidgetDescriptor<DailyReviewRow> = {
  columns: [
    { key: 'review_date', label: 'Date', accessor: r => r.review_date, format: v => fmtDate(v as string), mono: true, defaultVisible: true },
    { key: 'pending', label: 'Pending', accessor: r => pendingSlots(r), format: v => `${v} slot${v === 1 ? '' : 's'}`, defaultVisible: true },
    { key: 'certified', label: 'Certified', accessor: r => r.fully_certified_at ? 'Yes' : 'No', defaultVisible: true },
  ],
  filters: [
    { key: 'state', label: 'State', kind: 'status', defaultSelected: ['pending'],
      options: [{ value: 'pending', label: 'Pending' }, { value: 'certified', label: 'Certified' }],
      predicate: (r, sel) => {
        const s = sel as string[]
        const isCert = r.fully_certified_at != null
        return (isCert && s.includes('certified')) || (!isCert && s.includes('pending'))
      } },
  ],
  row: { mode: 'deeplink', href: () => '/daily-reviews' },
  summary: rows => [{ count: rows.filter(r => r.fully_certified_at == null).length, label: 'pending', tone: 'warning' }],
  footerHref: '/daily-reviews',
  useRows,
}
