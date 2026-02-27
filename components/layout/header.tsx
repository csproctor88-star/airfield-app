'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { useTheme } from '@/lib/theme-context'
import { ChevronDown } from 'lucide-react'

// --- User presence helpers ---
function presenceLabel(lastSeen: string | null): { label: string; color: string } {
  if (!lastSeen) return { label: 'Offline', color: 'var(--color-text-3)' }
  const diff = Date.now() - new Date(lastSeen).getTime()
  if (diff < 15 * 60 * 1000) return { label: 'Online', color: 'var(--color-success)' }
  if (diff < 60 * 60 * 1000) return { label: 'Away', color: 'var(--color-warning)' }
  return { label: 'Inactive', color: 'var(--color-text-3)' }
}

// Header: gradient bg, logo left, installation/user info right
export function Header() {
  const { currentInstallation, allInstallations, installationId, switchInstallation, userRole } = useInstallation()
  const { resolvedTheme } = useTheme()
  const [userDisplay, setUserDisplay] = useState<{ name: string; lastSeen: string | null }>({ name: '—', lastSeen: null })
  const [showInstSwitcher, setShowInstSwitcher] = useState(false)
  const [time, setTime] = useState('')

  // Live clock — updates every second
  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const canSwitchInstallation = allInstallations.length > 1
    && (userRole === 'airfield_manager' || userRole === 'sys_admin')

  // --- Load user profile + update last_seen_at ---
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      if (!supabase) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Update last_seen_at
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)

        // Fetch profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any).from('profiles').select('name, rank, last_seen_at').eq('id', user.id).single()

        if (profile) {
          const displayName = profile.rank ? `${profile.rank} ${profile.name}` : profile.name
          setUserDisplay({ name: displayName, lastSeen: profile.last_seen_at })
        }
      } catch {
        // No auth — keep default
      }
    }
    loadUser()
    // Update presence every 5 min
    const interval = setInterval(loadUser, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const presence = presenceLabel(userDisplay.lastSeen)

  return (
    <div
      style={{
        background: resolvedTheme === 'dark'
          ? 'linear-gradient(180deg, var(--color-bg-header-start), var(--color-bg-header-end))'
          : '#ffffff',
        borderBottom: resolvedTheme === 'dark' ? 'none' : '2px solid var(--color-header-border)',
        paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 8,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Clock — replaces system status bar in fullscreen PWA */}
      <div style={{
        width: '100%',
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-2)',
        marginBottom: 4,
        letterSpacing: '0.04em',
      }}>
        {time}
      </div>

      {/* Logo — centered */}
      <Link href="/" style={{ textDecoration: 'none' }}>
        <img
          src={resolvedTheme === 'dark' ? '/glidepathdarkmode3.png' : '/glidepath2.png'}
          alt="Glidepath"
          style={{
            display: 'block',
            height: resolvedTheme === 'dark' ? 64 : 48,
            objectFit: 'contain',
          }}
        />
      </Link>

      {/* Bottom row: installation (left) + user (right) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', marginTop: 6 }}>
        {/* Installation name + ICAO + dropdown — bottom left */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em' }}>
              {currentInstallation?.name
                ? `${currentInstallation.name.toUpperCase()}${currentInstallation.icao ? ` \u2022 ${currentInstallation.icao}` : ''}`
                : 'AIRFIELD OPS'}
            </span>
            {canSwitchInstallation && (
              <button
                onClick={() => setShowInstSwitcher(!showInstSwitcher)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <ChevronDown size={10} color="var(--color-text-3)" />
              </button>
            )}
          </div>

          {/* Installation switcher dropdown */}
          {showInstSwitcher && canSwitchInstallation && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
              background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-mid)',
              borderRadius: 8, overflow: 'hidden', minWidth: 200,
            }}>
              {allInstallations.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => { switchInstallation(inst.id); setShowInstSwitcher(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 14px',
                    background: inst.id === currentInstallation?.id ? 'rgba(56,189,248,0.08)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer', textAlign: 'left',
                    color: inst.id === currentInstallation?.id ? 'var(--color-accent)' : 'var(--color-text-2)',
                    fontSize: 13, fontWeight: inst.id === currentInstallation?.id ? 700 : 500,
                    fontFamily: 'inherit',
                  }}
                >
                  {inst.name}
                  {inst.icao && <span style={{ fontSize: 10, marginLeft: 8, opacity: 0.6 }}>{inst.icao}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User status + name — bottom right */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: presence.color, fontWeight: 600 }}>{presence.label}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-1)' }}>{userDisplay.name}</div>
        </div>
      </div>
    </div>
  )
}
