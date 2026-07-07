'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { AcsiDiscrepancyPanel } from './acsi-discrepancy-panel'
import { AcsiDiscrepancyPicker } from './acsi-discrepancy-picker'
import { Plus, Trash2, Link2 } from 'lucide-react'
import type { AcsiDiscrepancyDetail } from '@/lib/supabase/types'

const AcsiLocationMap = dynamic(() => import('@/components/acsi/acsi-location-map-google'), { ssr: false })

interface AcsiDiscrepancyPanelGroupProps {
  itemId: string
  discrepancies: AcsiDiscrepancyDetail[]
  onChange: (itemId: string, index: number, detail: AcsiDiscrepancyDetail) => void
  onAdd: (itemId: string) => void
  onRemove: (itemId: string, index: number) => void
  onLinkExisting?: (itemId: string, detail: AcsiDiscrepancyDetail) => void
  alreadyLinkedIds?: Set<string>
  inspectionId?: string | null
  correctiveActionLabel?: string
}

export function AcsiDiscrepancyPanelGroup({
  itemId,
  discrepancies,
  onChange,
  onAdd,
  onRemove,
  onLinkExisting,
  alreadyLinkedIds,
  inspectionId,
  correctiveActionLabel,
}: AcsiDiscrepancyPanelGroupProps) {
  const [showPicker, setShowPicker] = useState(false)
  const pins = discrepancies.flatMap(d => d.pins || [])

  const handlePinsChange = useCallback((newPins: { lat: number; lng: number }[]) => {
    // Distribute pins back: first disc owns them all (other discs keep
    // their own for persistence, but the shared map edits disc[0]).
    const first = discrepancies[0]
    if (first) {
      onChange(itemId, 0, { ...first, pins: newPins })
    }
  }, [itemId, discrepancies, onChange])

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    color: 'var(--color-text-3)',
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div style={{ margin: '4px 0 8px 54px' }}>
      {/* Header */}
      <div style={{
        fontSize: 'var(--fs-xs)',
        fontWeight: 700,
        color: 'var(--color-danger)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
      }}>
        Discrepancy Details (Per 5.4.3.4)
      </div>

      {/* Shared location map */}
      <div style={{
        padding: '10px 14px',
        background: 'color-mix(in srgb, var(--color-danger) 4%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-danger) 18%, transparent)',
        borderRadius: 8,
        marginBottom: 8,
      }}>
        <label style={labelStyle}>Location(s) — tap map to add pins</label>
        <AcsiLocationMap pins={pins} onPinsChange={handlePinsChange} />
      </div>

      {/* Individual discrepancy panels */}
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
                color: 'var(--color-danger)',
              }}>
                Discrepancy {i + 1} of {discrepancies.length}
              </div>
              <button
                type="button"
                onClick={() => onRemove(itemId, i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                  color: 'var(--color-danger)',
                  fontSize: 'var(--fs-xs)',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          )}
          <AcsiDiscrepancyPanel
            itemId={itemId}
            detail={disc}
            index={i}
            onChange={onChange}
            inspectionId={inspectionId}
            correctiveActionLabel={correctiveActionLabel}
          />
        </div>
      ))}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => onAdd(itemId)}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: 8,
            border: '2px dashed color-mix(in srgb, var(--color-danger) 35%, transparent)',
            background: 'transparent',
            color: 'var(--color-danger)',
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
          Add New
        </button>
        {onLinkExisting && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              border: '2px dashed color-mix(in srgb, var(--color-cyan) 35%, transparent)',
              background: 'transparent',
              color: 'var(--color-cyan)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Link2 size={16} />
            Link Existing
          </button>
        )}
      </div>

      {/* Discrepancy picker modal */}
      {showPicker && onLinkExisting && (
        <AcsiDiscrepancyPicker
          onSelect={(detail) => {
            onLinkExisting(itemId, detail)
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
          alreadyLinkedIds={alreadyLinkedIds}
        />
      )}
    </div>
  )
}
