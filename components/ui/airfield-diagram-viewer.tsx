'use client'

import { useState, useEffect } from 'react'
import { getAirfieldDiagram } from '@/lib/airfield-diagram'
import { useInstallation } from '@/lib/installation-context'
import { ZoomableImage } from '@/components/ui/zoomable-image'

/**
 * Button that opens a fullscreen airfield diagram overlay.
 * Only renders if a diagram has been uploaded for the current base.
 */
export function AirfieldDiagramButton() {
  const { installationId } = useInstallation()
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!installationId) return
    getAirfieldDiagram(installationId).then(setDiagramUrl)
  }, [installationId])

  if (!diagramUrl) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          width: '100%',
        }}
      >
        <span style={{ fontSize: 'var(--fs-5xl)' }}>🗺️</span>
        <span style={{ fontSize: 'var(--fs-xl)', color: 'var(--color-cyan)', letterSpacing: '0.04em', fontWeight: 700 }}>
          Airfield Diagram
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          onTouchEnd={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '60px 12px 24px',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            style={{
              position: 'fixed', top: 12, right: 12, zIndex: 10000,
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
              padding: '10px 18px', color: '#fff', fontSize: 'var(--fs-xl)', fontWeight: 700, cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >Close</button>
          <div onClick={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
            <ZoomableImage
              src={diagramUrl}
              alt="Airfield Diagram"
              style={{ maxHeight: 'calc(100vh - 100px)' }}
            />
          </div>
        </div>
      )}
    </>
  )
}
