'use client'

import { useState, useRef, useEffect } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'
import { uploadAcsiPhoto, fetchAcsiPhotos } from '@/lib/supabase/acsi-inspections'
import { toast } from 'sonner'
import { X, Check } from 'lucide-react'
import type { AcsiDiscrepancyDetail } from '@/lib/supabase/types'

interface AcsiDiscrepancyPanelProps {
  itemId: string
  detail: AcsiDiscrepancyDetail
  index: number
  onChange: (itemId: string, index: number, detail: AcsiDiscrepancyDetail) => void
  inspectionId?: string | null
}

export function AcsiDiscrepancyPanel({ itemId, detail, index, onChange, inspectionId }: AcsiDiscrepancyPanelProps) {
  const { areas: installationAreas, installationId } = useInstallation()
  const [uploading, setUploading] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<{ url: string; name: string }[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)


  // Load existing photos from DB when draft is loaded on another device
  useEffect(() => {
    if (!inspectionId || !detail.photo_ids?.length || photoUrls.length > 0) return
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
    let cancelled = false

    fetchAcsiPhotos(inspectionId).then(allPhotos => {
      if (cancelled) return
      const photoIdSet = new Set(detail.photo_ids)
      const matched = allPhotos.filter(p => photoIdSet.has(p.id))
      if (matched.length > 0) {
        setPhotoUrls(matched.map(p => ({
          url: p.storage_path.startsWith('data:')
            ? p.storage_path
            : supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/photos/${p.storage_path}` : p.storage_path,
          name: p.file_name,
        })))
      }
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

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

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
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
        // Build display URL
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
        const url = data.storage_path.startsWith('data:')
          ? data.storage_path
          : supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/photos/${data.storage_path}` : data.storage_path
        setPhotoUrls(prev => [...prev, { url, name: data.file_name }])
      }
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} photo(s) uploaded`)
      update('photo_ids', newPhotoIds)
    }
    setUploading(false)
    e.target.value = ''
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
      background: 'rgba(239, 68, 68, 0.04)',
      border: '1px solid rgba(239, 68, 68, 0.15)',
      borderRadius: 8,
    }}>

      {/* Comment */}
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Comment / Description</label>
        <textarea
          value={detail.comment}
          onChange={(e) => update('comment', e.target.value)}
          placeholder="Describe the discrepancy..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
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

      {/* Area chips */}
      {installationAreas.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Affected Areas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {installationAreas.map(area => {
              const selected = (detail.areas || []).includes(area)
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: selected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                    background: selected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    color: selected ? 'var(--color-accent)' : 'var(--color-text-3)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {selected && <Check size={12} />}
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

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: 'none' }} />

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

        <PhotoPickerButton
          onUpload={() => fileInputRef.current?.click()}
          disabled={uploading}
          variant="compact"
          label={uploading ? 'Uploading...' : photoUrls.length > 0 ? `Add Photo (${photoUrls.length})` : 'Add Photo'}
        />
      </div>

      {/* Photo viewer modal */}
      {viewerIndex !== null && photoUrls.length > 0 && (
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
