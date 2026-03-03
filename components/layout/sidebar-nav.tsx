'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { USER_ROLES } from '@/lib/constants'
import { useSidebar } from '@/lib/sidebar-context'
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
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

// Main navigation items
const mainItems = [
  { name: 'Dashboard', icon: Home, href: '/' },
  { name: 'Activity Log', icon: Activity, href: '/activity' },
  { name: 'Airfield Checks', icon: ClipboardCheck, href: '/checks' },
  { name: 'All Inspections', icon: ClipboardList, href: '/inspections/all' },
  { name: 'Airfield Discrepancies', icon: AlertTriangle, href: '/discrepancies' },
  { name: 'Obstruction Evaluation Tool', icon: MapPin, href: '/obstructions' },
  { name: 'Aircraft Database', icon: Plane, href: '/aircraft' },
  { name: 'Reference Library', icon: BookOpen, href: '/regulations' },
  { name: 'NOTAMs', icon: FileText, href: '/notams' },
  { name: 'Airfield Waivers', icon: Shield, href: '/waivers' },
  { name: 'Reports & Analytics', icon: BarChart3, href: '/reports' },
]

// "More" dropdown items
const moreItems = [
  { name: 'Settings', icon: Settings, href: '/settings' },
  { name: 'PDF Library', icon: BookMarked, href: '/library', adminOnly: true },
  { name: 'User Management', icon: Users, href: '/users', adminOnly: true },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { isOpen, toggle } = useSidebar()
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

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

  // Auto-expand More if a child route is active
  useEffect(() => {
    const moreActive = moreItems.some(item => {
      if (item.href === '/') return pathname === '/'
      return pathname.startsWith(item.href)
    })
    if (moreActive) setMoreOpen(true)
  }, [pathname])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  function renderNavItem(item: { name: string; icon: typeof Home; href: string }, indented?: boolean) {
    const Icon = item.icon
    const active = isActive(item.href)

    return (
      <Link
        key={item.href}
        href={item.href}
        title={!isOpen ? item.name : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? undefined : 'center',
          gap: isOpen ? 12 : 0,
          padding: isOpen ? `10px 20px${indented ? ' 10px 34px' : ''}` : '10px 0',
          textDecoration: 'none',
          color: active ? 'var(--color-accent)' : 'var(--color-text-2)',
          background: active ? 'var(--color-accent-glow)' : 'transparent',
          borderRight: active ? '3px solid var(--color-accent)' : '3px solid transparent',
          fontSize: indented && isOpen ? 'var(--fs-base)' : 'var(--fs-lg)',
          fontWeight: active ? 700 : 500,
          transition: 'background 0.15s, color 0.15s',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon size={indented ? 16 : 18} style={{ flexShrink: 0 }} />
        {isOpen && <span>{item.name}</span>}
      </Link>
    )
  }

  const visibleMoreItems = moreItems.filter(item => {
    if ('adminOnly' in item && item.adminOnly) return loaded && canManageUsers
    return true
  })

  return (
    <nav className={`sidebar-drawer${isOpen ? '' : ' sidebar-collapsed'}`}>
      {/* Header with tagline + collapse toggle */}
      <div style={{
        padding: isOpen ? '12px 20px 12px 16px' : '16px 0',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: isOpen ? 'flex-start' : 'center',
        justifyContent: isOpen ? 'space-between' : 'center',
        gap: 8,
      }}>
        {isOpen && (
          <div style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 300,
            fontStyle: 'italic',
            color: 'var(--color-text-2)',
            letterSpacing: '0.04em',
            lineHeight: 1.4,
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}>
            Guiding You to Mission Success
          </div>
        )}
        <button
          onClick={toggle}
          title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-3)',
            padding: 6,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      {/* Navigation items */}
      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {mainItems.map(item => renderNavItem(item))}

        {/* More dropdown */}
        <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 16px' }} />
        <button
          onClick={() => setMoreOpen(prev => !prev)}
          title={!isOpen ? 'More' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isOpen ? undefined : 'center',
            gap: isOpen ? 12 : 0,
            padding: isOpen ? '10px 20px' : '10px 0',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-2)',
            fontSize: 'var(--fs-lg)',
            fontWeight: 500,
            textAlign: 'left',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          <MoreHorizontal size={18} style={{ flexShrink: 0 }} />
          {isOpen && (
            <>
              <span style={{ flex: 1 }}>More</span>
              {moreOpen
                ? <ChevronDown size={14} style={{ color: 'var(--color-text-3)' }} />
                : <ChevronRight size={14} style={{ color: 'var(--color-text-3)' }} />
              }
            </>
          )}
        </button>

        {moreOpen && visibleMoreItems.map(item => renderNavItem(item, true))}
      </div>
    </nav>
  )
}
