'use client'

import { useCallback } from 'react'
import dynamic from 'next/dynamic'
import { AcsiDiscrepancyPanel } from './acsi-discrepancy-panel'
import { Plus, Trash2 } from 'lucide-react'
import type { AcsiDiscrepancyDetail } from '@/lib/supabase/types'

const AcsiLocationMap = dynamic(() => import('@/components/acsi/acsi-location-map'), { ssr: false })

interface AcsiDiscrepancyPanelGroupProps {
  itemId: string
  discrepancies: AcsiDiscrepancyDetail[]
  onChange: (itemId: string, index: number, detail: AcsiDiscrepancyDetail) => void
  onAdd: (itemId: string) => void
  onRemove: (itemId: string, index: number) => void
  inspectionId?: string | null
}

export function AcsiDiscrepancyPanelGroup({
  itemId,
  discrepancies,
  onChange,
  onAdd,
  onRemove,
  inspectionId,
}: AcsiDiscrepancyPanelGroupProps) {
  const pins = discrepancies[0]?.pins || []

  const handlePinsChange = useCallback((newPins: { lat: number; lng: number }[]) => {
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
        color: '#EF4444',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
      }}>
        Discrepancy Details (Per 5.4.3.4)
      </div>

      {/* Shared location map */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(239, 68, 68, 0.04)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
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
                color: '#EF4444',
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
          <AcsiDiscrepancyPanel
            itemId={itemId}
            detail={disc}
            index={i}
            onChange={onChange}
            inspectionId={inspectionId}
          />
        </div>
      ))}

      {/* Add Discrepancy button */}
      <button
        type="button"
        onClick={() => onAdd(itemId)}
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
        Add Discrepancy
      </button>
    </div>
  )
}
