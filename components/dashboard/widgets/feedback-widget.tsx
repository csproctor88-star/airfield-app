'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchFeedbackStats } from '@/lib/supabase/feedback'

interface Stats {
  total: number
  avgRating: number | null
  recentCount: number
}

function starBar(avg: number | null): string {
  if (avg == null) return '—'
  const filled = Math.round(avg)
  return '★'.repeat(filled) + '☆'.repeat(Math.max(0, 5 - filled))
}

export function FeedbackWidget() {
  const { installationId } = useInstallation()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    fetchFeedbackStats(installationId, 30).then((data) => {
      setStats(data)
      setLoading(false)
    })
  }, [installationId])

  const avgDisplay = stats?.avgRating != null ? stats.avgRating.toFixed(1) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary header */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
            {loading ? '…' : (stats?.total ?? 0)}
          </div>
        </div>
        {avgDisplay && (
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg Rating</div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-warning)' }}>
              {avgDisplay}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
        {!loading && stats && stats.total === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No feedback received yet.</div>
        )}
        {!loading && stats && stats.total > 0 && (
          <>
            {avgDisplay && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--fs-base)', color: 'var(--color-warning)', letterSpacing: 2 }}>
                  {starBar(stats.avgRating)}
                </span>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                  avg over {stats.total} response{stats.total !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {stats.recentCount > 0 && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{stats.recentCount}</span> received in the last 30 days
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/feedback" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
      </div>
    </div>
  )
}
