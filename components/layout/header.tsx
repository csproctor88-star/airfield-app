'use client'

import Link from 'next/link'
import { useTheme } from '@/lib/theme-context'
import { useSidebar } from '@/lib/sidebar-context'
import { PanelLeftOpen } from 'lucide-react'

// Header: gradient bg, logo centered, sidebar toggle when collapsed
export function Header() {
  const { resolvedTheme } = useTheme()
  const { isOpen, toggle } = useSidebar()

  return (
    <div
      style={{
        background: resolvedTheme === 'dark'
          ? 'linear-gradient(180deg, var(--color-bg-header-start), var(--color-bg-header-end))'
          : '#ffffff',
        borderBottom: resolvedTheme === 'dark' ? 'none' : '2px solid var(--color-header-border)',
        padding: 'var(--header-padding)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Sidebar expand button — visible on tablet+ when sidebar is collapsed */}
      <button
        onClick={toggle}
        className={`sidebar-toggle${!isOpen ? ' sidebar-toggle-visible' : ''}`}
        title="Expand sidebar"
        style={{
          position: 'absolute',
          left: 16,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-3)',
          padding: 6,
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PanelLeftOpen size={20} />
      </button>

      <Link href="/" style={{ textDecoration: 'none' }}>
        <img
          src={resolvedTheme === 'dark' ? '/glidepathdarkmode3.png' : '/glidepath2.png'}
          alt="Glidepath"
          style={{
            display: 'block',
            height: resolvedTheme === 'dark' ? 'var(--header-logo-height-dark)' : 'var(--header-logo-height)',
            objectFit: 'contain',
          }}
        />
      </Link>
    </div>
  )
}
