'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import { useInstallation } from '@/lib/installation-context'
import type { UserRole } from '@/lib/supabase/types'

// "More" menu — full module list with role-gated entries

const modules = [
  { name: 'Airfield Discrepancies', icon: '⚠️', color: '#FBBF24', badge: null, href: '/discrepancies', adminOnly: false, sysAdminOnly: false },
  { name: 'Obstruction Database', icon: '🗺️', color: '#F97316', badge: null, href: '/obstructions/history', adminOnly: false, sysAdminOnly: false },
  { name: 'Waivers', icon: '📄', color: '#A78BFA', badge: null, href: '/waivers', adminOnly: false, sysAdminOnly: false },
  { name: 'Reports', icon: '📊', color: '#22D3EE', badge: null, href: '/reports', adminOnly: false, sysAdminOnly: false },
  { name: 'NOTAMs', icon: '📡', color: '#22D3EE', badge: null, href: '/notams', adminOnly: false, sysAdminOnly: false },
  { name: 'PDF Library', icon: '📖', color: '#A855F7', badge: null, href: '/library', adminOnly: true, sysAdminOnly: false },
  { name: 'User Management', icon: '👥', color: '#64748B', badge: null, href: '/users', adminOnly: true, sysAdminOnly: false },
  { name: 'Settings', icon: '⚙️', color: '#64748B', badge: null, href: '/settings', adminOnly: false, sysAdminOnly: false },
]

function ProfileSection() {
  const { currentInstallation } = useInstallation()
  const [profile, setProfile] = useState<{
    name: string
    rank: string | null
    email: string
    role: UserRole
    installationName: string | null
  } | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setProfile({ name: 'Demo User', rank: 'MSgt', email: 'demo@glidepath.app', role: 'sys_admin', installationName: currentInstallation?.name ?? 'Demo Base' })
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase
        .from('profiles')
        .select('name, rank, role, primary_base_id')
        .eq('id', user.id)
        .single()

      let installationName: string | null = null
      if (p?.primary_base_id) {
        const { data: inst } = await supabase
          .from('bases')
          .select('name, location')
          .eq('id', p.primary_base_id)
          .single()
        if (inst) {
          const shortName = inst.name.replace(/ Air National Guard Base| Air Force Base| Air Reserve Base/i, '').trim()
          installationName = inst.location
            ? `${shortName}, ${inst.location.split(',').pop()?.trim() || ''}`
            : shortName
        }
      }

      setProfile({
        name: p?.name || '',
        rank: p?.rank || null,
        email: user.email || '',
        role: (p?.role || 'read_only') as UserRole,
        installationName,
      })
    }
    load()
  }, [currentInstallation])

  if (!profile) {
    return (
      <div className="card" style={{ padding: 16, color: 'var(--color-text-3)', fontSize: 13 }}>Loading...</div>
    )
  }

  const roleConfig = USER_ROLES[profile.role]
  const displayName = [profile.rank, profile.name].filter(Boolean).join(' ')

  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>NAME</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-1)' }}>{displayName || 'Not set'}</div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>EMAIL</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{profile.email}</div>
      </div>
      {profile.installationName && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 2 }}>INSTALLATION</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{profile.installationName}</div>
        </div>
      )}
      <div>
        <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>ROLE</div>
        <span style={{
          background: 'rgba(56,189,248,0.1)',
          color: 'var(--color-accent)',
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          {roleConfig?.label || profile.role}
        </span>
      </div>
    </div>
  )
}

export default function MorePage() {
  const { currentInstallation } = useInstallation()
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [isSysAdmin, setIsSysAdmin] = useState(false)
  const [loaded, setLoaded] = useState(false)


  useEffect(() => {
    async function checkRole() {
      const supabase = createClient()
      if (!supabase) {
        // Demo mode — show everything
        setCanManageUsers(true)
        setIsSysAdmin(true)
        setLoaded(true)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoaded(true)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile?.role ?? 'read_only') as UserRole
      const config = USER_ROLES[role]
      setCanManageUsers(config?.canManageUsers ?? false)
      setIsSysAdmin(role === 'sys_admin')
      setLoaded(true)
    }

    checkRole()
  }, [])

  const visibleModules = loaded
    ? modules.filter((m) => {
        if (m.adminOnly && !canManageUsers) return false
        if (m.sysAdminOnly && !isSysAdmin) return false
        return true
      })
    : modules.filter((m) => !m.adminOnly && !m.sysAdminOnly)

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>More</div>

      {/* Profile — always expanded */}
      <ProfileSection />

      {/* Modules */}
      <div style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        {visibleModules.map((m) => (
          <Link
            key={m.name}
            href={m.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              textDecoration: 'none',
              color: 'inherit',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `${m.color}10`,
                border: `1px solid ${m.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {m.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
            </div>
            {m.badge && <Badge label={m.badge} color={m.color} />}
            <span style={{ color: 'var(--color-text-4)', fontSize: 14 }}>›</span>
          </Link>
        ))}
      </div>

    </div>
  )
}
