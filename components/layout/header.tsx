'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/lib/theme-context'
import { useSidebar } from '@/lib/sidebar-context'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { getWriteQueue } from '@/lib/sync/write-queue'
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

function presenceLabel(lastSeen: string | null): { label: string; color: string } {
  if (!lastSeen) return { label: 'Offline', color: 'var(--color-text-3)' }
  const diff = Date.now() - new Date(lastSeen).getTime()
  if (diff < 15 * 60 * 1000) return { label: 'Online', color: 'var(--color-success)' }
  if (diff < 60 * 60 * 1000) return { label: 'Away', color: 'var(--color-warning)' }
  return { label: 'Inactive', color: 'var(--color-text-3)' }
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
 * Pending writes in the offline queue. Polls every 3s while the tab is
 * visible (cheap — reads IndexedDB) plus immediate refresh on `online`,
 * `visibilitychange`, and `focus`. Returns 0 when the queue is empty so
 * callers can skip rendering.
 */
function useQueueDepth(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const queue = getWriteQueue()
    const refresh = async () => {
      try {
        const n = await queue.pendingCount()
        if (!cancelled) setCount(n)
      } catch {
        // Silent — IDB unavailable, etc. Pill just stays at 0.
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

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return count
}

export function Header() {
  const { resolvedTheme } = useTheme()
  const { isOpen, toggle } = useSidebar()
  const { currentInstallation, allInstallations, switchInstallation, userRole } = useInstallation()
  const [userName, setUserName] = useState<string | null>(null)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [showInstSwitcher, setShowInstSwitcher] = useState(false)

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

        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, rank, last_seen_at')
          .eq('id', user.id)
          .single()
        if (profile) {
          setUserName(profile.rank ? `${profile.rank} ${profile.name}` : profile.name)
          setLastSeen(profile.last_seen_at)
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
  const presence = presenceLabel(lastSeen)
  const isOnline = useOnlineStatus()
  const queueDepth = useQueueDepth()
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
      {/* Info row: sidebar toggle + installation left, status+user right */}
      {(baseName || userName) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-3)',
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          {/* Left: sidebar toggle + installation name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
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
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: canSwitchInstallation ? 'pointer' : 'default' }}
              onClick={canSwitchInstallation ? () => setShowInstSwitcher(!showInstSwitcher) : undefined}
            >
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 700, letterSpacing: '0.08em' }}>
                {baseName
                  ? `${baseName.toUpperCase()}${baseIcao ? ` \u2022 ${baseIcao}` : ''}`
                  : ''}
              </span>
              {canSwitchInstallation && (
                <ChevronDown size={12} color="var(--color-text-3)" style={{ transition: 'transform 0.2s', transform: showInstSwitcher ? 'rotate(180deg)' : 'none' }} />
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
              <span style={{ fontSize: 'var(--fs-2xs)', color: presence.color, fontWeight: 600 }}>
                {presence.label}
              </span>
            </div>
            {userName && <div style={{ color: 'var(--color-text-1)', fontWeight: 700 }}>{userName}</div>}
          </div>
        </div>
      )}
      <QueueInspector open={inspectorOpen} onClose={() => setInspectorOpen(false)} />
    </div>
  )
}
