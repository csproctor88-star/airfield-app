'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DISCREPANCY_TYPES, INSTALLATION } from '@/lib/constants'
import { createDiscrepancy, uploadDiscrepancyPhoto } from '@/lib/supabase/discrepancies'
import { toast } from 'sonner'

export default function NewDiscrepancyPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<{ file: File; url: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    location_text: '',
    severity: 'no',
    description: '',
    assigned_shop: '' as string,
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
    setSelectedTypes((prev) => {
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      // Update assigned_shop from most recently added type
      if (next.length > 0 && !prev.includes(value)) {
        const typeConfig = DISCREPANCY_TYPES.find((t) => t.value === value)
        if (typeConfig?.defaultShop) {
          setFormData((p) => ({ ...p, assigned_shop: typeConfig.defaultShop || p.assigned_shop }))
        }
      }
      return next
    })
  }

  const captureGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not available')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
        toast.success(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`)
      },
      () => toast.error('GPS capture failed')
    )
  }

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
      severity: formData.severity,
      assigned_shop: formData.assigned_shop || undefined,
      latitude: formData.latitude,
      longitude: formData.longitude,
    })

    if (error || !created) {
      toast.error(error || 'Failed to create discrepancy')
      setSaving(false)
      return
    }

    // Upload photos to the newly created discrepancy
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
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
        ← Back
      </button>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>New Discrepancy</div>

      <div className="card">
        {([
          { label: 'Title', field: 'title', placeholder: 'Short summary...' },
          { label: 'Location', field: 'location_text', placeholder: 'e.g., TWY A/B intersection' },
        ] as const).map(({ label, field, placeholder }) => (
          <div key={field} style={{ marginBottom: 12 }}>
            <span className="section-label">{label}</span>
            <input type="text" className="input-dark" maxLength={field === 'title' ? 120 : undefined} placeholder={placeholder} value={formData[field]} onChange={(e) => setFormData((p) => ({ ...p, [field]: e.target.value }))} />
          </div>
        ))}

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
            <span style={{ marginLeft: 8, fontSize: 10, color: '#64748B' }}>{typeDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {typeDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1E293B', border: '1px solid #334155', borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
              {DISCREPANCY_TYPES.map((t) => {
                const selected = selectedTypes.includes(t.value)
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleType(t.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                      background: selected ? '#334155' : 'transparent', border: 'none', color: '#F1F5F9',
                      fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${selected ? '#22D3EE' : '#475569'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, background: selected ? '#22D3EE22' : 'transparent', color: '#22D3EE' }}>
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
          <span className="section-label">Work Order Submitted to CES?</span>
          <select className="input-dark" value={formData.severity} onChange={(e) => setFormData((p) => ({ ...p, severity: e.target.value }))}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Assigned Shop</span>
          <select className="input-dark" value={formData.assigned_shop} onChange={(e) => setFormData((p) => ({ ...p, assigned_shop: e.target.value }))}>
            <option value="">Select shop...</option>
            {INSTALLATION.ce_shops.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Description</span>
          <textarea className="input-dark" rows={3} style={{ resize: 'vertical' }} placeholder="Detailed description..." value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} />
        </div>

        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid #38BDF833' }}>
                <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#EF4444', fontSize: 12, width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: '#38BDF814', border: '1px solid #38BDF833', borderRadius: 8, padding: 10, color: '#38BDF8', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
            📸 Add Photo{photos.length > 0 ? ` (${photos.length})` : ''}
          </button>
          <button type="button" onClick={captureGPS} style={{ background: '#34D39914', border: '1px solid #34D39933', borderRadius: 8, padding: 10, color: '#34D399', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
            📍 {formData.latitude ? `${formData.latitude.toFixed(4)}, ${formData.longitude?.toFixed(4)}` : 'Capture GPS'}
          </button>
        </div>

        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save Discrepancy'}
        </button>
      </div>
    </div>
  )
}
