'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DISCREPANCY_TYPES, INSTALLATION } from '@/lib/constants'
import { toast } from 'sonner'

export default function NewDiscrepancyPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    location_text: '',
    type: DISCREPANCY_TYPES[0].value,
    severity: DISCREPANCY_TYPES[0].defaultSeverity,
    description: '',
    assigned_shop: DISCREPANCY_TYPES[0].defaultShop || '',
    latitude: null as number | null,
    longitude: null as number | null,
  })

  const handleTypeChange = (value: string) => {
    const typeConfig = DISCREPANCY_TYPES.find((t) => t.value === value)
    setFormData((prev) => ({
      ...prev,
      type: value,
      severity: typeConfig?.defaultSeverity || prev.severity,
      assigned_shop: typeConfig?.defaultShop || prev.assigned_shop,
    }))
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

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.location_text) {
      toast.error('Please fill in all required fields')
      return
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

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Type</span>
          <select className="input-dark" value={formData.type} onChange={(e) => handleTypeChange(e.target.value)}>
            {DISCREPANCY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Severity</span>
          <select className="input-dark" value={formData.severity} onChange={(e) => setFormData((p) => ({ ...p, severity: e.target.value }))}>
            {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          <button type="button" onClick={() => toast.success('Camera opened')} style={{ background: '#38BDF814', border: '1px solid #38BDF833', borderRadius: 8, padding: 10, color: '#38BDF8', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
            📸 Add Photo
          </button>
          <button type="button" onClick={captureGPS} style={{ background: '#34D39914', border: '1px solid #34D39933', borderRadius: 8, padding: 10, color: '#34D399', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
            📍 {formData.latitude ? `${formData.latitude.toFixed(4)}, ${formData.longitude?.toFixed(4)}` : 'Capture GPS'}
          </button>
        </div>

        <button type="button" className="btn-primary" onClick={handleSubmit}>Save Discrepancy</button>
      </div>
    </div>
  )
}
