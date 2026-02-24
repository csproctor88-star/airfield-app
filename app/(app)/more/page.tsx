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
  { name: 'Airfield Inspection History', icon: '📋', color: '#34D399', badge: null, href: '/inspections?view=history', adminOnly: false, sysAdminOnly: false },
  { name: 'Airfield Check History', icon: '🛡️', color: '#22D3EE', badge: null, href: '/checks/history', adminOnly: false, sysAdminOnly: false },
  { name: 'Obstruction Database', icon: '🗺️', color: '#F97316', badge: null, href: '/obstructions/history', adminOnly: false, sysAdminOnly: false },
  { name: 'Waivers', icon: '📄', color: '#A78BFA', badge: null, href: '/waivers', adminOnly: false, sysAdminOnly: false },
  { name: 'Reports', icon: '📊', color: '#22D3EE', badge: null, href: '/reports', adminOnly: false, sysAdminOnly: false },
  { name: 'PDF Library', icon: '📖', color: '#A855F7', badge: null, href: '/library', adminOnly: true, sysAdminOnly: false },
  { name: 'Users & Security', icon: '👥', color: '#64748B', badge: '3 online', href: '/users', adminOnly: false, sysAdminOnly: true },
  { name: 'Settings', icon: '⚙️', color: '#64748B', badge: null, href: '/settings', adminOnly: false, sysAdminOnly: false },
]

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
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>All Modules</div>
      {visibleModules.map((m) => (
        <Link
          key={m.name}
          href={m.href}
          className="card"
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${m.color}10`,
              border: `1px solid ${m.color}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {m.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
          </div>
          {m.badge && <Badge label={m.badge} color={m.color} />}
          <span style={{ color: 'var(--color-text-4)', fontSize: 16 }}>›</span>
        </Link>
      ))}
      <div
        className="card"
        style={{ marginTop: 8, textAlign: 'center', padding: 20 }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-1)', letterSpacing: '-0.01em' }}>
          Glidepath
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-2)', marginTop: 2 }}>
          Guiding You to Mission Success
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 6 }}>
          v2.1.0
        </div>
      </div>
    </div>
  )
}
