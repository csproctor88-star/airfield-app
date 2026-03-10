'use client'

import { useState, useRef } from 'react'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'
import { X, AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { DISCREPANCY_TYPES, SEVERITY_CONFIG } from '@/lib/constants'
import type { SimpleDiscrepancy } from '@/lib/supabase/types'

const LocationMap = dynamic(
  () => import('@/components/ui/location-picker-map'),
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
  /** Optional callback to save the entire form as a draft */
  onSaveDraft?: () => void
  /** Whether a draft save is currently in progress */
  draftSaving?: boolean
  /** Available areas for the discrepancy location dropdown */
  areaOptions?: string[]
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
  onSaveDraft,
  draftSaving,
  areaOptions,
}: SimpleDiscrepancyPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    onAddPhotos(index, files)
    e.target.value = ''
  }

  const handleDiscrepancyFieldChange = (field: string, value: string | boolean) => {
    onChange(index, { [field]: value } as unknown as SimpleDiscrepancy)
  }

  const logAsDisc = detail.log_as_discrepancy || false

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
      {/* Map (left) | Comment + Buttons (right) */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Left column: Map — takes ~60% */}
        <div style={{ flex: '3 1 0', minWidth: 0 }}>
          <label style={labelStyle}>Pin Location on Map</label>
          <LocationMap
            onPointSelected={(lat, lng) => onPointSelected(index, lat, lng)}
            selectedLat={detail.location?.lat ?? null}
            selectedLng={detail.location?.lon ?? null}
            flyToPoint={flyToPoint}
          />
        </div>

        {/* Right column: Comment + Buttons — takes ~40% */}
        <div style={{ flex: '2 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label style={labelStyle}>Comment / Description</label>
            <textarea
              value={detail.comment}
              onChange={(e) => {
                // Only pass comment — location and photo_ids are managed by their own handlers
                // This prevents stale render props from overwriting data
                onChange(index, { comment: e.target.value } as SimpleDiscrepancy)
              }}
              placeholder="Describe the discrepancy..."
              rows={4}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 6,
                border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Location / Area */}
          {areaOptions && areaOptions.length > 0 && (
            <div>
              <label style={labelStyle}>Location / Area</label>
              <select
                value={detail.location_text || ''}
                onChange={(e) => handleDiscrepancyFieldChange('location_text', e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              >
                <option value="">Select area...</option>
                {areaOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

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

          {/* Use My Location */}
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

          {/* Upload Photos */}
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: 'none' }} />
          <PhotoPickerButton
            onUpload={() => fileInputRef.current?.click()}
            variant="full"
            label={localPhotos.length > 0 ? `Add Photo (${localPhotos.length})` : 'Add Photo'}
          />

          {/* Save Draft */}
          {onSaveDraft && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={draftSaving}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: 10, borderRadius: 8, minHeight: 44,
                border: '1.5px solid rgba(59,130,246,0.5)',
                background: 'rgba(59,130,246,0.08)',
                color: 'var(--color-accent)', fontSize: 'var(--fs-base)', fontWeight: 600,
                cursor: draftSaving ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: draftSaving ? 0.7 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {draftSaving ? 'Saving...' : 'Save Draft'}
            </button>
          )}
        </div>
      </div>

      {/* ── Log as Discrepancy Toggle ── */}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={() => handleDiscrepancyFieldChange('log_as_discrepancy', !logAsDisc)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700,
            width: '100%', padding: '10px 12px', borderRadius: 8,
            border: logAsDisc ? '2px solid #D97706' : '2px solid var(--color-text-4)',
            background: logAsDisc ? 'rgba(217, 119, 6, 0.08)' : 'transparent',
            color: logAsDisc ? '#D97706' : 'var(--color-text-2)',
          }}
        >
          <span style={{
            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
            border: logAsDisc ? '2px solid #D97706' : '2px solid var(--color-text-3)',
            background: logAsDisc ? '#D97706' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#FFFFFF',
          }}>
            {logAsDisc ? '\u2713' : ''}
          </span>
          <AlertTriangle size={16} />
          Log as Airfield Discrepancy
        </button>

        {/* ── Discrepancy Form Fields (shown when toggle is on) ── */}
        {logAsDisc && (
          <div style={{
            marginTop: 8, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(217, 119, 6, 0.04)',
            border: '1px solid rgba(217, 119, 6, 0.2)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#D97706',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Discrepancy Details
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={detail.discrepancy_title ?? detail.comment.slice(0, 100)}
                onChange={(e) => handleDiscrepancyFieldChange('discrepancy_title', e.target.value)}
                placeholder="Short title for the discrepancy..."
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Area — auto-filled from issue location_text */}
            {detail.location_text && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Area: </span>
                {detail.location_text}
              </div>
            )}

            {/* Type */}
            <div>
              <label style={labelStyle}>Type</label>
              <select
                value={detail.discrepancy_type || ''}
                onChange={(e) => handleDiscrepancyFieldChange('discrepancy_type', e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              >
                <option value="">Select type...</option>
                {DISCREPANCY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label style={labelStyle}>Severity</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(SEVERITY_CONFIG) as Array<keyof typeof SEVERITY_CONFIG>).map((sev) => {
                  const cfg = SEVERITY_CONFIG[sev]
                  const selected = detail.discrepancy_severity === sev
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => handleDiscrepancyFieldChange('discrepancy_severity', selected ? '' : sev)}
                      style={{
                        padding: '6px 12px', borderRadius: 6, fontFamily: 'inherit',
                        fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer',
                        border: selected ? `2px solid ${cfg.color}` : '1px solid var(--color-border)',
                        background: selected ? cfg.bg : 'transparent',
                        color: selected ? cfg.color : 'var(--color-text-3)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
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
