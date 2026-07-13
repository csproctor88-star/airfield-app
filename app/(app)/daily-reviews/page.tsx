'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import {
  fetchReviewsInRange,
  fetchOutstandingReviews,
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
import { generateDailyReviewLogPdf } from '@/lib/reports/daily-review-log-pdf'
import DailyReviewSignModal from '@/components/daily-reviews/sign-modal'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { WRITE_COMMITTED_EVENT, type WriteCommittedDetail } from '@/lib/sync/write-queue'
import { Check } from 'lucide-react'

// Cap how many day-cards the list renders so a huge custom range can't lock up
// the page. The PDF export is NOT capped — it always covers the full range.
const MAX_VIEW_DAYS = 370

/** Add `delta` days to an ISO date (UTC math, TZ-safe). */
function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + delta)
  return t.toISOString().slice(0, 10)
}

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

function ReviewRow({ date, row, shiftCount, todayIso, signerMap, currentInstallation, onOpen }: {
  date: string
  row: DailyReviewRow | null
  shiftCount: number
  todayIso: string | null
  signerMap: Map<string, SignerInfo>
  currentInstallation: ReturnType<typeof useInstallation>['currentInstallation']
  onOpen: (date: string) => void
}) {
  const required = requiredSlotsForShifts(shiftCount)
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
      onClick={() => onOpen(date)}
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
}

const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

// Compact inline button — the global `input-dark` class stretches to full
// width, which is wrong for these toolbar chips, so style them directly.
const chipBtn: CSSProperties = {
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 'var(--fs-sm)',
  padding: '5px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-mid)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-2)',
  width: 'auto',
  whiteSpace: 'nowrap',
}

