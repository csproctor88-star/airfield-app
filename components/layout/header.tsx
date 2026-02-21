'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

// Header: gradient bg, logo, "GLIDEPATH" gradient text, sync + status dot

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
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: 'linear-gradient(135deg, #0C4A6E, #38BDF8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              boxShadow: '0 0 16px rgba(56,189,248,0.15)',
            }}
          >
            ✈️
          </div>
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #F1F5F9, #38BDF8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              GLIDEPATH
            </div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, letterSpacing: '0.12em' }}>
              SELFRIDGE ANGB &bull; KMTC
            </div>
          </div>
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
