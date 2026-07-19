'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sheet, FileText, Search, X, ArrowRight } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLogPage, fetchActivityLogForExport, fetchEntityDetails, type ActivityEntry, type EntityDetails } from '@/lib/supabase/activity-queries'
import { logManualEntry, updateActivityEntry, deleteActivityEntry } from '@/lib/supabase/activity'
import { createClient } from '@/lib/supabase/client'
import { TemplatePicker } from '@/components/ui/template-picker'
import { formatZuluDate } from '@/lib/utils'
import { formatAction, buildDetailsString, actionColor as getActionColor, entityLink as getEntityLink } from '@/lib/activity-format'
import { fetchRecentReviews, canUserSignSlot, requiredSlotsForShifts, getEffectiveReviewDate, type DailyReviewRow } from '@/lib/supabase/daily-reviews'
import { usePermissions } from '@/lib/permissions'
import DailyReviewSignModal from '@/components/daily-reviews/sign-modal'

type PeriodPreset = 'today' | '7d' | '30d' | 'custom'

/**
 * Day-group date formatter — "Today / Yesterday / Wed, May 1" with a
 * long-form secondary line when the date is the relative anchor. Mirrors
 * the recipe used by /recent-activity, /daily-reviews, and /wildlife.
 */
function formatGroupDate(iso: string, todayIso: string): { primary: string; secondary: string | null } {
  const date = new Date(`${iso}T12:00:00Z`)
  const longLabel = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  const today = new Date(`${todayIso}T12:00:00Z`)
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return { primary: 'Today', secondary: longLabel }
  if (diffDays === 1) return { primary: 'Yesterday', secondary: longLabel }
  return { primary: longLabel, secondary: null }
}

function maskEdipi(edipi: string): string {
  if (edipi.length <= 4) return '*'.repeat(edipi.length)
  return '*'.repeat(edipi.length - 4) + edipi.slice(-4)
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  airfield_manager: 'Airfield Manager',
  inspector: 'Inspector',
  viewer: 'Viewer',
  operator: 'Operator',
}

