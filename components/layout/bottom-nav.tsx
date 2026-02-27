'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  Plane,
  BookOpen,
  MapPin,
  Menu,
} from 'lucide-react'

const tabs = [
  { href: '/', label: 'HOME', icon: Home },
  { href: '/aircraft', label: 'AIRCRAFT', icon: Plane },
  { href: '/regulations', label: 'REFERENCES', icon: BookOpen },
  { href: '/obstructions', label: 'OBSTRUCTION', icon: MapPin },
  { href: '/more', label: 'MORE', icon: Menu },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div
      className="bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: 'var(--color-bg-surface-solid)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-around',
        paddingTop: 6,
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        zIndex: 100,
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
  )
}
