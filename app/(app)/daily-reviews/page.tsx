'use client'

import { useCallback, useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import {
  fetchRecentReviews,
  fetchSignersForRows,
  formatSigner,
  requiredSlotsForShifts,
  isFullyCertified,
  getEffectiveReviewDate,
  SLOT_LABELS,
  type DailyReviewRow,
  type DailyReviewSlot,
  type SignerInfo,
} from '@/lib/supabase/daily-reviews'
import DailyReviewSignModal from '@/components/daily-reviews/sign-modal'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { WRITE_COMMITTED_EVENT, type WriteCommittedDetail } from '@/lib/sync/write-queue'
import { Check } from 'lucide-react'

export default function DailyReviewsPage() {
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()
  const shiftCount = (currentInstallation as { shift_count?: number } | null)?.shift_count ?? 2
  const baseName = currentInstallation?.name || ''
  const baseIcao = (currentInstallation as { icao?: string | null } | null)?.icao || null
  const baseTimezone = (currentInstallation as { timezone?: string | null } | null)?.timezone || null
  const baseResetTime = (currentInstallation as { checklist_reset_time?: string | null } | null)?.checklist_reset_time || null

  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<DailyReviewRow[]>([])
  const [signerMap, setSignerMap] = useState<Map<string, SignerInfo>>(new Map())
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [signOpen, setSignOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')

  const load = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    const supabase = createClient()
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
        if (profile) setUserName((profile as { name?: string }).name || '')
      }
    }
    const reviews = await fetchRecentReviews(installationId, 30)
    setRows(reviews)
    setSignerMap(await fetchSignersForRows(reviews))
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  // Re-fetch when a daily_review_sign drains from the offline queue.
  useEffect(() => {
    const onCommit = (e: Event) => {
      const detail = (e as CustomEvent<WriteCommittedDetail>).detail
      if (detail?.type === 'daily_review_sign') void load()
    }
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)
    return () => window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
  }, [load])

  // Build list: every date from today back 14 days (surfaces days with no
  // row yet). "Today" honors the base's local reset time, not Zulu midnight.
  const visibleDates: string[] = (() => {
    const todayIso = getEffectiveReviewDate(baseTimezone, baseResetTime)
    const [y, m, d] = todayIso.split('-').map(Number)
    const dates: string[] = []
    for (let i = 0; i < 14; i++) {
      const day = new Date(Date.UTC(y, m - 1, d))
      day.setUTCDate(day.getUTCDate() - i)
      dates.push(day.toISOString().slice(0, 10))
    }
    return dates
  })()

  const rowByDate = new Map(rows.map((r) => [r.review_date, r] as const))

  const required = requiredSlotsForShifts(shiftCount)

  const openSign = (date: string) => {
    setSelectedDate(date)
    setSignOpen(true)
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
        Daily Reviews
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16 }}>
        DAFMAN 13-204v1 Para 2.5.2.10.3 & 10.4 — shift turnover + daily review.
      </div>

      {!loaded ? (
        <LoadingState message="Loading reviews…" />
      ) : !installationId ? (
        <EmptyState message="Select an installation to view daily reviews." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleDates.map((date) => {
            const row = rowByDate.get(date) ?? null
            const certified = row ? isFullyCertified(row, shiftCount) : false
            return (
              <div
                key={date}
                onClick={() => openSign(date)}
                style={{
                  padding: 12, borderRadius: 'var(--radius-md)',
                  background: certified
                    ? 'color-mix(in srgb, var(--color-success) 8%, transparent)'
                    : 'var(--color-bg-surface)',
                  border: `1px solid ${certified
                    ? 'color-mix(in srgb, var(--color-success) 30%, transparent)'
                    : 'var(--color-border)'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>{date}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: certified ? 'var(--color-success)' : 'var(--color-text-3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {certified ? 'Reviewed' : 'Pending'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {required.map((slot) => {
                    const signedAt = row?.[`${slot}_signed_at` as keyof DailyReviewRow] as string | null
                    const signedById = row?.[`${slot}_signed_by` as keyof DailyReviewRow] as string | null
                    const signer = signedById ? signerMap.get(signedById) : null
                    return (
                      <div key={slot} style={{
                        fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 999,
                        background: signedAt
                          ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                          : 'var(--color-bg-inset)',
                        color: signedAt ? 'var(--color-success)' : 'var(--color-text-3)',
                        border: `1px solid ${signedAt
                          ? 'color-mix(in srgb, var(--color-success) 30%, transparent)'
                          : 'var(--color-border)'}`,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                        {signedAt && <Check size={11} strokeWidth={3} />}
                        <span>{SLOT_LABELS[slot as DailyReviewSlot]}{signer ? ` — ${formatSigner(signer)}` : ''}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {signOpen && installationId && userId && (
        <DailyReviewSignModal
          open={signOpen}
          onClose={() => setSignOpen(false)}
          baseId={installationId}
          baseName={baseName}
          baseIcao={baseIcao}
          shiftCount={shiftCount}
          reviewDate={selectedDate}
          timezone={baseTimezone}
          resetTime={baseResetTime}
          userId={userId}
          userName={userName}
          defaultPdfEmail={defaultPdfEmail}
          onSigned={load}
        />
      )}
    </div>
  )
}
