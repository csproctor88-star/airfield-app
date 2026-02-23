'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ChevronDown } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'

// Header: gradient bg, logo, installation name + ICAO, sync + status dot

export function Header() {
  const [syncing, setSyncing] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const { currentInstallation, allInstallations, switchInstallation } = useInstallation()

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => setSyncing(false), 1500)
  }

  const icao = currentInstallation?.icao || ''
  const displayName = currentInstallation
    ? currentInstallation.name.replace(/ Air National Guard Base| Air Force Base| Air Reserve Base/i, '').trim()
    : ''
  const hasMultipleInstallations = allInstallations.length > 1

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
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #F1F5F9, #38BDF8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              GLIDEPATH
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.12em' }}>
                {displayName ? `${displayName.toUpperCase()} \u2022 ${icao}` : 'AIRFIELD OPS'}
              </div>
              {hasMultipleInstallations && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowSwitcher(!showSwitcher)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronDown size={10} color="#64748B" />
                </button>
              )}
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

      {/* Installation switcher dropdown */}
      {showSwitcher && hasMultipleInstallations && (
        <div
          style={{
            marginTop: 8,
            background: '#0F1729',
            borderRadius: 8,
            border: '1px solid rgba(56,189,248,0.1)',
            overflow: 'hidden',
          }}
        >
          {allInstallations.map((inst) => (
            <button
              key={inst.id}
              onClick={() => {
                switchInstallation(inst.id)
                setShowSwitcher(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                background: inst.id === currentInstallation?.id ? 'rgba(56,189,248,0.08)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(56,189,248,0.05)',
                cursor: 'pointer',
                textAlign: 'left',
                color: inst.id === currentInstallation?.id ? '#38BDF8' : '#94A3B8',
                fontSize: 13,
                fontWeight: inst.id === currentInstallation?.id ? 700 : 500,
              }}
            >
              {inst.name}
              <span style={{ fontSize: 10, marginLeft: 8, opacity: 0.6 }}>{inst.icao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
