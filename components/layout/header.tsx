'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/theme-context'
import { useSidebar } from '@/lib/sidebar-context'
import { useInstallation } from '@/lib/installation-context'
import { useDashboard } from '@/lib/dashboard-context'
import { createClient } from '@/lib/supabase/client'
import { getWriteQueue } from '@/lib/sync/write-queue'
import {
  PENDING_PHOTOS_CHANGED_EVENT,
  getPendingPhotoStorage,
} from '@/lib/sync/pending-photos'
import { fetchPprEntriesForDate } from '@/lib/supabase/ppr'
import { QueueInspector } from '@/components/sync/queue-inspector'
import { PanelLeftOpen, ChevronDown } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  airfield_manager: 'AFM',
  namo: 'NAMO',
  amops: 'AMOPS',
  ces: 'CES',
  safety: 'Safety',
  atc: 'ATC',
  read_only: 'Read Only',
  base_admin: 'Base Admin',
  sys_admin: 'Sys Admin',
}

/**
 * Watch the browser's online/offline state. Glidepath has no offline write
 * queue today (every Supabase call is NetworkOnly via the service worker),
 * so users need a visible signal before they tap File / Save / Submit and
 * lose the action to a silent network error.
 */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

/**
 * Pending writes, attention writes, and pending photos counts. Polled
 * every 3s while visible plus immediate refresh on online /
 * visibilitychange / focus / write-committed / pending-photos-changed.
 *
 * Pending = retriable queued writes waiting for the next drain.
 * Attention = failed or conflict writes the user must resolve manually.
 * Photos = blobs persisted to IDB awaiting manual upload.
 */
function useQueueCounts(): {
  pending: number
  attention: number
  photos: number
} {
  const [counts, setCounts] = useState({ pending: 0, attention: 0, photos: 0 })

  useEffect(() => {
    let cancelled = false
    const queue = getWriteQueue()
    const photoStore = getPendingPhotoStorage()
    const refresh = async () => {
      try {
        const [pending, attention, photos] = await Promise.all([
          queue.pendingCount(),
          queue.needsAttentionCount(),
          photoStore.count(),
        ])
        if (!cancelled) setCounts({ pending, attention, photos })
      } catch {
        // Silent — IDB unavailable, etc.
      }
    }
    refresh()

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 3000)

    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('glidepath:write-committed', refresh)
    window.addEventListener(PENDING_PHOTOS_CHANGED_EVENT, refresh)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('glidepath:write-committed', refresh)
      window.removeEventListener(PENDING_PHOTOS_CHANGED_EVENT, refresh)
    }
  }, [])

  return counts
}

