'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'

// Header: gradient bg, logo, installation name + ICAO, sync + status dot

export function Header() {
  const [showSwitcher, setShowSwitcher] = useState(false)
  const { currentInstallation, allInstallations, switchInstallation, userRole } = useInstallation()

  const icao = currentInstallation?.icao || ''
  const displayName = currentInstallation?.name || ''
  const canSwitchInstallation = allInstallations.length > 1
    && (userRole === 'airfield_manager' || userRole === 'sys_admin')

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, var(--color-bg-header-start), var(--color-bg-header-end))',
        borderBottom: '1px solid var(--color-border)',
        padding: '12px 16px 10px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img
            src="/glidepath2.png"
            alt="Glidepath"
            style={{
              display: 'block',
              height: 56,
              objectFit: 'contain',
            }}
          />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.12em' }}>
            {displayName ? `${displayName.toUpperCase()}${icao ? ` \u2022 ${icao}` : ''}` : 'AIRFIELD OPS'}
          </div>
          {canSwitchInstallation && (
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
              <ChevronDown size={10} color="var(--color-text-3)" />
            </button>
          )}
        </div>
      </div>

      {/* Installation switcher dropdown */}
      {showSwitcher && canSwitchInstallation && (
        <div
          style={{
            marginTop: 8,
            background: 'var(--color-bg-elevated)',
            borderRadius: 8,
            border: '1px solid var(--color-border-mid)',
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
                borderBottom: '1px solid var(--color-border)',
                cursor: 'pointer',
                textAlign: 'left',
                color: inst.id === currentInstallation?.id ? 'var(--color-accent)' : 'var(--color-text-2)',
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
