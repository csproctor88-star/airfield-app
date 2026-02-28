'use client'

import Link from 'next/link'

// Header: logo only, centered
export function Header() {
  return (
    <div
      style={{
        padding: 0,
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
