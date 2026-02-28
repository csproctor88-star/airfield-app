'use client'

import Link from 'next/link'
import { useTheme } from '@/lib/theme-context'

// Header: logo only, centered
export function Header() {
  const { resolvedTheme } = useTheme()

  return (
    <div
      style={{
        background: resolvedTheme === 'dark'
          ? 'linear-gradient(180deg, var(--color-bg-header-start), var(--color-bg-header-end))'
          : '#ffffff',
        borderBottom: resolvedTheme === 'dark' ? 'none' : '2px solid var(--color-header-border)',
        padding: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Link href="/" style={{ textDecoration: 'none', lineHeight: 0 }}>
        <img
          src="/glidepathdarkmode2.png"
          alt="Glidepath"
          style={{
            display: 'block',
            height: 'var(--header-logo-height)',
            objectFit: 'contain',
          }}
        />
      </Link>
    </div>
  )
}