export default function ActivityPage() {
  const router = useRouter()
  const { installationId, userRole, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const isAdmin = ['airfield_manager', 'sys_admin', 'base_admin', 'namo'].includes(userRole || '')
  const [customTemplates, setCustomTemplates] = useState<import('@/lib/activity-templates').TemplateCategory[] | null>(null)

  // ── Daily reviews bar state ──
  const baseTimezone = currentInstallation?.timezone || 'America/New_York'
  const baseResetTime = (currentInstallation as Record<string, unknown>)?.checklist_reset_time as string | undefined || '06:00'
  const shiftCount = (currentInstallation as { shift_count?: number } | null)?.shift_count ?? 2
  const reviewTodayIso = getEffectiveReviewDate(baseTimezone, baseResetTime)
  const [recentReviews, setRecentReviews] = useState<DailyReviewRow[]>([])
  const [shiftReviewOpen, setShiftReviewOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('')

  const refreshReviews = useCallback(() => {
    if (!installationId) return
    fetchRecentReviews(installationId, 14).then(setRecentReviews)
  }, [installationId])
  useEffect(() => { refreshReviews() }, [refreshReviews])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      setCurrentUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
      if (cancelled) return
      setCurrentUserName((profile as { name?: string } | null)?.name || '')
    })()
    return () => { cancelled = true }
  }, [])

  const todayShiftReview = (() => {
    const amslSlots = requiredSlotsForShifts(shiftCount).filter((s) => s.endsWith('_amsl'))
    const canSignAny = amslSlots.some((s) => canUserSignSlot(has, s))
    if (!canSignAny) return null
    const todayRow = recentReviews.find((r) => r.review_date === reviewTodayIso) || null
    const signedCount = amslSlots.filter((s) => todayRow?.[`${s}_signed_at` as keyof DailyReviewRow]).length
    if (signedCount >= amslSlots.length) return null
    return { signedCount, total: amslSlots.length }
  })()

  useEffect(() => {
    if (!installationId) return
    import('@/lib/supabase/activity-templates').then(({ loadCustomActivityTemplates }) =>
      loadCustomActivityTemplates(installationId).then(setCustomTemplates)
    )
  }, [installationId])
  const today = new Date().toISOString().split('T')[0]

  const [period, setPeriod] = useState<PeriodPreset>('7d')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [detailsMap, setDetailsMap] = useState<Map<string, EntityDetails>>(new Map())
  const [certifiedAtByDate, setCertifiedAtByDate] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [manualText, setManualText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [showEditTemplatePicker, setShowEditTemplatePicker] = useState(false)
  const [userPopover, setUserPopover] = useState<{ id: string; x: number; y: number; name: string; role: string | null; edipi: string | null } | null>(null)
  // Collapse the Action column on narrow screens so the table doesn't overflow.
  // The Events Log details + OI are what mobile operators need at a glance.
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 640px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Unified search across actor name, OI, action label, and details
  // text. Server-side via `fetchActivityLogPage` so a query hits the
  // entire activity_log table, not just whatever's currently in memory.
  // Debounced by 300ms so each keystroke doesn't fire a request.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Sentinel for IntersectionObserver-driven Load More.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  // Token bumped on every reset so an in-flight loadMore() can detect
  // that its result is stale (date range / search changed mid-fetch)
  // and discard the response instead of appending to the wrong list.
  const loadTokenRef = useRef(0)

  const getDateRange = useCallback((): { start: string; end: string } => {
    const now = new Date()
    const endISO = new Date(`${today}T23:59:59.999`).toISOString()

    if (period === 'today') {
      return { start: new Date(`${today}T00:00:00`).toISOString(), end: endISO }
    }
    if (period === '7d') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return { start: d.toISOString(), end: endISO }
    }
    if (period === '30d') {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return { start: d.toISOString(), end: endISO }
    }
    return {
      start: new Date(`${customStart}T00:00:00`).toISOString(),
      end: new Date(`${customEnd}T23:59:59.999`).toISOString(),
    }
  }, [period, today, customStart, customEnd])

  const PAGE_SIZE = 500

  // Load (or reload) the first page — resets the list, fetches the most
  // recent PAGE_SIZE entries in the current range/search, refreshes the
  // certifiedAt map. Used on mount, on filter changes, and after edits.
  // Events Log is the AF Form 3616 operational log; PPR workflow churn
  // and high-volume wildlife sightings would flood it, so those still
  // live on /recent-activity instead.
  const loadFirstPage = useCallback(async () => {
    const token = ++loadTokenRef.current
    setLoading(true)
    setEntries([])
    setDetailsMap(new Map())
    setHasMore(false)
    const { start, end } = getDateRange()
    const { data } = await fetchActivityLogPage({
      baseId: installationId,
      startDate: start,
      endDate: end,
      limit: PAGE_SIZE,
      excludeEntityTypes: ['ppr_entry', 'wildlife_sighting'],
      searchQuery: debouncedSearch,
    })
    if (loadTokenRef.current !== token) return
    setEntries(data)
    const details = await fetchEntityDetails(data)
    if (loadTokenRef.current !== token) return
    setDetailsMap(details)
    setHasMore(data.length >= PAGE_SIZE)
    if (installationId) {
      const reviews = await fetchRecentReviews(installationId, 90)
      if (loadTokenRef.current !== token) return
      const map = new Map<string, string>()
      for (const r of reviews) {
        if (r.fully_certified_at) map.set(r.review_date, r.fully_certified_at)
      }
      setCertifiedAtByDate(map)
    }
    setLoading(false)
  }, [installationId, getDateRange, debouncedSearch])

  // Append the next page using cursor pagination — `created_at` of the
  // last loaded row is the cursor. Survives concurrent inserts / deletes
  // and stays fast at any depth (offset pagination would slow down).
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore || entries.length === 0) return
    const token = loadTokenRef.current
    setLoadingMore(true)
    const { start, end } = getDateRange()
    const oldest = entries[entries.length - 1].created_at
    const { data } = await fetchActivityLogPage({
      baseId: installationId,
      startDate: start,
      endDate: end,
      beforeCreatedAt: oldest,
      limit: PAGE_SIZE,
      excludeEntityTypes: ['ppr_entry', 'wildlife_sighting'],
      searchQuery: debouncedSearch,
    })
    if (loadTokenRef.current !== token) return
    if (data.length > 0) {
      setEntries((prev) => [...prev, ...data])
      const newDetails = await fetchEntityDetails(data)
      if (loadTokenRef.current !== token) return
      setDetailsMap((prev) => {
        const merged = new Map(prev)
        newDetails.forEach((v, k) => merged.set(k, v))
        return merged
      })
    }
    setHasMore(data.length >= PAGE_SIZE)
    setLoadingMore(false)
  }, [loadingMore, loading, hasMore, entries, installationId, getDateRange, debouncedSearch])

  // Reset + first-page load fires on every filter change.
  useEffect(() => {
    loadFirstPage()
  }, [loadFirstPage])

  // IntersectionObserver-driven infinite scroll. Fires loadMore when the
  // sentinel scrolls into view (with a 200px rootMargin so the next page
  // is already in flight before the user reaches the bottom).
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore()
    }, { rootMargin: '200px' })
    io.observe(node)
    return () => io.disconnect()
  }, [hasMore, loading, loadMore])

  // Server filters via `fetchActivityLogPage` when the search box is
  // active, so `entries` is already the correct subset — no client-side
  // pass needed. Search hits the entire table, not just whatever's
  // currently in memory.
  const searchActive = debouncedSearch.trim().length >= 2

  // Group entries by Zulu date. Header text uses the relative anchor
  // recipe (Today / Yesterday / weekday) shared with /recent-activity,
  // /daily-reviews, and /wildlife.
  const todayZuluIso = new Date().toISOString().slice(0, 10)
  const grouped: { date: string; primary: string; secondary: string | null; items: ActivityEntry[] }[] = []
  for (const entry of entries) {
    const d = new Date(entry.created_at)
    const dateKey = d.toISOString().split('T')[0]
    const existing = grouped.find((g) => g.date === dateKey)
    if (existing) {
      existing.items.push(entry)
    } else {
      const labels = formatGroupDate(dateKey, todayZuluIso)
      grouped.push({ date: dateKey, primary: labels.primary, secondary: labels.secondary, items: [entry] })
    }
  }

  const handleManualSubmit = async () => {
    if (!manualText.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    if (!supabase) {
      toast.success('Entry logged (demo mode)')
      setManualText('')
      setSubmitting(false)
      return
    }
    const { error } = await logManualEntry(manualText.trim().toUpperCase(), installationId)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry logged')
      setManualText('')
      await loadFirstPage()
    }
    setSubmitting(false)
  }

  const handleEdit = (a: ActivityEntry) => {
    const currentDetails = buildDetailsString(a, detailsMap)
    const d = new Date(a.created_at)
    setEditingId(a.id)
    setEditText(currentDetails)
    setEditDate(d.toISOString().slice(0, 10))
    setEditTime(d.toISOString().slice(11, 16))
  }

  const handleEditSave = async () => {
    if (!editingId) return
    setSaving(true)
    const supabase = createClient()
    if (!supabase) {
      toast.success('Entry updated (demo mode)')
      setEditingId(null)
      setSaving(false)
      return
    }
    const newTimestamp = editDate && editTime ? `${editDate}T${editTime}:00.000Z` : undefined
    const { error } = await updateActivityEntry(editingId, editText.trim(), newTimestamp)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry updated')
      setEditingId(null)
      await loadFirstPage()
    }
    setSaving(false)
  }

  const handleDelete = async (a: ActivityEntry) => {
    const supabase = createClient()
    if (!supabase) {
      toast.success('Entry deleted (demo mode)')
      return
    }
    if (!confirm('Delete this events log entry? This cannot be undone.')) return
    const { error } = await deleteActivityEntry(a.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Entry deleted')
      await loadFirstPage()
    }
  }

  /**
   * Pull the full range for an export — paginated, no 500-row cap.
   * Returns prepared row objects with the same shape both Excel and
   * PDF want, so the two paths share a single fetch + transform.
   */
  const fetchExportRows = async () => {
    const { start, end } = getDateRange()
    const { data } = await fetchActivityLogForExport({
      baseId: installationId,
      startDate: start,
      endDate: end,
      excludeEntityTypes: ['ppr_entry', 'wildlife_sighting'],
    })
    const exportDetails = await fetchEntityDetails(data)
    const rows = data.map((a) => {
      const d = new Date(a.created_at)
      const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
      return {
        createdAt: a.created_at,
        date: formatZuluDate(d),
        time: d.toISOString().slice(11, 16),
        action: formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined, a.metadata),
        details: buildDetailsString(a, exportDetails),
        oi: a.user_operating_initials || '',
        user: userName,
      }
    })
    return { rows, start, end }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { rows, start, end } = await fetchExportRows()
      if (rows.length === 0) {
        toast.message('No entries in range to export')
        setExporting(false)
        return
      }
      const { createStyledWorkbook, addStyledSheet, saveWorkbook } = await import('@/lib/excel-export')

      const columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Time (Z)', key: 'time', width: 10 },
        { header: 'Action', key: 'action', width: 40 },
        { header: 'Details', key: 'details', width: 60 },
        { header: 'OI', key: 'oi', width: 8 },
        { header: 'User', key: 'user', width: 24 },
      ]
      const wb = await createStyledWorkbook()
      addStyledSheet(wb, 'Events Log', columns, rows)
      const startLabel = start.split('T')[0]
      const endLabel = end.split('T')[0]
      await saveWorkbook(wb, `Events_Log_${startLabel}_to_${endLabel}.xlsx`)
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} to Excel`)
    } catch (e) {
      console.error('Export failed:', e)
      toast.error('Export failed')
    }
    setExporting(false)
  }

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const { rows, start, end } = await fetchExportRows()
      if (rows.length === 0) {
        toast.message('No entries in range to export')
        setExporting(false)
        return
      }
      const { generateEventsLogPdf } = await import('@/lib/events-log-pdf')
      const { doc, filename } = await generateEventsLogPdf({
        rows: rows.map(r => ({
          createdAt: r.createdAt,
          action: r.action,
          details: r.details,
          oi: r.oi,
          user: r.user,
        })),
        startDate: start,
        endDate: end,
        baseName: currentInstallation?.name,
        baseIcao: (currentInstallation as { icao?: string | null } | null)?.icao,
      })
      doc.save(filename)
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} to PDF`)
    } catch (e) {
      console.error('PDF export failed:', e)
      toast.error('PDF export failed')
    }
    setExporting(false)
  }

  const PRESETS: { value: PeriodPreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'custom', label: 'Custom' },
  ]

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    color: 'var(--color-text-3)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid var(--color-border)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 'var(--fs-sm)',
    color: 'var(--color-text-2)',
    verticalAlign: 'top',
    borderBottom: '1px solid var(--color-border)',
  }

  // Utility-button style — matches the header pattern used by
  // /discrepancies, /ppr, and /parking.
  const utilityBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '5px 10px',
    color: 'var(--color-text-2)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }

  return (
    <div className="page-container" data-tour="activity-header">
      {/* Page header — tertiary tier-label + counts + utility cluster +
          cyan accent rule. Mirrors /discrepancies, /ppr, /parking. */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap',
        marginBottom: 10, paddingBottom: 6,
        borderBottom: '1px solid var(--color-border-active)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Events Log</span>
          <span style={{
            fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
            display: 'inline-flex', gap: 6, alignItems: 'center',
          }}>
            <span>
              {searchActive
                ? `${entries.length} ${entries.length === 1 ? 'match' : 'matches'}${hasMore ? '+' : ''}`
                : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}${hasMore ? '+ loaded' : ''}`}
            </span>
            {todayShiftReview && (
              <>
                <span style={{ color: 'var(--color-text-4)' }}>·</span>
                <span style={{ color: 'var(--color-amber)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {todayShiftReview.signedCount}/{todayShiftReview.total} AMSL pending
                </span>
              </>
            )}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ ...utilityBtn, opacity: exporting ? 0.5 : 1 }}
            title="Export to Excel"
          >
            <Sheet size={12} color="var(--color-accent)" strokeWidth={2.25} />
            {exporting ? '...' : 'Excel'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            style={{ ...utilityBtn, opacity: exporting ? 0.5 : 1 }}
            title="Export to PDF"
          >
            <FileText size={12} color="var(--color-accent)" strokeWidth={2.25} />
            {exporting ? '...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Compact shift-review bar — only when AMSL pending today. One-line
          pill replacing the prior full card. */}
      {todayShiftReview && (
        <button
          onClick={() => setShiftReviewOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, width: '100%',
            padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-md)',
            background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline', fontSize: 'var(--fs-sm)' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-cyan)' }}>Sign your shift review</span>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)' }}>
              {todayShiftReview.signedCount}/{todayShiftReview.total} AMSL signatures captured
            </span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-cyan)', fontWeight: 700, fontSize: 'var(--fs-xs)' }}>
            Sign <ArrowRight size={12} />
          </span>
        </button>
      )}

      {/* New Log Entry — neutral chrome (de-emphasized vs the prior
          cyan-tinted card) so the list dominates the page. Inline
          template trigger + Enter-to-submit preserved. */}
      <div style={{
        marginBottom: 12, padding: 12,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
          <div style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 800, color: 'var(--color-text-3)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            New Log Entry
          </div>
          <button
            onClick={() => setShowTemplatePicker(true)}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            }}
          >
            Use Template
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            className="input-dark"
            placeholder="What happened? e.g. FOD Check completed, runway sweep performed..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleManualSubmit()
              }
            }}
            rows={2}
            style={{ flex: 1, resize: 'vertical', fontSize: 'var(--fs-base)' }}
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualText.trim() || submitting}
            style={{
              padding: '0 20px', borderRadius: 'var(--radius-md)', border: 'none', alignSelf: 'flex-end', height: 40,
              background: manualText.trim() ? 'var(--color-cyan-btn-bg)' : 'var(--color-bg-elevated)',
              color: manualText.trim() ? 'var(--color-cyan-btn-text)' : 'var(--color-text-4)',
              fontSize: 'var(--fs-md)', fontWeight: 700, cursor: manualText.trim() ? 'pointer' : 'default',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {submitting ? '...' : 'Log'}
          </button>
        </div>
      </div>

      {showTemplatePicker && (
        <TemplatePicker
          onSubmit={async (text, category, templateLabel) => {
            const supabase = createClient()
            if (!supabase) {
              toast.success('Entry logged (demo mode)')
              setShowTemplatePicker(false)
              return
            }
            const { error } = await logManualEntry(text, installationId, category, templateLabel)
            if (error) {
              toast.error(error)
            } else {
              toast.success('Entry logged')
              setShowTemplatePicker(false)
              await loadFirstPage()
            }
          }}
          onClose={() => setShowTemplatePicker(false)}
          isAdmin={isAdmin}
          installationId={installationId}
          customTemplates={customTemplates}
          onTemplatesSaved={setCustomTemplates}
          icao={currentInstallation?.icao}
        />
      )}

      {/* Search + chip-cluster date range. Search filters across actor +
          OI + action label + details in one shot, replacing the prior
          column-header inline inputs. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
          <Search size={14} color="var(--color-text-3)" style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Search actor, OI, action, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 32px 8px 32px',
              background: 'var(--color-search-bg)',
              border: '1px solid var(--color-search-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-1)', fontSize: 'var(--fs-md)',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-3)', padding: 4, display: 'flex',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Date range chip cluster — single bordered container, dim
            off-state per the cluster pattern. */}
        <div style={{
          display: 'flex',
          padding: 3,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)',
          flexShrink: 0,
        }}>
          {PRESETS.map((p) => {
            const active = period === p.value
            return (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  padding: '5px 12px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: active ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)' : 'transparent',
                  color: active ? 'var(--color-cyan)' : 'var(--color-text-3)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom Date Range */}
      {period === 'custom' && (
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <span className="section-label">Start</span>
            <input type="date" className="input-dark" value={customStart} max={today} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <span className="section-label">End</span>
            <input type="date" className="input-dark" value={customEnd} max={today} min={customStart} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Loading activity...</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>No activity found for this date range</div>
        </div>
      ) : (
        <>
          {/* Columnar Table — entry count + AMSL badge live in the
              header now, so no standalone count line here. */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: narrow ? 0 : 600 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 52 }}>Time (Z)</th>
                  {!narrow && <th style={{ ...thStyle, width: 140 }}>Action</th>}
                  <th style={thStyle}>Details</th>
                  <th style={{ ...thStyle, width: 50 }}>OI</th>
                  <th style={{ ...thStyle, width: 60, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <>
                    {/* Date group header — relative anchor (Today /
                        Yesterday / weekday) + secondary date + entry
                        count. Matches /recent-activity, /daily-reviews,
                        /wildlife. */}
                    <tr key={`date-${group.date}`}>
                      <td
                        colSpan={narrow ? 4 : 5}
                        style={{
                          padding: '12px 4px 6px',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
                            {group.primary}
                          </span>
                          {group.secondary && (
                            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 500 }}>
                              {group.secondary}
                            </span>
                          )}
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: 'var(--fs-2xs)',
                            color: 'var(--color-text-4)',
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                          }}>
                            {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Entry rows */}
                    {group.items.map((a) => {
                      const d = new Date(a.created_at)
                      const timeStr = d.toISOString().slice(11, 16)
                      const userName = a.user_rank ? `${a.user_rank} ${a.user_name}` : a.user_name
                      const detailsText = buildDetailsString(a, detailsMap)
                      const link = getEntityLink(a.entity_type, a.entity_id)

                      const initials = a.user_operating_initials || null

                      const certifiedAt = certifiedAtByDate.get(d.toISOString().slice(0, 10))
                      const amended = certifiedAt != null && new Date(a.created_at).getTime() > new Date(certifiedAt).getTime()

                      return (
                        <tr key={a.id}>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                            {timeStr}
                          </td>
                          {!narrow && (
                            <td
                              onClick={link ? () => router.push(link) : undefined}
                              style={{ ...tdStyle, color: getActionColor(a.action, a.entity_type), fontWeight: 600, whiteSpace: 'nowrap', cursor: link ? 'pointer' : 'default' }}
                            >
                              {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined, a.metadata)}
                              {link && <span style={{ marginLeft: 4, fontSize: 'var(--fs-2xs)', opacity: 0.6 }}>&rarr;</span>}
                              {amended && (
                                <span
                                  title={`This entry was logged after the daily review for ${d.toISOString().slice(0, 10)} was signed.`}
                                  style={{
                                    marginLeft: 6, padding: '1px 6px', borderRadius: 999,
                                    fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.04em',
                                    background: 'rgba(251,191,36,0.15)', color: 'var(--color-warning)',
                                    border: '1px solid rgba(251,191,36,0.35)', textTransform: 'uppercase',
                                  }}
                                >Amended</span>
                              )}
                            </td>
                          )}
                          <td
                            onClick={narrow && link ? () => router.push(link) : undefined}
                            style={{ ...tdStyle, color: 'var(--color-text-3)', maxWidth: 300, cursor: narrow && link ? 'pointer' : 'default' }}
                          >
                            {narrow && (
                              <span style={{
                                display: 'inline-block',
                                color: getActionColor(a.action, a.entity_type),
                                fontWeight: 700,
                                marginRight: 6,
                              }}>
                                {formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined, a.metadata)}
                                {link && <span style={{ marginLeft: 3, fontSize: 'var(--fs-2xs)', opacity: 0.6 }}>&rarr;</span>}
                              </span>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: narrow ? 'inline' : 'block' }}>
                              {detailsText || '\u2014'}
                            </span>
                            {narrow && amended && (
                              <span
                                title={`This entry was logged after the daily review for ${d.toISOString().slice(0, 10)} was signed.`}
                                style={{
                                  marginLeft: 6, padding: '1px 6px', borderRadius: 999,
                                  fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.04em',
                                  background: 'rgba(251,191,36,0.15)', color: 'var(--color-warning)',
                                  border: '1px solid rgba(251,191,36,0.35)', textTransform: 'uppercase',
                                }}
                              >Amended</span>
                            )}
                          </td>
                          <td
                            onClick={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setUserPopover({ id: a.id, x: rect.left, y: rect.bottom + 4, name: userName, role: a.user_role, edipi: a.user_edipi })
                            }}
                            style={{ ...tdStyle, fontWeight: 700, color: 'var(--color-cyan)', whiteSpace: 'nowrap', cursor: 'pointer', textAlign: 'center', fontSize: 'var(--fs-xs)', letterSpacing: '0.04em' }}
                            title={userName}
                          >
                            {initials || '—'}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(a) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', fontWeight: 600, color: 'var(--color-status-inwork)' }}
                              title="Edit entry"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(a) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', fontWeight: 600, color: 'var(--color-danger)', marginLeft: 2 }}
                              title="Delete entry"
                            >
                              Del
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          {/* Infinite-scroll sentinel + status line. The IntersectionObserver
              effect watches `sentinelRef` and fires loadMore() when it
              scrolls within 200px of the viewport. The text below is
              cosmetic — the observer does the work. */}
          <div
            ref={sentinelRef}
            style={{
              padding: '16px 8px',
              textAlign: 'center',
              fontSize: 'var(--fs-xs)',
              color: 'var(--color-text-4)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {loadingMore
              ? 'Loading more…'
              : hasMore
                ? (
                  <button
                    onClick={loadMore}
                    style={{
                      background: 'none',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '6px 14px',
                      color: 'var(--color-text-3)',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Load More
                  </button>
                )
                : `— End of ${searchActive ? 'matches' : 'log'} —`}
          </div>
        </>
      )}

      {/* User Info Popover */}
      {userPopover && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }}
          onClick={() => setUserPopover(null)}
        >
          <div
            style={{
              position: 'fixed',
              left: Math.min(userPopover.x, window.innerWidth - 240),
              top: userPopover.y,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              minWidth: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 'var(--z-dropdown)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
              {userPopover.name}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-2)' }}>Role:</span>{' '}
              {ROLE_LABELS[userPopover.role || ''] || userPopover.role || 'N/A'}
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-2)' }}>EDIPI:</span>{' '}
              <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {userPopover.edipi ? maskEdipi(userPopover.edipi) : 'Not on file'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingId && (
        <div
          className="modal-overlay"
          style={{ padding: 16 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setEditingId(null) }}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 420, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 16 }}>
              Edit Entry
            </div>

            {/* Date & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <span className="section-label">Date (Z)</span>
                <input
                  type="date"
                  className="input-dark"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="section-label">Time (Z)</span>
                <input
                  type="text"
                  className="input-dark"
                  value={editTime}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9:]/g, '')
                    if (v.length <= 5) setEditTime(v)
                  }}
                  onBlur={() => {
                    let v = editTime.replace(/[^0-9]/g, '')
                    if (v.length <= 2) v = v.padStart(2, '0') + '00'
                    else if (v.length === 3) v = '0' + v
                    const hh = Math.min(23, parseInt(v.slice(0, 2))).toString().padStart(2, '0')
                    const mm = Math.min(59, parseInt(v.slice(2, 4))).toString().padStart(2, '0')
                    setEditTime(`${hh}:${mm}`)
                  }}
                  placeholder="HH:MM"
                  maxLength={5}
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            {/* Details */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="section-label" style={{ marginBottom: 0 }}>Details</span>
                <button
                  onClick={() => setShowEditTemplatePicker(true)}
                  className="btn-ghost" style={{ color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', padding: 0 }}
                >
                  Use Template
                </button>
              </div>
              <textarea
                className="input-dark"
                rows={4}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave() }
                }}
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 'var(--fs-base)', resize: 'vertical' }}
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                onClick={handleEditSave}
                disabled={saving}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none',
                  background: saving ? 'rgba(6,182,212,0.5)' : '#06B6D4',
                  color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingId(null)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
            <button
              onClick={() => {
                const entry = entries.find((e) => e.id === editingId)
                if (entry) { setEditingId(null); handleDelete(entry) }
              }}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                color: 'var(--color-danger)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Delete Entry
            </button>
          </div>
        </div>
      )}

      {/* Edit Template Picker — populates editText instead of submitting */}
      {showEditTemplatePicker && (
        <TemplatePicker
          onSubmit={async (text) => {
            setEditText(text)
            setShowEditTemplatePicker(false)
          }}
          onClose={() => setShowEditTemplatePicker(false)}
          isAdmin={isAdmin}
          installationId={installationId}
          customTemplates={customTemplates}
          onTemplatesSaved={setCustomTemplates}
          icao={currentInstallation?.icao}
        />
      )}

      {/* Daily Shift Review Sign Modal */}
      {installationId && currentUserId && (
        <DailyReviewSignModal
          open={shiftReviewOpen}
          onClose={() => setShiftReviewOpen(false)}
          baseId={installationId}
          baseName={currentInstallation?.name || ''}
          baseIcao={(currentInstallation as { icao?: string | null } | null)?.icao || null}
          shiftCount={shiftCount}
          reviewDate={reviewTodayIso}
          timezone={baseTimezone}
          resetTime={baseResetTime}
          userId={currentUserId}
          userName={currentUserName}
          onSigned={() => { refreshReviews(); loadFirstPage() }}
        />
      )}
    </div>
  )
}
