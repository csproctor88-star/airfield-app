'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import {
  fetchRecentReviews,
  type DailyReviewRow,
} from '@/lib/supabase/daily-reviews'
import type { TableWidgetDescriptor, TableWidgetConfig, CustomRowCtx } from '@/lib/dashboard/table/types'
import DailyReviewSignModal from '@/components/daily-reviews/sign-modal'

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

/**
 * Inner component that mounts the existing SignModal with the same props
 * the daily-reviews page passes. Hooks are only allowed inside components,
 * not in the descriptor's render() callback, so we isolate them here.
 */
function DailyReviewWidgetSignModal({
  row,
  ctx,
}: {
  row: DailyReviewRow
  ctx: CustomRowCtx
}) {
  const { installationId, currentInstallation } = useInstallation()
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  // Same auth + profile fetch as the daily-reviews page
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      supabase.from('profiles').select('name').eq('id', data.user.id).single().then(({ data: profile }) => {
        if (profile) setUserName((profile as { name?: string }).name || '')
      })
    })
  }, [])

  if (!installationId) return null

  // Derive the same values the page reads from currentInstallation
  const shiftCount = (currentInstallation as { shift_count?: number } | null)?.shift_count ?? 2
  const baseName = currentInstallation?.name || ''
  const baseIcao = (currentInstallation as { icao?: string | null } | null)?.icao || null
  const timezone = (currentInstallation as { timezone?: string | null } | null)?.timezone || null
  const resetTime = (currentInstallation as { checklist_reset_time?: string | null } | null)?.checklist_reset_time || null

  if (!userId) return null

  return (
    <DailyReviewSignModal
      open={true}
      onClose={ctx.onClose}
      baseId={installationId}
      baseName={baseName}
      baseIcao={baseIcao}
      shiftCount={shiftCount}
      reviewDate={row.review_date}
      timezone={timezone}
      resetTime={resetTime}
      userId={userId}
      userName={userName}
      onSigned={ctx.onActed}
    />
  )
}

export const dailyReviewsDescriptor: TableWidgetDescriptor<DailyReviewRow> = {
  columns: [
    { key: 'review_date', label: 'Date', accessor: r => r.review_date, format: v => fmtDate(v as string), mono: true, defaultVisible: true },
    { key: 'pending', label: 'Pending', accessor: r => pendingSlots(r), format: v => `${v} slot${v === 1 ? '' : 's'}`, align: 'right', defaultVisible: true },
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
  row: {
    mode: 'custom',
    render: (row, ctx) => <DailyReviewWidgetSignModal row={row} ctx={ctx} />,
  },
  summary: rows => [{ count: rows.filter(r => r.fully_certified_at == null).length, label: 'pending', tone: 'warning' }],
  footerHref: '/daily-reviews',
  useRows,
}
