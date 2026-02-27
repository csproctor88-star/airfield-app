'use client'

import { useState, useEffect } from 'react'
import { getAirfieldDiagram } from '@/lib/airfield-diagram'
import { useInstallation } from '@/lib/installation-context'

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
        <span style={{ fontSize: 24 }}>🗺️</span>
        <span style={{ fontSize: 15, color: 'var(--color-cyan)', letterSpacing: '0.04em', fontWeight: 700 }}>
          Airfield Diagram
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              gap: 8,
              zIndex: 301,
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false) }}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={diagramUrl}
            alt="Airfield Diagram"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 80px)',
              objectFit: 'contain',
              borderRadius: 8,
            }}
          />
        </div>
      )}
    </>
  )
}
