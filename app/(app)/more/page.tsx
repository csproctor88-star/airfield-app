'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'

// "More" menu — grouped to match sidebar nav structure

type ModuleItem = { name: string; icon: string; color: string; href: string; adminOnly?: boolean; sysAdminOnly?: boolean }

const mainItems: ModuleItem[] = [
  { name: 'Dashboard', icon: '📊', color: '#38BDF8', href: '/dashboard' },
  { name: 'Aircraft Database', icon: '✈️', color: '#38BDF8', href: '/aircraft' },
  { name: 'Reference Library', icon: '📚', color: '#22D3EE', href: '/regulations' },
  { name: 'NOTAMs', icon: '📡', color: '#22D3EE', href: '/notams' },
]

const amToolsItems: ModuleItem[] = [
  { name: 'QRC', icon: '⚡', color: '#EAB308', href: '/qrc' },
  { name: 'Shift Checklist', icon: '☑️', color: '#38BDF8', href: '/shift-checklist' },
  { name: 'Events Log', icon: '📝', color: '#34D399', href: '/activity' },
  { name: 'Airfield Checks', icon: '✅', color: '#22D3EE', href: '/checks' },
  { name: 'All Inspections', icon: '📋', color: '#22D3EE', href: '/inspections/all' },
  { name: 'Personnel on Airfield', icon: '🚧', color: '#F59E0B', href: '/contractors' },
  { name: 'Airfield Discrepancies', icon: '⚠️', color: '#FBBF24', href: '/discrepancies' },
  { name: 'Obstruction Database', icon: '🗺️', color: '#F97316', href: '/obstructions/history' },
  { name: 'Airfield Waivers', icon: '📄', color: '#A78BFA', href: '/waivers' },
  { name: 'Airfield Infrastructure', icon: '💡', color: '#FBBF24', href: '/infrastructure' },
  { name: 'Reports & Analytics', icon: '📈', color: '#22D3EE', href: '/reports' },
]

const moreItems: ModuleItem[] = [
  { name: 'Settings', icon: '⚙️', color: '#64748B', href: '/settings' },
  { name: 'PDF Library', icon: '📖', color: '#A855F7', href: '/library', adminOnly: true },
  { name: 'User Management', icon: '👥', color: '#64748B', href: '/users', adminOnly: true },
]

function NavItem({ item }: { item: ModuleItem }) {
  return (
    <Link
      href={item.href}
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
          background: `${item.color}10`,
          border: `1px solid ${item.color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'var(--fs-2xl)',
          flexShrink: 0,
        }}
      >
        {item.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{item.name}</div>
      </div>
      <span style={{ color: 'var(--color-text-4)', fontSize: 'var(--fs-lg)' }}>›</span>
    </Link>
  )
}

function CollapsibleGroup({ label, icon, items, defaultOpen }: { label: string; icon: string; items: ModuleItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  if (items.length === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          width: '100%',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--color-border)',
          cursor: 'pointer',
          color: 'inherit',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'rgba(100,116,139,0.08)',
            border: '1px solid rgba(100,116,139,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--fs-2xl)',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{label}</div>
        </div>
        <span style={{ color: 'var(--color-text-4)', fontSize: 'var(--fs-lg)', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {open && items.map(item => (
        <div key={item.href} style={{ paddingLeft: 16 }}>
          <NavItem item={item} />
        </div>
      ))}
    </>
  )
}

export default function MorePage() {
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [isSysAdmin, setIsSysAdmin] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient()
      if (!supabase) {
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

  function filterItems(items: ModuleItem[]) {
    if (!loaded) return items.filter(m => !m.adminOnly && !m.sysAdminOnly)
    return items.filter(m => {
      if (m.adminOnly && !canManageUsers) return false
      if (m.sysAdminOnly && !isSysAdmin) return false
      return true
    })
  }

  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>More</div>

      <div style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        {/* Main items */}
        {filterItems(mainItems).map(item => (
          <NavItem key={item.href} item={item} />
        ))}

        {/* AM Tools dropdown */}
        <CollapsibleGroup label="AM Tools" icon="🔧" items={filterItems(amToolsItems)} />

        {/* More dropdown */}
        <CollapsibleGroup label="More" icon="⋯" items={filterItems(moreItems)} />
      </div>
    </div>
  )
}
