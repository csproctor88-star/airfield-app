'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'

// "More" menu — full module list with role-gated entries

const modules = [
  { name: 'Airfield Inspection History', icon: '📋', color: '#34D399', badge: null, href: '/inspections?view=history', adminOnly: false },
  { name: 'Airfield Check History', icon: '🛡️', color: '#22D3EE', badge: null, href: '/checks/history', adminOnly: false },
  { name: 'Obstruction Database', icon: '🗺️', color: '#F97316', badge: null, href: '/obstructions/history', adminOnly: false },
  { name: 'Waivers', icon: '📄', color: '#A78BFA', badge: null, href: '/waivers', adminOnly: false },
  { name: 'Reports', icon: '📊', color: '#22D3EE', badge: null, href: '/reports', adminOnly: false },
  { name: 'NOTAMs', icon: '📡', color: '#A78BFA', badge: '3 active', href: '/notams', adminOnly: false },
  { name: 'PDF Library', icon: '📖', color: '#A855F7', badge: null, href: '/library', adminOnly: true },
  { name: 'Sync & Data', icon: '🔄', color: '#22D3EE', badge: '3 pending', href: '/sync', adminOnly: false },
  { name: 'Users & Security', icon: '👥', color: '#64748B', badge: '3 online', href: '/users', adminOnly: false },
  { name: 'Settings', icon: '⚙️', color: '#64748B', badge: null, href: '/settings', adminOnly: false },
]

export default function MorePage() {
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient()
      if (!supabase) {
        // Demo mode — show everything
        setCanManageUsers(true)
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

      const role = (profile?.role ?? 'observer') as UserRole
      const config = USER_ROLES[role]
      setCanManageUsers(config?.canManageUsers ?? false)
      setLoaded(true)
    }

    checkRole()
  }, [])

  const visibleModules = loaded
    ? modules.filter((m) => !m.adminOnly || canManageUsers)
    : modules.filter((m) => !m.adminOnly)

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
            <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
          </div>
          {m.badge && <Badge label={m.badge} color={m.color} />}
          <span style={{ color: '#334155', fontSize: 16 }}>›</span>
        </Link>
      ))}
      <div
        className="card"
        style={{ marginTop: 8, textAlign: 'center', padding: 16 }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
          Glidepath
        </div>
        <div style={{ fontSize: 10, color: '#64748B' }}>
          v2.1.0 &bull; 127th Wing
        </div>
      </div>
    </div>
  )
}
