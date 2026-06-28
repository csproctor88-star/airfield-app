'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchRecentReviews, type DailyReviewRow } from '@/lib/supabase/daily-reviews'

const SLOTS = ['day_amsl', 'swing_amsl', 'mid_amsl', 'namo', 'afm'] as const
type Slot = typeof SLOTS[number]

function pendingSlots(row: DailyReviewRow): number {
  return SLOTS.filter((s) => row[`${s}_signed_at` as keyof DailyReviewRow] == null).length
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y.slice(2)}`
}

export function DailyReviewsWidget() {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<DailyReviewRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchRecentReviews(installationId, 7).then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [installationId])

  const pending = rows.filter((r) => r.fully_certified_at == null)
  const certified = rows.filter((r) => r.fully_certified_at != null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Pending Sign-Off (7d)
        </span>
        <span style={{
          fontSize: 'var(--fs-lg)', fontWeight: 800,
          color: pending.length > 0 ? 'var(--color-warning)' : 'var(--color-text-3)',
        }}>
          {loading ? '…' : pending.length}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!loading && rows.length === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '4px 0' }}>No reviews in the last 7 days.</div>
        )}
        {pending.map((r) => {
          const missing = pendingSlots(r)
          return (
            <Link key={r.id} href="/daily-reviews" style={{
              display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0',
              borderBottom: '1px solid var(--color-border)', textDecoration: 'none',
              fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
            }}>
              <span style={{ fontFamily: 'var(--font-family-mono)' }}>{fmtDate(r.review_date)}</span>
              <span style={{ flexShrink: 0, fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-warning)' }}>
                {missing} slot{missing !== 1 ? 's' : ''} pending
              </span>
            </Link>
          )
        })}
        {certified.length > 0 && (
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
            {certified.length} certified in last 7d
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/daily-reviews" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
      </div>
    </div>
  )
}
