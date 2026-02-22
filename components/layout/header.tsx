'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

// Header: gradient bg, logo image, sync + status dot

export function Header() {
  const [syncing, setSyncing] = useState(false)

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => setSyncing(false), 1500)
  }

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #0A1220, #070D18)',
        borderBottom: '1px solid rgba(56,189,248,0.06)',
        padding: '12px 16px 10px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image
            src="/glidepath-logo.png"
            alt="GLIDEPATH"
            width={180}
            height={40}
            style={{ objectFit: 'contain' }}
            priority
          />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleSync}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw
              size={16}
              color="#94A3B8"
              style={{
                transition: 'transform 0.3s',
                transform: syncing ? 'rotate(360deg)' : 'none',
              }}
            />
          </button>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#34D399',
            }}
          />
        </div>
      </div>
    </div>
  )
}
