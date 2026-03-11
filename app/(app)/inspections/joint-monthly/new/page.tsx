'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { INSPECTION_PERSONNEL } from '@/lib/constants'
import { createInspection, uploadInspectionPhoto, getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'
import { fetchCurrentWeather } from '@/lib/weather'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'
import { ExpandableTextarea } from '@/components/ui/expandable-textarea'
import { createClient } from '@/lib/supabase/client'

type PhotoEntry = { file: File; url: string; name: string }

export default function JointMonthlyInspectionPage() {
  const router = useRouter()
  const { installationId, runways } = useInstallation()

  const rwy0 = runways[0]
  const baseLat = rwy0 ? ((rwy0.end1_latitude ?? 0) + (rwy0.end2_latitude ?? 0)) / 2 : undefined
  const baseLon = rwy0 ? ((rwy0.end1_longitude ?? 0) + (rwy0.end2_longitude ?? 0)) / 2 : undefined

  const usingDemo = !createClient()

  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([])
  const [personnelNames, setPersonnelNames] = useState<Record<string, string>>({})
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [filing, setFiling] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)


  const togglePersonnel = (person: string) => {
    setSelectedPersonnel((prev) =>
      prev.includes(person) ? prev.filter((p) => p !== person) : [...prev, person]
    )
  }

  const handlePersonnelName = (person: string, name: string) => {
    setPersonnelNames((prev) => ({ ...prev, [person]: name }))
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newPhotos: PhotoEntry[] = Array.from(files).map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      name: f.name,
    }))
    setPhotos((prev) => [...prev, ...newPhotos])
    e.target.value = ''
  }

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleFile = async () => {
    setFiling(true)

    const weather = await fetchCurrentWeather(baseLat, baseLon)
    const inspector = await getInspectorName()
    const fallbackName = usingDemo ? 'Demo Inspector' : null
    const inspectorName = inspector.name || fallbackName || 'Unknown'

    const personnel = selectedPersonnel.map((p) => {
      const name = personnelNames[p]
      return name ? `${p} — ${name}` : p
    })

    const { data, error } = await createInspection({
      inspection_type: 'joint_monthly',
      inspector_name: inspectorName,
      items: [],
      total_items: 0,
      passed_count: 0,
      failed_count: 0,
      na_count: 0,
      construction_meeting: false,
      joint_monthly: true,
      personnel,
      bwc_value: null,
      weather_conditions: weather?.conditions || null,
      temperature_f: weather?.temperature_f ?? null,
      notes: comment || null,
      completed_by_name: inspectorName,
      completed_by_id: inspector.id,
      completed_at: new Date().toISOString(),
      filed_by_name: inspectorName,
      filed_by_id: inspector.id,
      base_id: installationId,
    })

    if (error) {
      toast.error(`Failed to file: ${error}`)
      setFiling(false)
      return
    }

    // Upload photos
    if (data?.id && photos.length > 0) {
      for (const photo of photos) {
        await uploadInspectionPhoto(data.id, photo.file, null, null, null, installationId)
      }
    }

    // Clean up
    photos.forEach((p) => URL.revokeObjectURL(p.url))

    setFiling(false)
    toast.success('Monthly Joint Inspection filed')

    if (data?.id) {
      router.push(`/inspections/${data.id}`)
    } else {
      router.push('/inspections/all')
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* Header */}
        <Link href="/inspections/all" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)', marginBottom: 12,
        }}>
          <ArrowLeft size={14} /> Back to All Inspections
        </Link>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: '#3B82F6' }}>
            Monthly Joint Inspection
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
            Record personnel present, comments, and photos
          </div>
        </div>

        {/* Personnel Multi-Select */}
        <div className="card" style={{ marginBottom: 12, padding: 14, borderRadius: 12 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Personnel / Offices Present
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {INSPECTION_PERSONNEL.map((person) => {
              const selected = selectedPersonnel.includes(person)
              const repName = personnelNames[person] || ''
              return (
                <div key={person}>
                  <label
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 12px', borderRadius: selected ? '8px 8px 0 0' : 8, cursor: 'pointer',
                      border: `1px solid ${selected ? 'rgba(56,189,248,0.5)' : 'var(--color-text-4)'}`,
                      borderBottom: selected ? 'none' : undefined,
                      background: selected ? 'var(--color-border-mid)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => togglePersonnel(person)}
                      style={{ accentColor: 'var(--color-accent)', width: 14, height: 14 }}
                    />
                    <span style={{ fontSize: 'var(--fs-md)', color: selected ? 'var(--color-accent)' : 'var(--color-text-2)', fontWeight: selected ? 600 : 400 }}>
                      {person}
                    </span>
                  </label>
                  {selected && (
                    <div style={{
                      padding: '6px 12px 8px',
                      borderRadius: '0 0 8px 8px',
                      border: '1px solid rgba(56,189,248,0.5)',
                      borderTop: 'none',
                      background: 'rgba(56,189,248,0.05)',
                    }}>
                      <input
                        type="text"
                        className="input-dark"
                        placeholder="Representative name..."
                        value={repName}
                        onChange={(e) => handlePersonnelName(person, e.target.value)}
                        style={{ fontSize: 'var(--fs-base)', padding: '6px 8px', width: '100%' }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Comments */}
        <div className="card" style={{ marginBottom: 12, padding: 14, borderRadius: 12 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Comments
          </div>
          <ExpandableTextarea
            className="input-dark"
            rows={6}
            placeholder="Enter monthly joint inspection comments..."
            value={comment}
            onChange={(val) => setComment(val)}
            label="Comments"
            style={{ resize: 'vertical', fontSize: 'var(--fs-md)', width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Photos */}
        <div className="card" style={{ marginBottom: 16, padding: 14, borderRadius: 12 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Photos / Attachments
          </div>

          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {photos.map((photo, idx) => (
                <div key={idx} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-mid)' }}>
                  <img src={photo.url} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    style={{
                      position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', cursor: 'pointer',
                      fontSize: 'var(--fs-xs)', lineHeight: '18px', textAlign: 'center', padding: 0,
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <PhotoPickerButton
            onUpload={() => fileRef.current?.click()}
          />
        </div>

        {/* Complete & File Button */}
        <button
          onClick={handleFile}
          disabled={filing}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            color: '#FFF', fontSize: 'var(--fs-xl)', fontWeight: 700,
            cursor: filing ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: filing ? 0.7 : 1, marginBottom: 16,
          }}
        >
          {filing ? 'Filing...' : 'Complete & File'}
        </button>

        {/* Hidden file inputs */}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoChange} />

      </div>
    </div>
  )
}
