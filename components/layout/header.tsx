'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/theme-context'
import { useSidebar } from '@/lib/sidebar-context'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
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

export function Header() {
  const { resolvedTheme } = useTheme()
  const { isOpen, toggle } = useSidebar()
  const { currentInstallation, allInstallations, switchInstallation, userRole } = useInstallation()
  const [userName, setUserName] = useState<string | null>(null)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [showInstSwitcher, setShowInstSwitcher] = useState(false)

  const canSwitchInstallation = allInstallations.length > 1
    && (userRole === 'airfield_manager' || userRole === 'sys_admin')

  useEffect(() => {
    async function loadProfile() {
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
        const { data: profile } = await (supabase as any)
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
    loadProfile()
    // Update presence every 5 min
    const interval = setInterval(loadProfile, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const baseName = currentInstallation?.name || null
  const baseIcao = currentInstallation?.icao || null
  const roleLabel = userRole ? (ROLE_LABELS[userRole] || userRole) : null
  const presence = presenceLabel(lastSeen)

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
      {/* Top row: sidebar toggle + logo + spacer */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <button
          onClick={toggle}
          className={`sidebar-toggle${!isOpen ? ' sidebar-toggle-visible' : ''}`}
          title="Expand sidebar"
          style={{
            position: 'absolute',
            left: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-3)',
            padding: 6,
            borderRadius: 6,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PanelLeftOpen size={20} />
        </button>

        <Link href="/" style={{ textDecoration: 'none' }}>
          <img
            src={resolvedTheme === 'dark' ? '/glidepathdarkmode3.png' : '/glidepath2.png'}
            alt="Glidepath"
            style={{
              display: 'block',
              height: resolvedTheme === 'dark' ? 'var(--header-logo-height-dark)' : 'var(--header-logo-height)',
              objectFit: 'contain',
            }}
          />
        </Link>
      </div>

      {/* Info row: installation left, status+user+role right */}
      {(baseName || userName) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-3)',
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          {/* Left: installation name + ICAO (switcher if multi-base) */}
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

          {/* Right: status + user + role */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--fs-2xs)', color: presence.color, fontWeight: 600, marginBottom: 2 }}>
              {presence.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              {userName && <span>{userName}</span>}
              {roleLabel && (
                <span style={{
                  fontSize: 'var(--fs-2xs)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(34,211,238,0.1)',
                  border: '1px solid rgba(34,211,238,0.2)',
                  color: 'var(--color-cyan)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
