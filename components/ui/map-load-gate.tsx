'use client'

import { useState, type ReactNode } from 'react'

/**
 * Wraps a map component with a "Tap to load" gate.
 * On slow networks (gov), Mapbox GL JS initialization floods the connection
 * and blocks the entire app. This gate prevents the map from loading until
 * the user explicitly clicks, keeping the rest of the page responsive.
 *
 * Set `autoLoad` to true to bypass the gate (e.g., on fast networks).
 */
export default function MapLoadGate({
  children,
  autoLoad = false,
  label = 'Tap to load map',
  height,
}: {
  children: ReactNode
  autoLoad?: boolean
  label?: string
  height?: string | number
}) {
  const [loaded, setLoaded] = useState(autoLoad)

  if (loaded) return <>{children}</>

  return (
    <div
      onClick={() => setLoaded(true)}
      style={{
        width: '100%',
        aspectRatio: height ? undefined : '3 / 4',
        maxHeight: height || '70vh',
        height: height || undefined,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--color-border-mid)',
        background: 'var(--color-bg-inset)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 32, opacity: 0.5 }}>🗺️</div>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-3)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
        Map loads on demand to keep the app responsive
      </div>
    </div>
  )
}
