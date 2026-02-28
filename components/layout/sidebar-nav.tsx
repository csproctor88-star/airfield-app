'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSidebar } from '@/lib/sidebar-context'
import { useTheme } from '@/lib/theme-context'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'
import {
  Home,
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  MapPin,
  FileText,
  Shield,
  BarChart3,
  Plane,
  BookOpen,
  BookMarked,
  Settings,
  Users,
  Activity,
  X,
} from 'lucide-react'

// All navigation items — organized by section
const mainItems = [
  { name: 'Dashboard', icon: Home, href: '/' },
  { name: 'Airfield Checks', icon: ClipboardCheck, href: '/checks' },
  { name: 'Daily Inspections', icon: ClipboardList, href: '/inspections' },
  { name: 'Discrepancies', icon: AlertTriangle, href: '/discrepancies' },
  { name: 'Obstructions', icon: MapPin, href: '/obstructions' },
  { name: 'NOTAMs', icon: FileText, href: '/notams' },
  { name: 'Waivers', icon: Shield, href: '/waivers' },
  { name: 'Reports', icon: BarChart3, href: '/reports' },
  { name: 'Aircraft Database', icon: Plane, href: '/aircraft' },
  { name: 'References', icon: BookOpen, href: '/regulations' },
  { name: 'Activity Log', icon: Activity, href: '/activity' },
]

const adminItems = [
  { name: 'PDF Library', icon: BookMarked, href: '/library' },
  { name: 'User Management', icon: Users, href: '/users' },
]

const bottomItems = [
  { name: 'Settings', icon: Settings, href: '/settings' },
]

export function SidebarNav() {
  const { isOpen, close } = useSidebar()
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient()
      if (!supabase) {
        setCanManageUsers(true)
        setLoaded(true)
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoaded(true); return }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const role = (profile?.role ?? 'read_only') as UserRole
        const config = USER_ROLES[role]
        setCanManageUsers(config?.canManageUsers ?? false)
      } catch {
        // No auth — keep defaults
      }
      setLoaded(true)
    }

    checkRole()
  }, [])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  function renderNavItem(item: { name: string; icon: typeof Home; href: string }) {
    const Icon = item.icon
    const active = isActive(item.href)

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={close}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 20px',
          textDecoration: 'none',
          color: active ? 'var(--color-accent)' : 'var(--color-text-2)',
          background: active ? 'var(--color-accent-glow)' : 'transparent',
          borderRight: active ? '3px solid var(--color-accent)' : '3px solid transparent',
          fontSize: 14,
          fontWeight: active ? 700 : 500,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <Icon size={18} style={{ flexShrink: 0 }} />
        <span>{item.name}</span>
      </Link>
    )
  }

  const separator = (key: string) => (
    <div key={key} style={{ height: 1, background: 'var(--color-border)', margin: '8px 16px' }} />
  )

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={close}
        />
      )}

      {/* Drawer */}
      <nav
        className={`sidebar-drawer${isOpen ? ' open' : ''}`}
      >
        {/* Header with logo and close button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <Link href="/" onClick={close} style={{ textDecoration: 'none' }}>
            <img
              src={resolvedTheme === 'dark' ? '/glidepathdarkmode3.png' : '/glidepath2.png'}
              alt="Glidepath"
              style={{ height: 40, objectFit: 'contain', display: 'block' }}
            />
          </Link>
          <button
            onClick={close}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              color: 'var(--color-text-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation items */}
        <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {mainItems.map(renderNavItem)}

          {/* Admin section — role-gated */}
          {loaded && canManageUsers && (
            <>
              {separator('admin-sep')}
              {adminItems.map(renderNavItem)}
            </>
          )}

          {separator('bottom-sep')}
          {bottomItems.map(renderNavItem)}
        </div>
      </nav>
    </>
  )
}