export function Header() {
  const { resolvedTheme } = useTheme()
  const { isOpen, toggle } = useSidebar()
  const { currentInstallation, allInstallations, switchInstallation, userRole } = useInstallation()
  const { advisories } = useDashboard()
  const [userName, setUserName] = useState<string | null>(null)
  const [showInstSwitcher, setShowInstSwitcher] = useState(false)

  // Live Zulu clock — ticks every second. Bounded re-render: only the
  // header subtree re-renders, not the page. The cost of one second-
  // resolution clock is well worth the operational signal.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Today's PPR count — single fetch on installation change. Refreshed
  // on the same window events the queue counts use, so a PPR submit /
  // approve elsewhere in the app flows back to the count without a
  // tight polling loop.
  const installationId = currentInstallation?.id || null
  const [todayPprCount, setTodayPprCount] = useState(0)
  useEffect(() => {
    if (!installationId) { setTodayPprCount(0); return }
    let cancelled = false
    const refresh = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const entries = await fetchPprEntriesForDate(installationId, today)
        if (!cancelled) setTodayPprCount(entries.length)
      } catch { /* silent — header chip; no toast */ }
    }
    refresh()
    const onWriteCommitted = () => refresh()
    const onFocus = () => refresh()
    window.addEventListener('glidepath:write-committed', onWriteCommitted)
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('glidepath:write-committed', onWriteCommitted)
      window.removeEventListener('focus', onFocus)
    }
  }, [installationId])

  // Visibility still driven from the user's role via the permission
  // matrix — matches the Phase C seed (`installations:switch` is on
  // AFM, NAMO, base_admin, sys_admin, majcom_rfm, safety/atc/read_only,
  // and allInstallations is only populated for MULTI_INSTALL_ROLES, so
  // it already self-gates to the roles that actually have > 1 base).
  const canSwitchInstallation = allInstallations.length > 1
    && (userRole === 'airfield_manager' || userRole === 'sys_admin' || userRole === 'base_admin' || userRole === 'namo' || userRole === 'majcom_rfm')

  useEffect(() => {
    async function loadProfile(updatePresence: boolean) {
      const supabase = createClient()
      if (!supabase) return
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Update last_seen_at (skipped on initial mount so the login
        // activity dialog can read the previous value first)
        if (updatePresence) {
          await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)
        }

        // Fetch profile (last_seen_at is no longer rendered in the
        // header chrome; it's still written above for the LoginActivityDialog
        // and any other consumers that need recent presence data).
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, rank')
          .eq('id', user.id)
          .single()
        if (profile) {
          setUserName(profile.rank ? `${profile.rank} ${profile.name}` : profile.name)
        } else {
          setUserName(user.email || null)
        }
      } catch { /* ignore */ }
    }
    loadProfile(false)
    // Update presence every 5 min
    const interval = setInterval(() => loadProfile(true), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const baseName = currentInstallation?.name || null
  const baseIcao = currentInstallation?.icao || null
  const roleLabel = userRole ? (ROLE_LABELS[userRole] || userRole) : null
  const isOnline = useOnlineStatus()
  const queueCounts = useQueueCounts()
  const queueDepth = queueCounts.pending
  const queueAttention = queueCounts.attention
  const photosWaiting = queueCounts.photos
  const [inspectorOpen, setInspectorOpen] = useState(false)

  return (
    <div
      style={{
        background: resolvedTheme === 'dark'
          ? 'linear-gradient(180deg, var(--color-bg-header-start), var(--color-bg-header-end))'
          : '#ffffff',
        borderBottom: resolvedTheme === 'dark' ? 'none' : '2px solid var(--color-header-border)',
        padding: 'var(--header-padding)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Info row: sidebar toggle + installation left, ops cluster
          middle, status+user right. The ops cluster (advisories /
          PPRs / Z time / Julian / calendar date) lives here so it
          rides the sticky header and stays visible across every
          page \u2014 not just /. */}
      {(baseName || userName) && (() => {
        // Live Zulu clock pieces \u2014 recomputed each second from nowTick.
        const nowDate = new Date(nowTick)
        const hh = String(nowDate.getUTCHours()).padStart(2, '0')
        const mm = String(nowDate.getUTCMinutes()).padStart(2, '0')
        const ss = String(nowDate.getUTCSeconds()).padStart(2, '0')
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
        const dateLine = `${String(nowDate.getUTCDate()).padStart(2, '0')} ${months[nowDate.getUTCMonth()]} ${nowDate.getUTCFullYear()}`
        const startOfUtcYear = Date.UTC(nowDate.getUTCFullYear(), 0, 1)
        const julianDay = Math.floor((nowDate.getTime() - startOfUtcYear) / 86400000) + 1
        const julianStr = String(julianDay).padStart(3, '0')

        const advCount = advisories.length

        const opsChip = (label: string, color: string) => (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 9px', borderRadius: 999,
            fontSize: 'var(--fs-2xs)', fontWeight: 700,
            background: 'var(--color-bg-inset)',
            border: `1px solid ${color}40`,
            color: color, letterSpacing: '0.04em', textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>{label}</span>
        )

        return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12, flexWrap: 'wrap',
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-3)',
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          {/* Left: sidebar toggle + installation name (hero treatment) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <button
              onClick={toggle}
              className={`sidebar-toggle${!isOpen ? ' sidebar-toggle-visible' : ''}`}
              title="Expand sidebar"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-3)',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PanelLeftOpen size={18} />
            </button>
          <div style={{ position: 'relative' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: canSwitchInstallation ? 'pointer' : 'default' }}
              onClick={canSwitchInstallation ? () => setShowInstSwitcher(!showInstSwitcher) : undefined}
            >
              {baseName && (
                <span style={{
                  fontSize: 'clamp(15px, 1.6vw, 19px)', fontWeight: 700,
                  color: 'var(--color-text-1)', letterSpacing: '-0.005em',
                  lineHeight: 1.1, whiteSpace: 'nowrap',
                }}>
                  {baseName}
                </span>
              )}
              {baseIcao && (
                <span style={{
                  fontFamily: 'monospace', fontSize: 'var(--fs-xs)', fontWeight: 700,
                  color: 'var(--color-accent)',
                  padding: '1px 7px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(56,189,248,0.10)',
                  border: '1px solid rgba(56,189,248,0.35)',
                  letterSpacing: '0.06em',
                }}>{baseIcao.toUpperCase()}</span>
              )}
              {canSwitchInstallation && (
                <ChevronDown size={14} color="var(--color-text-3)" style={{ transition: 'transform 0.2s', transform: showInstSwitcher ? 'rotate(180deg)' : 'none' }} />
              )}
            </div>

            {showInstSwitcher && canSwitchInstallation && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
                background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-mid)',
                borderRadius: 6, overflow: 'hidden', minWidth: 180,
              }}>
                {allInstallations.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => { switchInstallation(inst.id); setShowInstSwitcher(false) }}
                    style={{
                      display: 'block', width: '100%', padding: '6px 10px',
                      background: inst.id === currentInstallation?.id ? 'rgba(56,189,248,0.08)' : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer', textAlign: 'left',
                      color: inst.id === currentInstallation?.id ? 'var(--color-accent)' : 'var(--color-text-2)',
                      fontSize: 'var(--fs-sm)', fontWeight: inst.id === currentInstallation?.id ? 700 : 500,
                      fontFamily: 'inherit',
                    }}
                  >
                    {inst.name}
                    {inst.icao && <span style={{ fontSize: 'var(--fs-xs)', marginLeft: 8, opacity: 0.6 }}>{inst.icao}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>

          {/* Middle: operational cluster \u2014 chips (when count > 0) +
              live Zulu clock + Julian day + calendar date. Hidden on
              the very narrowest viewports (handled by the existing
              .hero-summary class via @media in globals.css; the clock
              itself stays visible). */}
          <div className="header-ops-cluster" style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            marginLeft: 'auto',
          }}>
            <div className="hero-summary" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {advCount > 0 && opsChip(`${advCount} Advisor${advCount === 1 ? 'y' : 'ies'}`, 'var(--color-warning)')}
              {todayPprCount > 0 && opsChip(`${todayPprCount} PPR${todayPprCount === 1 ? '' : 's'} Today`, 'var(--color-accent)')}
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8,
              fontFamily: 'monospace',
            }}>
              <span style={{
                fontSize: 'var(--fs-md)', fontWeight: 700,
                color: 'var(--color-text-1)', letterSpacing: '0.04em', lineHeight: 1,
              }}>
                {hh}:{mm}:{ss}<span style={{ color: 'var(--color-accent)', marginLeft: 4 }}>Z</span>
              </span>
              <span style={{
                fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)',
                fontWeight: 700, letterSpacing: '0.06em',
              }}>JD {julianStr}</span>
              <span className="header-date" style={{
                fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)',
                fontWeight: 600, letterSpacing: '0.06em',
              }}>{dateLine}</span>
            </div>
          </div>

          {/* Right: status + user */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 2 }}>
              {!isOnline && (
                <span
                  title="No network connection — submissions will fail. Your inspection drafts are still saved locally."
                  style={{
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--color-danger, #DC2626)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.05em',
                  }}
                >
                  OFFLINE
                </span>
              )}
              {queueDepth > 0 && (
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  title={`${queueDepth} write${queueDepth === 1 ? '' : 's'} queued — click to inspect, retry, or discard.`}
                  style={{
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--color-warning, #D97706)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.05em',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ● {queueDepth} QUEUED
                </button>
              )}
              {queueAttention > 0 && (
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  title={`${queueAttention} write${queueAttention === 1 ? '' : 's'} need review — failed or conflict. Click to resolve.`}
                  style={{
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--color-danger, #DC2626)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.05em',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ● {queueAttention} NEEDS REVIEW
                </button>
              )}
              {photosWaiting > 0 && (
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  title={`${photosWaiting} photo${photosWaiting === 1 ? '' : 's'} saved locally — click to upload now or discard.`}
                  style={{
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--color-accent, #38BDF8)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.05em',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ● {photosWaiting} PHOTO{photosWaiting === 1 ? '' : 'S'} WAITING
                </button>
              )}
              {/* Presence label ("Online" / "5m ago") removed —
                  the user identity below is the operator-facing
                  signal; the actionable status badges (OFFLINE,
                  QUEUED, NEEDS REVIEW, PHOTOS WAITING) above are
                  what the user needs to react to. */}
            </div>
            {userName && <div style={{ color: 'var(--color-text-1)', fontWeight: 700 }}>{userName}</div>}
          </div>
        </div>
        )
      })()}
      <QueueInspector open={inspectorOpen} onClose={() => setInspectorOpen(false)} />
    </div>
  )
}