export default function DailyReviewsPage() {
  const { installationId, currentInstallation } = useInstallation()
  const shiftCount = (currentInstallation as { shift_count?: number } | null)?.shift_count ?? 2
  const baseName = currentInstallation?.name || ''
  const baseIcao = (currentInstallation as { icao?: string | null } | null)?.icao || null
  const baseTimezone = (currentInstallation as { timezone?: string | null } | null)?.timezone || null
  const baseResetTime = (currentInstallation as { checklist_reset_time?: string | null } | null)?.checklist_reset_time || null

  // "Today" honors the base's local reset time, not Zulu midnight.
  const todayIso = getEffectiveReviewDate(baseTimezone, baseResetTime)

  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<DailyReviewRow[]>([])
  const [outstanding, setOutstanding] = useState<DailyReviewRow[]>([])
  const [outstandingCapped, setOutstandingCapped] = useState(false)
  const [signerMap, setSignerMap] = useState<Map<string, SignerInfo>>(new Map())
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [signOpen, setSignOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [exporting, setExporting] = useState(false)

  // Date-range filter. null = default (last 14 days, derived from todayIso so it
  // tracks the base's local "today" once the installation loads). The same range
  // drives both the visible list AND the PDF export.
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const [rangeEnd, setRangeEnd] = useState<string | null>(null)
  const effEnd = rangeEnd ?? todayIso
  const effStart = rangeStart ?? addDaysIso(todayIso, -13)
  const validRange = effStart <= effEnd
  const isCustomRange = rangeStart !== null || rangeEnd !== null

  const load = useCallback(async () => {
    if (!installationId) return
    if (!validRange) { setLoaded(true); return }
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
    const reviews = await fetchReviewsInRange(installationId, effStart, effEnd)
    setRows(reviews)
    // Outstanding = uncertified reviews older than the visible range's start,
    // so overdue days that fall outside the current filter can't hide.
    const out = await fetchOutstandingReviews(installationId, effStart, 50)
    setOutstandingCapped(out.length > 50)
    setOutstanding(out.slice(0, 50))
    setSignerMap(await fetchSignersForRows([...reviews, ...out]))
    setLoaded(true)
  }, [installationId, effStart, effEnd, validRange])

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

  // Descending list of every date in the range (newest first). Days with no row
  // still render as a PENDING card. Capped at MAX_VIEW_DAYS for the view only.
  const { visibleDates, spineCapped } = useMemo(() => {
    if (!validRange) return { visibleDates: [] as string[], spineCapped: false }
    const [sy, sm, sd] = effStart.split('-').map(Number)
    const startMs = Date.UTC(sy, sm - 1, sd)
    const [ey, em, ed] = effEnd.split('-').map(Number)
    const endMs = Date.UTC(ey, em - 1, ed)
    const dates: string[] = []
    let cur = endMs
    while (cur >= startMs && dates.length < MAX_VIEW_DAYS) {
      dates.push(new Date(cur).toISOString().slice(0, 10))
      cur -= 86400000
    }
    const totalDays = Math.round((endMs - startMs) / 86400000) + 1
    return { visibleDates: dates, spineCapped: totalDays > MAX_VIEW_DAYS }
  }, [effStart, effEnd, validRange])

  const rowByDate = new Map(rows.map((r) => [r.review_date, r] as const))

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

  const applyPreset = (days: number) => {
    setRangeEnd(todayIso)
    setRangeStart(addDaysIso(todayIso, -(days - 1)))
  }
  const applyMtd = () => {
    setRangeEnd(todayIso)
    setRangeStart(todayIso.slice(0, 8) + '01')
  }
  const resetRange = () => { setRangeStart(null); setRangeEnd(null) }

  const handleExport = () => {
    if (!validRange) { toast.error('Start date must be on or before end date'); return }
    setExporting(true)
    try {
      // rows/signerMap already hold exactly this range (fetchReviewsInRange),
      // so the PDF matches the on-screen filter with no extra round trip.
      const { doc, filename } = generateDailyReviewLogPdf({
        baseName,
        baseIcao,
        shiftCount,
        startDate: effStart,
        endDate: effEnd,
        generatedBy: userName,
        rows,
        signers: signerMap,
        base: currentInstallation,
      })
      doc.save(filename)
    } catch (e) {
      console.error('export daily review log:', e)
      toast.error('Failed to generate report')
    } finally {
      setExporting(false)
    }
  }

  const presetBtnStyle = (active: boolean): CSSProperties => ({
    ...chipBtn,
    ...(active ? {
      background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
      borderColor: 'var(--color-cyan)',
      color: 'var(--color-cyan)',
    } : null),
  })
  // A preset is "active" when the range ends today and spans exactly N days.
  const activeDays = ((): number | null => {
    if (rangeEnd !== null && rangeEnd !== todayIso) return null
    if (rangeStart === null) return 14
    const [sy, sm, sd] = rangeStart.split('-').map(Number)
    const [ey, em, ed] = todayIso.split('-').map(Number)
    return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1
  })()

  return (
    <div data-tour="daily-reviews-header" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
          Daily Reviews
        </div>
        <button
          onClick={handleExport}
          disabled={!loaded || exporting || !validRange}
          style={{ ...chipBtn, cursor: !loaded || exporting || !validRange ? 'not-allowed' : 'pointer', opacity: !loaded || exporting || !validRange ? 0.6 : 1 }}
        >
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* Date-range filter — drives the list below AND the Export PDF. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {RANGE_PRESETS.map((p) => (
          <button key={p.days} onClick={() => applyPreset(p.days)} style={presetBtnStyle(activeDays === p.days)}>
            {p.label}
          </button>
        ))}
        <button onClick={applyMtd} style={presetBtnStyle(false)}>MTD</button>
        <span style={{ color: 'var(--color-text-4)' }}>·</span>
        <input
          type="date"
          max={effEnd}
          value={effStart}
          onChange={(e) => setRangeStart(e.target.value || null)}
          className="input-dark"
          style={{ maxWidth: 160 }}
          aria-label="Range start date"
        />
        <span style={{ color: 'var(--color-text-3)' }}>→</span>
        <input
          type="date"
          min={effStart}
          max={todayIso}
          value={effEnd}
          onChange={(e) => setRangeEnd(e.target.value || null)}
          className="input-dark"
          style={{ maxWidth: 160 }}
          aria-label="Range end date"
        />
        {isCustomRange && (
          <button onClick={resetRange} style={{ ...chipBtn, color: 'var(--color-text-3)' }}>
            Reset
          </button>
        )}
      </div>

      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <span>DAFMAN 13-204v2 Para 2.5.2.10.3 &amp; 10.4 — shift turnover + daily review.</span>
        {loaded && installationId && validRange && (
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
      ) : !validRange ? (
        <EmptyState message="End date is before the start date — adjust the range." />
      ) : (
        <div>
          {outstanding.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--color-amber)', letterSpacing: '0.04em', marginBottom: 8 }}>
                ⚠ OUTSTANDING — started, not certified, before {effStart} ({outstanding.length}{outstandingCapped ? '+' : ''})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {outstanding.map((r) => (
                  <ReviewRow key={r.review_date} date={r.review_date} row={r}
                    shiftCount={shiftCount} todayIso={todayIso} signerMap={signerMap}
                    currentInstallation={currentInstallation} onOpen={openSign} />
                ))}
              </div>
              {outstandingCapped && (
                <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                  Showing the 50 most recent outstanding reviews — set an earlier start date to reach older ones.
                </div>
              )}
              <div style={{ marginTop: 14, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '0.04em' }}>
                IN RANGE — {effStart} → {effEnd}
              </div>
            </div>
          )}
          {spineCapped && (
            <div style={{ marginBottom: 10, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              Range exceeds {MAX_VIEW_DAYS} days — showing the most recent {MAX_VIEW_DAYS}. Export PDF still covers the full range.
            </div>
          )}
          <div data-tour="daily-reviews-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleDates.map((date) => {
              const row = rowByDate.get(date) ?? null
              return (
                <ReviewRow
                  key={date}
                  date={date}
                  row={row}
                  shiftCount={shiftCount}
                  todayIso={todayIso}
                  signerMap={signerMap}
                  currentInstallation={currentInstallation}
                  onOpen={openSign}
                />
              )
            })}
          </div>
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
