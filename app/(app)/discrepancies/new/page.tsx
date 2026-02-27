'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { DISCREPANCY_TYPES, CURRENT_STATUS_OPTIONS } from '@/lib/constants'
import { createDiscrepancy, uploadDiscrepancyPhoto } from '@/lib/supabase/discrepancies'
import { useInstallation } from '@/lib/installation-context'
import { toast } from 'sonner'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'

const DiscrepancyLocationMap = dynamic(
  () => import('@/components/discrepancies/location-map'),
  { ssr: false },
)

export default function NewDiscrepancyPage() {
  const router = useRouter()
  const { installationId, areas: installationAreas } = useInstallation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<{ file: File; url: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    location_text: '',
    notam_reference: '',
    description: '',
    current_status: 'submitted_to_afm',
    latitude: null as number | null,
    longitude: null as number | null,
  })

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file)
      setPhotos((prev) => [...prev, { file, url, name: file.name }])
    })
    toast.success(`${files.length} photo(s) added`)
    e.target.value = ''
  }

  const toggleType = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const handlePointSelected = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
    toast.success(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }, [])

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }))
        setGpsLoading(false)
        toast.success(`Location: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`)
      },
      (error) => {
        setGpsLoading(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location access denied. Enable in browser settings.')
            break
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information unavailable.')
            break
          case error.TIMEOUT:
            toast.error('Location request timed out.')
            break
          default:
            toast.error('Unable to get your location.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [])

  const handleSubmit = async () => {
    if (!formData.title || !formData.description || !formData.location_text || selectedTypes.length === 0) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    const { data: created, error } = await createDiscrepancy({
      title: formData.title,
      description: formData.description,
      location_text: formData.location_text,
      type: selectedTypes.join(', '),
      notam_reference: formData.notam_reference || undefined,
      current_status: formData.current_status,
      latitude: formData.latitude,
      longitude: formData.longitude,
      base_id: installationId,
    })

    if (error || !created) {
      toast.error(error || 'Failed to create discrepancy')
      setSaving(false)
      return
    }

    // Upload user photos
    if (photos.length > 0) {
      let uploaded = 0
      for (const photo of photos) {
        const { error: photoErr } = await uploadDiscrepancyPhoto(created.id, photo.file)
        if (!photoErr) uploaded++
      }
      if (uploaded < photos.length) {
        toast.error(`${photos.length - uploaded} photo(s) failed to upload`)
      }
    }

    toast.success('Discrepancy saved!')
    router.push('/discrepancies')
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <button onClick={() => router.push('/discrepancies')} style={{ background: '#FBBF2414', border: '1px solid #FBBF2433', borderRadius: 8, padding: '6px 12px', color: '#FBBF24', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ⚠️ View All Discrepancies
        </button>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>New Discrepancy</div>

      <div className="card">
        <div style={{ marginBottom: 12, position: 'relative' }}>
          <span className="section-label">Location</span>
          <button
            type="button"
            className="input-dark"
            onClick={() => setLocationDropdownOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {formData.location_text || 'Select location...'}
            </span>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-3)' }}>{locationDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {locationDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
              {installationAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => { setFormData((p) => ({ ...p, location_text: area })); setLocationDropdownOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                    background: formData.location_text === area ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)',
                    fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span>{area}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12, position: 'relative' }}>
          <span className="section-label">Type</span>
          <button
            type="button"
            className="input-dark"
            onClick={() => setTypeDropdownOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {selectedTypes.length === 0
                ? 'Select type(s)...'
                : selectedTypes.map((v) => {
                    const t = DISCREPANCY_TYPES.find((d) => d.value === v)
                    return t ? `${t.emoji} ${t.label}` : v
                  }).join(', ')}
            </span>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-3)' }}>{typeDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {typeDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
              {DISCREPANCY_TYPES.map((t) => {
                const selected = selectedTypes.includes(t.value)
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleType(t.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                      background: selected ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)',
                      fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${selected ? 'var(--color-cyan)' : 'var(--color-text-3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, background: selected ? '#22D3EE22' : 'transparent', color: 'var(--color-cyan)' }}>
                      {selected ? '✓' : ''}
                    </span>
                    <span>{t.emoji} {t.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Title</span>
          <input type="text" className="input-dark" maxLength={60} placeholder="Short summary..." value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Description</span>
          <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }} placeholder="Detailed description..." value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Associated NOTAM if Applicable</span>
          <input type="text" className="input-dark" placeholder="e.g., 01/003" value={formData.notam_reference} onChange={(e) => setFormData((p) => ({ ...p, notam_reference: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Current Status</span>
          <select className="input-dark" value={formData.current_status} onChange={(e) => setFormData((p) => ({ ...p, current_status: e.target.value }))}>
            {CURRENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Location Map */}
        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Pin Location on Map</span>
          <DiscrepancyLocationMap
            onPointSelected={handlePointSelected}
            selectedLat={formData.latitude}
            selectedLng={formData.longitude}
          />
        </div>

        {/* GPS Use My Location */}
        <button
          type="button"
          onClick={captureLocation}
          disabled={gpsLoading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '10px 16px', marginBottom: 8, borderRadius: 8,
            border: '1px solid var(--color-border-active)', background: 'var(--color-border)',
            color: 'var(--color-accent)', fontSize: 13, fontWeight: 600,
            cursor: gpsLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
            opacity: gpsLoading ? 0.6 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          {gpsLoading ? 'Getting Location...' : 'Use My Location'}
        </button>

        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid #38BDF833' }}>
                <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, background: 'var(--color-overlay)', border: 'none', color: 'var(--color-danger)', fontSize: 13, width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
        <div style={{ marginBottom: 12 }}>
          <PhotoPickerButton
            onUpload={() => fileInputRef.current?.click()}
            onCapture={() => cameraInputRef.current?.click()}
          />
        </div>

        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save Discrepancy'}
        </button>
      </div>
    </div>
  )
}
