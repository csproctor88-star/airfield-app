'use client'

import { useCallback, useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import {
  fetchRecentReviews,
  fetchSignersForRows,
  requiredSlotsForShifts,
  isFullyCertified,
  getEffectiveReviewDate,
  getSlotLabel,
  signerCompact,
  type DailyReviewRow,
  type DailyReviewSlot,
  type SignerInfo,
} from '@/lib/supabase/daily-reviews'
import DailyReviewSignModal from '@/components/daily-reviews/sign-modal'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { WRITE_COMMITTED_EVENT, type WriteCommittedDetail } from '@/lib/sync/write-queue'
import { Check } from 'lucide-react'

// "Today" / "Yesterday" / "Wed, May 1" — the user's mental model is
// day-of-week, not ISO. The secondary line carries the absolute date
// for the relative anchors so it's always unambiguous in screenshots.
function formatRowDate(iso: string, todayIso: string | null): { primary: string; secondary: string | null } {
  // Use noon to dodge any DST/TZ edge that could flip the day.
  const date = new Date(`${iso}T12:00:00`)
  const longLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (todayIso) {
    const today = new Date(`${todayIso}T12:00:00`)
    const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000)
    if (diffDays === 0) return { primary: 'Today', secondary: longLabel }
    if (diffDays === 1) return { primary: 'Yesterday', secondary: longLabel }
  }
  return { primary: longLabel, secondary: null }
}

interface SlotTileProps {
  label: string
  signed: boolean
  signer: SignerInfo | null
}

function SlotTile({ label, signed, signer }: SlotTileProps) {
  return (
    <div style={{
      padding: '6px 8px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${signed
        ? 'color-mix(in srgb, var(--color-success) 30%, transparent)'
        : 'var(--color-border)'}`,
      background: signed
        ? 'color-mix(in srgb, var(--color-success) 10%, transparent)'
        : 'transparent',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 'var(--fs-2xs)',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: signed ? 'var(--color-success)' : 'var(--color-text-3)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 'var(--fs-xs)',
        color: signed ? 'var(--color-text-1)' : 'var(--color-text-4)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {signed ? (
          <>
            <Check size={11} strokeWidth={3} color="var(--color-success)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {signer ? signerCompact(signer) : 'Signed'}
            </span>
          </>
        ) : (
          <span>—</span>
        )}
      </div>
    </div>
  )
}

export default function DailyReviewsPage() {
  const { installationId, currentInstallation } = useInstallation()
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
  const todayIso = visibleDates[0] ?? null

  // Tally counts across the visible window so the header gives an
  // at-a-glance read before scrolling. "No row yet" counts as pending.
  const reviewedCount = visibleDates.reduce((n, d) => {
    const row = rowByDate.get(d)
    return row && isFullyCertified(row, shiftCount) ? n + 1 : n
  }, 0)
  const pendingCount = visibleDates.length - reviewedCount

  const openSign = (date: string) => {
    setSelectedDate(date)
    setSignOpen(true)
  }

  return (
    <div data-tour="daily-reviews-header" style={{ padding: 16 }}>
      <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
        Daily Reviews
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <span>DAFMAN 13-204v1 Para 2.5.2.10.3 &amp; 10.4 — shift turnover + daily review.</span>
        {loaded && installationId && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--color-text-4)' }}>·</span>
            <span style={{ color: pendingCount > 0 ? 'var(--color-amber)' : 'var(--color-text-3)', fontWeight: 700 }}>
              {pendingCount} pending
            </span>
            <span style={{ color: 'var(--color-text-4)' }}>·</span>
            <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
              {reviewedCount} reviewed
            </span>
          </span>
        )}
      </div>

      {!loaded ? (
        <LoadingState message="Loading reviews…" />
      ) : !installationId ? (
        <EmptyState message="Select an installation to view daily reviews." />
      ) : (
        <div data-tour="daily-reviews-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleDates.map((date) => {
            const row = rowByDate.get(date) ?? null
            const certified = row ? isFullyCertified(row, shiftCount) : false
            const isToday = date === todayIso
            const dateLabel = formatRowDate(date, todayIso)
            // Left rail communicates state at a glance:
            //   reviewed → success, today + pending → amber (your turn),
            //   past + pending → text-4 (quiet).
            const railColor = certified
              ? 'var(--color-success)'
              : isToday
                ? 'var(--color-amber)'
                : 'var(--color-text-4)'
            const statusLabel = certified ? 'REVIEWED' : 'PENDING'
            const statusColor = certified
              ? 'var(--color-success)'
              : isToday
                ? 'var(--color-amber)'
                : 'var(--color-text-3)'
            return (
              <div
                key={date}
                onClick={() => openSign(date)}
                style={{
                  padding: '12px 14px', borderRadius: 'var(--radius-md)',
                  background: certified
                    ? 'color-mix(in srgb, var(--color-success) 6%, transparent)'
                    : isToday
                      ? 'color-mix(in srgb, var(--color-amber) 5%, transparent)'
                      : 'var(--color-bg-surface-solid)',
                  border: '1px solid var(--color-border)',
                  borderLeft: `3px solid ${railColor}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                      {dateLabel.primary}
                    </span>
                    {dateLabel.secondary && (
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 500 }}>
                        {dateLabel.secondary}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 'var(--fs-2xs)', color: statusColor, fontWeight: 700,
                    letterSpacing: '0.1em', whiteSpace: 'nowrap',
                  }}>
                    {statusLabel}
                  </span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${required.length}, minmax(0, 1fr))`,
                  gap: 6,
                }}>
                  {required.map((slot) => {
                    const signedAt = row?.[`${slot}_signed_at` as keyof DailyReviewRow] as string | null
                    const signedById = row?.[`${slot}_signed_by` as keyof DailyReviewRow] as string | null
                    const signer = signedById ? signerMap.get(signedById) : null
                    return (
                      <SlotTile
                        key={slot}
                        label={getSlotLabel(slot as DailyReviewSlot, currentInstallation)}
                        signed={!!signedAt}
                        signer={signer ?? null}
                      />
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
          onSigned={load}
        />
      )}
    </div>
  )
}
