'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { isModuleEnabled } from '@/lib/modules-config'
import {
  Radio,
  LayoutDashboard,
  MapPin,
  ClipboardList,
  Menu,
  Wrench,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Detect whether the soft keyboard is currently open on iOS / iPadOS / Android
 * by watching VisualViewport. When the visual viewport is noticeably shorter
 * than the layout viewport, the on-screen keyboard is covering the lower part
 * of the screen — hide the bottom nav so iOS's position: fixed quirk doesn't
 * drop it into the middle of the UI.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const check = () => {
      // 150px threshold: keyboards are ~260–380px tall; browser chrome
      // collapse on scroll is usually <100px. 150px cleanly separates them.
      const hidden = window.innerHeight - vv.height
      setOpen(hidden > 150)
    }
    check()
    vv.addEventListener('resize', check)
    vv.addEventListener('scroll', check)
    return () => {
      vv.removeEventListener('resize', check)
      vv.removeEventListener('scroll', check)
    }
  }, [])
  return open
}

const defaultTabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'STATUS', icon: Radio },
  { href: '/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { href: '/obstructions', label: 'OBSTRUCTION', icon: MapPin },
  { href: '/activity', label: 'EVENTS LOG', icon: ClipboardList },
  { href: '/more', label: 'MORE', icon: Menu },
]

const cesTabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/ces', label: 'WORK ORDERS', icon: Wrench },
  { href: '/discrepancies', label: 'DISCREPANCIES', icon: AlertTriangle },
  { href: '/infrastructure', label: 'NAVAIDs', icon: Lightbulb },
]

export function BottomNav() {
  const pathname = usePathname()
  const { userRole, enabledModules, currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null
  const keyboardOpen = useKeyboardOpen()
  // Kiosk roles (airfield_status, atc) — no bottom nav. Users can
  // only view the Airfield Status page; there is nowhere else to go.
  if (userRole === 'airfield_status' || userRole === 'atc') return null
  const base = userRole === 'ces' ? cesTabs : defaultTabs
  const tabs = base.filter(t => isModuleEnabled(t.href, enabledModules, airportType))

  return (
    <nav
      className={`bottom-nav${keyboardOpen ? ' bottom-nav-keyboard-open' : ''}`}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        background: 'var(--color-bg-surface-solid)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-around',
          borderTop: '1px solid var(--color-border)',
          paddingTop: 6,
          // 4px above the home-indicator safe-area inset — matches Apple's
          // own tab-bar spacing where icons sit just above the indicator zone
          // rather than floating well above it. iPhones contribute
          // ~34px via env(); Android/desktop contribute 0.
          paddingBottom: 'calc(4px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/'
            ? pathname === '/'
            : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              data-tour={href === '/more' ? 'bottom-nav-more' : undefined}
              style={{
                background: 'none',
                border: 'none',
                color: isActive ? 'var(--color-cyan)' : 'var(--color-text-3)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
                padding: '4px 4px',
                position: 'relative',
                textDecoration: 'none',
                minWidth: 44,
                minHeight: 44,
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em' }}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
