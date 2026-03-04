'use client'

import { useState, useRef } from 'react'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'
import { X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import type { SimpleDiscrepancy } from '@/lib/supabase/types'

const LocationMap = dynamic(
  () => import('@/components/discrepancies/location-map'),
  { ssr: false },
)

interface SimpleDiscrepancyPanelProps {
  detail: SimpleDiscrepancy
  index: number
  onChange: (index: number, detail: SimpleDiscrepancy) => void
  /** Local (un-uploaded) photo previews for this discrepancy */
  localPhotos: { file: File; url: string; name: string }[]
  onAddPhotos: (index: number, files: FileList) => void
  onRemovePhoto: (index: number, photoIdx: number) => void
  onPointSelected: (index: number, lat: number, lng: number) => void
  onCaptureGps: (index: number) => void
  gpsLoading: boolean
  flyToPoint?: { lat: number; lng: number } | null
}

export function SimpleDiscrepancyPanel({
  detail,
  index,
  onChange,
  localPhotos,
  onAddPhotos,
  onRemovePhoto,
  onPointSelected,
  onCaptureGps,
  gpsLoading,
  flyToPoint,
}: SimpleDiscrepancyPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    onAddPhotos(index, files)
    e.target.value = ''
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    color: 'var(--color-text-3)',
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(239, 68, 68, 0.04)',
      border: '1px solid rgba(239, 68, 68, 0.15)',
      borderRadius: 8,
    }}>
      {/* Comment */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Comment / Description</label>
        <textarea
          value={detail.comment}
          onChange={(e) => onChange(index, { ...detail, comment: e.target.value })}
          placeholder="Describe the discrepancy..."
          rows={2}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 6,
            border: '1px solid var(--color-border)', background: 'var(--color-bg-input)',
            color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
            fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Map + side buttons layout */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Map — takes ~60% */}
        <div style={{ flex: '3 1 0', minWidth: 0 }}>
          <label style={labelStyle}>Pin Location on Map</label>
          <LocationMap
            onPointSelected={(lat, lng) => onPointSelected(index, lat, lng)}
            selectedLat={detail.location?.lat ?? null}
            selectedLng={detail.location?.lon ?? null}
            flyToPoint={flyToPoint}
          />
        </div>

        {/* Side buttons — takes ~40% */}
        <div style={{ flex: '2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* GPS button */}
          <button
            type="button"
            onClick={() => onCaptureGps(index)}
            disabled={gpsLoading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: 10, borderRadius: 8, minHeight: 44,
              border: '1px solid var(--color-border-active)', background: 'var(--color-border)',
              color: 'var(--color-accent)', fontSize: 'var(--fs-base)', fontWeight: 600,
              cursor: gpsLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: gpsLoading ? 0.6 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
            {gpsLoading ? 'Getting...' : 'Use My Location'}
          </button>

          {/* Photo button — full variant to match GPS button */}
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: 'none' }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
          <PhotoPickerButton
            onUpload={() => fileInputRef.current?.click()}
            onCapture={() => cameraInputRef.current?.click()}
            variant="full"
            label={localPhotos.length > 0 ? `Add Photo (${localPhotos.length})` : 'Add Photo'}
          />

          {/* Photo thumbnails */}
          {localPhotos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {localPhotos.map((p, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative', width: 56, height: 56, borderRadius: 6,
                    overflow: 'hidden', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                  }}
                  onClick={() => setViewerIndex(i)}
                >
                  <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemovePhoto(index, i) }}
                    style={{
                      position: 'absolute', top: 1, right: 1, width: 14, height: 14, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', cursor: 'pointer',
                      fontSize: 10, lineHeight: '14px', textAlign: 'center', padding: 0,
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo viewer modal */}
      {viewerIndex !== null && localPhotos.length > 0 && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)', padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setViewerIndex(null) }}
        >
          <button type="button" onClick={() => setViewerIndex(null)} style={{
            position: 'absolute', top: 12, right: 16, background: 'none',
            border: 'none', color: '#fff', fontSize: 32, cursor: 'pointer', zIndex: 10,
          }}>
            <X size={28} />
          </button>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 8 }}>
            {localPhotos[viewerIndex].name} — {viewerIndex + 1} of {localPhotos.length}
          </div>
          <img
            src={localPhotos[viewerIndex].url}
            alt={localPhotos[viewerIndex].name}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
          />
          {localPhotos.length > 1 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <button type="button" onClick={() => setViewerIndex(i => ((i ?? 0) - 1 + localPhotos.length) % localPhotos.length)}
                style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: 'pointer' }}>
                Prev
              </button>
              <button type="button" onClick={() => setViewerIndex(i => ((i ?? 0) + 1) % localPhotos.length)}
                style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: 'pointer' }}>
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
