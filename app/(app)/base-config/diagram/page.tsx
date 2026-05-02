'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { saveAirfieldDiagram, getAirfieldDiagram, deleteAirfieldDiagram } from '@/lib/airfield-diagram'

export default function AirfieldDiagramPage() {
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const canManage = has(PERM.BASE_SETUP_WRITE)
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null)
  const [diagramLoaded, setDiagramLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!installationId) return
    getAirfieldDiagram(installationId).then((url) => {
      setDiagramUrl(url)
      setDiagramLoaded(true)
    })
  }, [installationId])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !installationId) return
    setUploading(true)
    try {
      await saveAirfieldDiagram(installationId, file)
      const url = await getAirfieldDiagram(installationId)
      setDiagramUrl(url)
      toast.success('Airfield diagram saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save diagram')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemove = async () => {
    if (!installationId) return
    await deleteAirfieldDiagram(installationId)
    setDiagramUrl(null)
    toast.success('Airfield diagram removed')
  }

  if (!canManage) {
    return (
      <div className="page-container">
        <div style={{ padding: 24, color: 'var(--color-text-3)' }}>
          You don&rsquo;t have permission to manage the airfield diagram.
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 12 }}>
        <Link href="/base-config" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-md)', textDecoration: 'none' }}>
          &larr; Base Configuration
        </Link>
      </div>

      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)', margin: 0 }}>
        Airfield Diagram
      </h1>
      <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)', marginTop: 4 }}>
        {currentInstallation?.name}{currentInstallation?.icao ? ` (${currentInstallation.icao})` : ''}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)' }}>
            Upload diagram
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4 }}>
            PNG or JPEG. Used for quick reference across the app — discrepancy detail, inspections, parking, and the kiosk display.
          </div>
        </div>

        {diagramLoaded && diagramUrl && (
          <div style={{ borderRadius: 'var(--radius-base)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={diagramUrl}
              alt="Airfield Diagram"
              style={{ width: '100%', display: 'block', maxHeight: 480, objectFit: 'contain', background: 'var(--color-bg-elevated)' }}
            />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              flex: '1 1 200px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 'var(--radius-base)',
              background: 'var(--color-cyan)',
              border: 'none',
              color: 'var(--color-cyan-btn-text)',
              fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Saving...' : diagramUrl ? 'Replace Diagram' : 'Upload Diagram'}
          </button>
          {diagramUrl && (
            <button
              onClick={handleRemove}
              style={{
                padding: '10px 16px', borderRadius: 'var(--radius-base)',
                background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 28%, transparent)',
                color: 'var(--color-danger)',
                fontSize: 'var(--fs-md)', fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Trash2 size={14} />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
