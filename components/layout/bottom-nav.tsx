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

// Bottom nav: Home | Aircraft Database | Regulations | Obstruction Eval | More

const tabs = [
  { href: '/', label: 'HOME', icon: Home, stacked: false },
  { href: '/aircraft', label: 'AIRCRAFT', icon: Plane, stacked: false },
  { href: '/regulations', label: 'REFERENCES', icon: BookOpen, stacked: false },
  { href: '/obstructions', labelTop: 'OBSTRUCTION', labelBottom: 'TOOL', icon: MapPin, stacked: true },
  { href: '/more', label: 'MORE', icon: Menu, stacked: false },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: 'var(--color-bg-nav)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '6px 0 20px',
        zIndex: 100,
        backdropFilter: 'blur(24px)',
      }}
    >
      {tabs.map((tab) => {
        const { href, icon: Icon, stacked } = tab
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
              gap: 1,
              cursor: 'pointer',
              padding: '4px 4px',
              position: 'relative',
              textDecoration: 'none',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <Icon size={20} />
            {stacked ? (
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.2, textAlign: 'center' }}>
                {(tab as typeof tabs[3]).labelTop}<br />{(tab as typeof tabs[3]).labelBottom}
              </span>
            ) : (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>
                {(tab as typeof tabs[0]).label}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
