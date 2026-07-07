'use client'

import { useState, useEffect } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { PhotoPickerInput } from '@/components/ui/photo-picker-input'
import { uploadAcsiPhoto, fetchAcsiPhotos } from '@/lib/supabase/acsi-inspections'
import { fetchDiscrepancyPhotos } from '@/lib/supabase/discrepancies'
import { photoUrl } from '@/lib/supabase/photos'
import { toast } from 'sonner'
import { X, Check, Link2 } from 'lucide-react'
import type { AcsiDiscrepancyDetail } from '@/lib/supabase/types'

interface AcsiDiscrepancyPanelProps {
  itemId: string
  detail: AcsiDiscrepancyDetail
  index: number
  onChange: (itemId: string, index: number, detail: AcsiDiscrepancyDetail) => void
  inspectionId?: string | null
  correctiveActionLabel?: string
}

export function AcsiDiscrepancyPanel({ itemId, detail, index, onChange, inspectionId, correctiveActionLabel = 'Risk Control Measure' }: AcsiDiscrepancyPanelProps) {
  const { areas: installationAreas, installationId } = useInstallation()
  const [uploading, setUploading] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<{ url: string; name: string }[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)


  // Stable key for photo_ids to use as effect dependency
  const photoIdsKey = detail.photo_ids?.join(',') || ''

  // Load photos from DB — fires on mount, when linked, or when photo_ids change
  useEffect(() => {
    if (!detail.photo_ids?.length) { setPhotoUrls([]); return }
    let cancelled = false

    const loadPhotos = async () => {
      const photoIdSet = new Set(detail.photo_ids)
      let matched: { id: string; storage_path: string; file_name: string }[] = []

      // Try ACSI photos first
      if (inspectionId) {
        const acsiPhotos = await fetchAcsiPhotos(inspectionId)
        matched = acsiPhotos.filter(p => photoIdSet.has(p.id))
      }

      // If we didn't find all photos and this is linked to discrepancies, check there too
      if (matched.length < detail.photo_ids.length && detail.linked_discrepancy_id) {
        const linkedIds = detail.linked_discrepancy_id.split(',').filter(Boolean)
        const foundIds = new Set(matched.map(m => m.id))
        for (const discId of linkedIds) {
          if (matched.length >= detail.photo_ids.length) break
          const discPhotos = await fetchDiscrepancyPhotos(discId)
          const additional = discPhotos.filter(p => photoIdSet.has(p.id) && !foundIds.has(p.id))
          for (const p of additional) foundIds.add(p.id)
          matched = [...matched, ...additional]
        }
      }

      if (cancelled) return
      setPhotoUrls(matched.map(p => ({
        url: photoUrl(p.storage_path),
        name: p.file_name,
      })))
    }

    loadPhotos()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, detail.linked_discrepancy_id, photoIdsKey])

  const update = (field: keyof AcsiDiscrepancyDetail, value: unknown) => {
    onChange(itemId, index, { ...detail, [field]: value })
  }

  const toggleArea = (area: string) => {
    const current = detail.areas || []
    const next = current.includes(area)
      ? current.filter(a => a !== area)
      : [...current, area]
    update('areas', next)
  }

  const handlePhoto = async (files: FileList) => {
    if (!files?.length) return

    if (!inspectionId) {
      toast.error('Please save the draft first before uploading photos')
      return
    }

    setUploading(true)
    let uploaded = 0
    const newPhotoIds = [...(detail.photo_ids || [])]

    for (const file of Array.from(files)) {
      const { data, error } = await uploadAcsiPhoto(inspectionId, file, itemId, installationId, index)
      if (!error && data) {
        uploaded++
        newPhotoIds.push(data.id)
        const url = photoUrl(data.storage_path)
        setPhotoUrls(prev => [...prev, { url, name: data.file_name }])
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} photo(s) uploaded`)
      update('photo_ids', newPhotoIds)
    }
    setUploading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-input)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-sm)',
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
      background: 'color-mix(in srgb, var(--color-danger) 4%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-danger) 18%, transparent)',
      borderRadius: 8,
    }}>

      {/* Linked badge */}
      {detail.linked_discrepancy_id && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8,
          padding: '4px 10px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
          fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-cyan)',
        }}>
          <Link2 size={12} />
          Linked from discrepancy tracker
        </div>
      )}

      {/* Comment */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Comment / Description</label>
        <textarea
          value={detail.comment}
          onChange={(e) => {
            update('comment', e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          ref={(el) => {
            if (el && detail.comment) {
              el.style.height = 'auto'
              el.style.height = el.scrollHeight + 'px'
            }
          }}
          placeholder="Describe the discrepancy..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', overflow: 'hidden' }}
        />
      </div>

      {/* Grid: WO#, Project#, Cost, ECD */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10,
        marginBottom: 12,
      }}>
        <div>
          <label style={labelStyle}>Work Order #</label>
          <input
            type="text"
            value={detail.work_order}
            onChange={(e) => update('work_order', e.target.value)}
            placeholder="WO-2026-XXXX"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Project #</label>
          <input
            type="text"
            value={detail.project_number}
            onChange={(e) => update('project_number', e.target.value)}
            placeholder="Project number"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Estimated Cost</label>
          <input
            type="text"
            value={detail.estimated_cost}
            onChange={(e) => update('estimated_cost', e.target.value)}
            placeholder="$0"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Est. Completion Date</label>
          <input
            type="date"
            value={detail.estimated_completion}
            onChange={(e) => update('estimated_completion', e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Corrective action — required on unsatisfactory items */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          {correctiveActionLabel} <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <textarea
          value={detail.risk_control_measure || ''}
          onChange={(e) => {
            update('risk_control_measure', e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          ref={(el) => {
            if (el && detail.risk_control_measure) {
              el.style.height = 'auto'
              el.style.height = el.scrollHeight + 'px'
            }
          }}
          placeholder="Mitigation or interim control in place while the finding is open (required)"
          rows={2}
          style={{
            ...inputStyle,
            resize: 'vertical',
            overflow: 'hidden',
            borderColor: (detail.risk_control_measure || '').trim()
              ? 'var(--color-border)'
              : 'color-mix(in srgb, var(--color-danger) 60%, transparent)',
          }}
        />
      </div>

      {/* Area chips — chip cluster pattern (feedback_chip_cluster_pattern.md):
          one bordered container holds all area pills so 15+ runway/taxiway
          chips read as one widget rather than fifteen independently-bordered
          decisions. Selected items get a tinted bg pill + bold weight,
          unselected items render as dim letter-style text. */}
      {installationAreas.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Affected Areas</label>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4,
            padding: 4,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)',
          }}>
            {installationAreas.map(area => {
              const selected = (detail.areas || []).includes(area)
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: selected
                      ? 'color-mix(in srgb, var(--color-cyan) 18%, transparent)'
                      : 'transparent',
                    color: selected ? 'var(--color-cyan)' : 'var(--color-text-4)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: selected ? 700 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {selected && <Check size={11} strokeWidth={3} />}
                  {area}
                </button>
              )
            })}
          </div>
          {(detail.areas || []).length > 0 && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
              {(detail.areas || []).length} area(s) selected
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      <div>
        <label style={labelStyle}>Photos</label>

        {/* Photo thumbnails */}
        {photoUrls.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {photoUrls.map((p, i) => (
              <div
                key={i}
                style={{
                  position: 'relative', width: 64, height: 64, borderRadius: 8,
                  overflow: 'hidden', border: '1px solid var(--color-border)', cursor: 'pointer',
                }}
                onClick={() => setViewerIndex(i)}
              >
                <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        <PhotoPickerInput
          onFiles={handlePhoto}
          disabled={uploading}
          variant="compact"
          label={uploading ? 'Uploading...' : photoUrls.length > 0 ? `Add Photo (${photoUrls.length})` : 'Add Photo'}
        />
      </div>

      {/* Photo viewer modal */}
      {viewerIndex !== null && photoUrls.length > 0 && (
        <div
          className="modal-overlay"
          style={{
            flexDirection: 'column',
            background: 'rgba(0,0,0,0.9)',
          }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setViewerIndex(null) }}
        >
          <button type="button" onClick={() => setViewerIndex(null)} style={{
            position: 'absolute', top: 12, right: 16, background: 'none',
            border: 'none', color: '#fff', fontSize: 32, cursor: 'pointer', zIndex: 10,
          }}>
            <X size={28} />
          </button>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 8 }}>
            {photoUrls[viewerIndex].name} — {viewerIndex + 1} of {photoUrls.length}
          </div>
          <img
            src={photoUrls[viewerIndex].url}
            alt={photoUrls[viewerIndex].name}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
          />
          {photoUrls.length > 1 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <button type="button" onClick={() => setViewerIndex(i => ((i ?? 0) - 1 + photoUrls.length) % photoUrls.length)}
                style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: 'pointer' }}>
                Prev
              </button>
              <button type="button" onClick={() => setViewerIndex(i => ((i ?? 0) + 1) % photoUrls.length)}
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
