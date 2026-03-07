'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'

// "More" menu — full module list with role-gated entries

const modules = [
  { name: 'Dashboard', icon: '📊', color: '#38BDF8', badge: null, href: '/dashboard', adminOnly: false, sysAdminOnly: false },
  { name: 'Events Log', icon: '📝', color: '#34D399', badge: null, href: '/activity', adminOnly: false, sysAdminOnly: false },
  { name: 'Airfield Checks', icon: '✅', color: '#22D3EE', badge: null, href: '/checks', adminOnly: false, sysAdminOnly: false },
  { name: 'All Inspections', icon: '📋', color: '#22D3EE', badge: null, href: '/inspections/all', adminOnly: false, sysAdminOnly: false },
  { name: 'Personnel on Airfield', icon: '🚧', color: '#F59E0B', badge: null, href: '/contractors', adminOnly: false, sysAdminOnly: false },
  { name: 'Airfield Discrepancies', icon: '⚠️', color: '#FBBF24', badge: null, href: '/discrepancies', adminOnly: false, sysAdminOnly: false },
  { name: 'Obstruction Database', icon: '🗺️', color: '#F97316', badge: null, href: '/obstructions/history', adminOnly: false, sysAdminOnly: false },
  { name: 'Airfield Waivers', icon: '📄', color: '#A78BFA', badge: null, href: '/waivers', adminOnly: false, sysAdminOnly: false },
  { name: 'Reports & Analytics', icon: '📈', color: '#22D3EE', badge: null, href: '/reports', adminOnly: false, sysAdminOnly: false },
  { name: 'NOTAMs', icon: '📡', color: '#22D3EE', badge: null, href: '/notams', adminOnly: false, sysAdminOnly: false },
  { name: 'PDF Library', icon: '📖', color: '#A855F7', badge: null, href: '/library', adminOnly: true, sysAdminOnly: false },
  { name: 'User Management', icon: '👥', color: '#64748B', badge: null, href: '/users', adminOnly: true, sysAdminOnly: false },
  { name: 'Settings', icon: '⚙️', color: '#64748B', badge: null, href: '/settings', adminOnly: false, sysAdminOnly: false },
]

export default function MorePage() {
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
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>More</div>

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
                fontSize: 'var(--fs-2xl)',
                flexShrink: 0,
              }}
            >
              {m.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{m.name}</div>
            </div>
            {m.badge && <Badge label={m.badge} color={m.color} />}
            <span style={{ color: 'var(--color-text-4)', fontSize: 'var(--fs-lg)' }}>›</span>
          </Link>
        ))}
      </div>

    </div>
  )
}
