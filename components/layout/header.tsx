'use client'

import Link from 'next/link'
import { useTheme } from '@/lib/theme-context'

// Header: gradient bg, logo centered
export function Header() {
  const { resolvedTheme } = useTheme()

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
