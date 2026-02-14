'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  ClipboardList,
  ShieldCheck,
  Megaphone,
  Menu,
} from 'lucide-react'

// Bottom nav matching prototype: 5 tabs, fixed, blur backdrop
// Home | Discrepancies | Checks | NOTAMs | More

const tabs = [
  { href: '/', label: 'HOME', icon: Home },
  { href: '/discrepancies', label: 'DISCREPANCIES', icon: ClipboardList },
  { href: '/checks', label: 'CHECKS', icon: ShieldCheck },
  { href: '/notams', label: 'NOTAMS', icon: Megaphone },
  { href: '/more', label: 'MORE', icon: Menu },
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
        background: 'rgba(4,7,12,0.97)',
        borderTop: '1px solid rgba(56,189,248,0.06)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '6px 0 20px',
        zIndex: 100,
        backdropFilter: 'blur(24px)',
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
              color: isActive ? '#22D3EE' : '#64748B',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
              padding: '4px 8px',
              position: 'relative',
              textDecoration: 'none',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em' }}>
              {label}
            </span>
            {/* Alert dot for Home when there are critical items */}
            {href === '/' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 4,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  background: '#EF4444',
                }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}
