'use client'

import Link from 'next/link'

// Header: gradient bg, centered logo

export function Header() {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, var(--color-bg-header-start), var(--color-bg-header-end))',
        borderBottom: '1px solid var(--color-header-border)',
        padding: '12px 16px 10px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Link href="/" style={{ textDecoration: 'none' }}>
        <img
          src="/glidepath2.png"
          alt="Glidepath"
          style={{
            display: 'block',
            height: 72,
            objectFit: 'contain',
          }}
        />
      </Link>
    </div>
  )
}
