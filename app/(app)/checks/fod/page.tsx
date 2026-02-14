'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { toast } from 'sonner'

const AREAS = ['RWY 01/19', 'TWY A', 'TWY B', 'TWY C', 'Ramp/Apron', 'Full Airfield']

export default function FodCheckPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([])
  const [area, setArea] = useState('')
  const [leader, setLeader] = useState('')
  const [items, setItems] = useState('')
  const [notes, setNotes] = useState('')

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file)
      setPhotos((prev) => [...prev, { url, name: file.name }])
    })
    toast.success(`${files.length} photo(s) added`)
    e.target.value = ''
  }

  const handleSubmit = () => {
    if (!area) {
      toast.error('Please select an area')
      return
    }
    if (!leader.trim()) {
      toast.error('Please enter a team leader')
      return
    }
    toast.success('FOD check saved (demo)')
    router.push('/checks')
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      <PageHeader title="New FOD Check" backHref="/checks" />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">Area</div>
        <select
          className="input-dark"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select area...</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <div className="section-label">Team Leader</div>
        <input
          className="input-dark"
          placeholder="Name / rank"
          value={leader}
          onChange={(e) => setLeader(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <div className="section-label">FOD Items Found</div>
        <textarea
          className="input-dark"
          placeholder="Describe items found (one per line)&#10;e.g. Metal bolt (1/4&quot;) near TWY A"
          rows={4}
          value={items}
          onChange={(e) => setItems(e.target.value)}
          style={{ marginBottom: 14, resize: 'vertical' }}
        />

        <div className="section-label">Notes</div>
        <textarea
          className="input-dark"
          placeholder="Weather, conditions, etc."
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ marginBottom: 14, resize: 'vertical' }}
        />

        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid #38BDF833' }}>
                <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#EF4444', fontSize: 12, width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: 8,
            padding: '10px',
            color: '#38BDF8',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
            marginBottom: 14,
            minHeight: 44,
          }}
        >
          📸 Capture Photo{photos.length > 0 ? ` (${photos.length})` : ''}
        </button>
      </div>

      <button className="btn-primary" onClick={handleSubmit}>
        Save FOD Check
      </button>
    </div>
  )
}
