'use client'

import Link from 'next/link'

// Header: logo only, centered
export function Header() {
  return (
    <div
      style={{
        background: 'transparent',
        borderBottom: 'none',
        padding: 0,
        margin: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        lineHeight: 0,
        fontSize: 0,
      }}
    >
      <Link href="/" style={{ textDecoration: 'none', lineHeight: 0, display: 'block', margin: 0, padding: 0 }}>
        <img
          src="/glidepathdarkmode2.png"
          alt="Glidepath"
          style={{
            display: 'block',
            height: 'var(--header-logo-height)',
            width: 'auto',
            margin: 0,
            padding: 0,
            verticalAlign: 'top',
          }}
        />
      </Link>
    </div>
  )
}
