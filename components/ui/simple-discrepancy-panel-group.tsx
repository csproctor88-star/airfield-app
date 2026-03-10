'use client'

import { SimpleDiscrepancyPanel } from './simple-discrepancy-panel'
import { Plus, Trash2 } from 'lucide-react'
import type { SimpleDiscrepancy } from '@/lib/supabase/types'

interface SimpleDiscrepancyPanelGroupProps {
  discrepancies: SimpleDiscrepancy[]
  onChange: (index: number, detail: SimpleDiscrepancy) => void
  onAdd: () => void
  onRemove: (index: number) => void
  /** Local photo arrays, one per discrepancy */
  localPhotos: { file: File; url: string; name: string }[][]
  onAddPhotos: (index: number, files: FileList) => void
  onRemovePhoto: (index: number, photoIdx: number) => void
  onPointSelected: (index: number, lat: number, lng: number) => void
  onCaptureGps: (index: number) => void
  gpsLoadingIndex: number | null
  flyToPoints: ({ lat: number; lng: number } | null)[]
  /** Header label — defaults to "Discrepancy Details" */
  headerLabel?: string
  /** Button label for adding — defaults to "Add Discrepancy" */
  addLabel?: string
  /** Optional callback to save the entire form as a draft */
  onSaveDraft?: () => void
  /** Whether a draft save is currently in progress */
  draftSaving?: boolean
  /** Available areas for the discrepancy location dropdown */
  areaOptions?: string[]
}

export function SimpleDiscrepancyPanelGroup({
  discrepancies,
  onChange,
  onAdd,
  onRemove,
  localPhotos,
  onAddPhotos,
  onRemovePhoto,
  onPointSelected,
  onCaptureGps,
  gpsLoadingIndex,
  flyToPoints,
  headerLabel = 'Discrepancy Details',
  addLabel = 'Add Discrepancy',
  onSaveDraft,
  draftSaving,
  areaOptions,
}: SimpleDiscrepancyPanelGroupProps) {
  return (
    <div style={{ marginTop: 4 }}>
      {/* Header */}
      <div style={{
        fontSize: 'var(--fs-xs)',
        fontWeight: 700,
        color: '#EF4444',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
      }}>
        {headerLabel}
      </div>

      {/* Individual panels */}
      {discrepancies.map((disc, i) => (
        <div key={i} style={{ marginBottom: 8, position: 'relative' }}>
          {discrepancies.length > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <div style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 700,
                color: '#EF4444',
              }}>
                {headerLabel.replace(' Details', '')} {i + 1} of {discrepancies.length}
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#EF4444',
                  fontSize: 'var(--fs-xs)',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          )}
          <SimpleDiscrepancyPanel
            detail={disc}
            index={i}
            onChange={onChange}
            localPhotos={localPhotos[i] || []}
            onAddPhotos={onAddPhotos}
            onRemovePhoto={onRemovePhoto}
            onPointSelected={onPointSelected}
            onCaptureGps={onCaptureGps}
            gpsLoading={gpsLoadingIndex === i}
            flyToPoint={flyToPoints[i] || null}
            onSaveDraft={onSaveDraft}
            draftSaving={draftSaving}
            areaOptions={areaOptions}
          />
        </div>
      ))}

      {/* Add button */}
      <button
        type="button"
        onClick={onAdd}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: 8,
          border: '2px dashed rgba(239, 68, 68, 0.3)',
          background: 'transparent',
          color: '#EF4444',
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Plus size={16} />
        {addLabel}
      </button>
    </div>
  )
}
