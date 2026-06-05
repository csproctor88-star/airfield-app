'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { DISCREPANCY_TYPES } from '@/lib/constants'
import { getDiscrepancyStatusOptions } from '@/lib/airport-mode'
import { uploadDiscrepancyPhoto } from '@/lib/supabase/discrepancies'
import { useInstallation } from '@/lib/installation-context'
import { toast } from 'sonner'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'
import { fetchInfrastructureFeatures } from '@/lib/supabase/infrastructure-features'
import { submitDiscrepancyFanout } from '@/lib/discrepancy-write'
import { persistPendingPhoto } from '@/lib/sync/pending-photos'
import { createClient } from '@/lib/supabase/client'
import type { InfrastructureFeature } from '@/lib/supabase/types'
import { ArrowLeft, ListChecks } from 'lucide-react'
import UseMyLocationButton from '@/components/ui/use-my-location-button'

// Section header treatment used to delimit visual groups in the
// create form. Matches the accent-underline pattern on / and
// /dashboard so every page reads as the same design language.
const formGroupHeaderStyle: React.CSSProperties = {
  fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: 8, paddingBottom: 4,
  borderBottom: '1px solid var(--color-border-active)',
}

const DiscrepancyLocationMap = dynamic(
  () => import('@/components/ui/location-picker-map-google'),
  { ssr: false },
)

const InfraFeaturePicker = dynamic(
  () => import('@/components/ui/infrastructure-feature-picker-google').then(m => ({ default: m.InfrastructureFeaturePickerGoogle })),
  { ssr: false },
)

export default function NewDiscrepancyPage() {
  const router = useRouter()
  const { installationId, currentInstallation, areas: installationAreas, facilities, ceShops, typeShopMap } = useInstallation()
  const statusOptions = getDiscrepancyStatusOptions(currentInstallation)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [photos, setPhotos] = useState<{ file: File; url: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const typeDropdownRef = useRef<HTMLDivElement>(null)

  // ── Link to Visual NAVAID ──
  const [showFeaturePicker, setShowFeaturePicker] = useState(false)
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([])
  const [lightingSystemIds, setLightingSystemIds] = useState<string[]>([])

  // Load all lighting systems for this base (for the feature picker — needs all system IDs)
  useEffect(() => {
    if (!installationId) return
    import('@/lib/supabase/lighting-systems').then(({ fetchLightingSystems }) =>
      fetchLightingSystems(installationId!).then(systems =>
        setLightingSystemIds(systems.map(s => s.id))
      )
    )
  }, [installationId])

  useEffect(() => {
    if (!typeDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [typeDropdownOpen])
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [assignedShop, setAssignedShop] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    location_text: '',
    notam_reference: '',
    description: '',
    current_status: 'submitted_to_afm',
    facility_number: '',
    estimated_completion_date: '',
    latitude: null as number | null,
    longitude: null as number | null,
  })

  // Auto-assign shop when types change — use per-base typeShopMap first, fall back to defaultShop
  useEffect(() => {
    if (selectedTypes.length === 0) return
    for (const typeVal of selectedTypes) {
      // 1. Check per-base type→shop map (configured in Base Setup → CE Shops)
      const mapped = typeShopMap[typeVal]
      if (mapped && ceShops.includes(mapped)) {
        setAssignedShop(mapped)
        setFormData(p => ({ ...p, current_status: 'submitted_to_ces' }))
        return
      }
      // 2. Fall back to hardcoded defaultShop with fuzzy matching
      const typeDef = DISCREPANCY_TYPES.find(t => t.value === typeVal)
      if (!typeDef?.defaultShop) continue
      const defaultLower = typeDef.defaultShop.toLowerCase()
      const isCes = defaultLower.includes('ce ')
      const exact = ceShops.find(s => s === typeDef.defaultShop)
      if (exact) {
        setAssignedShop(exact)
        if (isCes) setFormData(p => ({ ...p, current_status: 'submitted_to_ces' }))
        return
      }
      const partial = ceShops.find(s => s.toLowerCase().includes(defaultLower) || defaultLower.includes(s.toLowerCase()))
      if (partial) {
        setAssignedShop(partial)
        if (isCes) setFormData(p => ({ ...p, current_status: 'submitted_to_ces' }))
        return
      }
    }
  }, [selectedTypes, ceShops, typeShopMap])

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

  const handleSubmit = async () => {
    if (!formData.title || !formData.description || !formData.location_text || selectedTypes.length === 0) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const userId = supabase ? (await supabase.auth.getSession()).data.session?.user?.id ?? '' : ''

    // Route create + feature-inop + outage events through the offline write
    // queue (lib/discrepancy-write). Online runs inline; offline queues the
    // whole fan-out against a pre-allocated id and drains on reconnect.
    let result
    try {
      result = await submitDiscrepancyFanout({
        discrepancy: {
          title: formData.title,
          description: formData.description,
          location_text: formData.location_text,
          type: selectedTypes.join(', '),
          notam_reference: formData.notam_reference || undefined,
          current_status: formData.current_status,
          latitude: formData.latitude,
          longitude: formData.longitude,
          facility_number: formData.facility_number || undefined,
          estimated_completion_date: formData.estimated_completion_date || undefined,
          base_id: installationId,
          assigned_shop: assignedShop || undefined,
          infrastructure_feature_id: selectedFeatureIds.length > 0 ? selectedFeatureIds[0] : undefined,
        },
        inopFeatureIds: selectedFeatureIds,
        outageEvents: selectedFeatureIds.map((fid) => ({
          base_id: installationId ?? '',
          feature_id: fid,
          event_type: 'reported' as const,
          notes: `INOP — ${formData.title}`,
        })),
        baseId: installationId ?? '',
        userId,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create discrepancy')
      setSaving(false)
      return
    }

    if (selectedFeatureIds.length > 0) {
      toast.success(`${selectedFeatureIds.length} feature${selectedFeatureIds.length !== 1 ? 's' : ''} marked inoperative`)
    }

    // Photos: upload now when online; otherwise stash to the pending-photos
    // store keyed to the pre-allocated discrepancy id for upload on reconnect.
    if (photos.length > 0) {
      if (result.status === 'committed') {
        let uploaded = 0
        for (const photo of photos) {
          const { error: photoErr } = await uploadDiscrepancyPhoto(result.id, photo.file, installationId)
          if (!photoErr) uploaded++
        }
        if (uploaded < photos.length) {
          toast.error(`${photos.length - uploaded} photo(s) failed to upload`)
        }
      } else {
        for (const photo of photos) {
          await persistPendingPhoto({
            entityType: 'discrepancy',
            entityId: result.id,
            blob: photo.file,
            filename: photo.name,
            mime: photo.file.type,
            baseId: installationId,
          })
        }
      }
    }

    toast.success(
      result.status === 'queued'
        ? 'Saved offline — will sync when you reconnect.'
        : 'Discrepancy saved!',
    )
    router.push('/discrepancies')
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => router.back()} className="btn-ghost" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          color: 'var(--color-cyan)', padding: 0,
        }}>
          <ArrowLeft size={14} strokeWidth={2.25} /> Back
        </button>
        <button onClick={() => router.push('/discrepancies')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          padding: '5px 10px', color: 'var(--color-text-2)',
          fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <ListChecks size={12} color="var(--color-accent)" strokeWidth={2.25} />
          View All
        </button>
      </div>
      <div style={{
        fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 10, paddingBottom: 6,
        borderBottom: '1px solid var(--color-border-active)',
      }}>New Discrepancy</div>

      <div className="card">
        <div style={formGroupHeaderStyle}>Discrepancy Details</div>

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
            <span style={{ marginLeft: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{locationDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {locationDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 'var(--z-nav)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 'var(--radius-md)', marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
              {installationAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => { setFormData((p) => ({ ...p, location_text: area })); setLocationDropdownOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                    background: formData.location_text === area ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)',
                    fontSize: 'var(--fs-lg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span>{area}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12, position: 'relative' }} ref={typeDropdownRef}>
          <span className="section-label">Type</span>
          <button
            type="button"
            className="input-dark"
            onClick={() => setTypeDropdownOpen((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {selectedTypes.length === 0
                ? 'Select type(s)...'
                : selectedTypes.map((v, i) => {
                    const t = DISCREPANCY_TYPES.find((d) => d.value === v)
                    if (!t) return <span key={v}>{v}{i < selectedTypes.length - 1 ? ', ' : ''}</span>
                    const Icon = t.icon
                    return (
                      <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon size={14} strokeWidth={2.25} color={t.color} />
                        {t.label}{i < selectedTypes.length - 1 ? ',' : ''}
                      </span>
                    )
                  })}
            </span>
            <span style={{ marginLeft: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{typeDropdownOpen ? '▲' : '▼'}</span>
          </button>
          {typeDropdownOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 'var(--z-nav)', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-text-4)', borderRadius: 'var(--radius-md)', marginTop: 4, maxHeight: 240, overflowY: 'auto' }}>
              {DISCREPANCY_TYPES.map((t) => {
                const selected = selectedTypes.includes(t.value)
                const Icon = t.icon
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleType(t.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                      background: selected ? 'var(--color-text-4)' : 'transparent', border: 'none', color: 'var(--color-text-1)',
                      fontSize: 'var(--fs-lg)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: 'var(--radius-xs)', border: `2px solid ${selected ? 'var(--color-cyan)' : 'var(--color-text-3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-md)', flexShrink: 0, background: selected ? 'color-mix(in srgb, var(--color-cyan-bright) 13%, transparent)' : 'transparent', color: 'var(--color-cyan)' }}>
                      {selected ? '✓' : ''}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={16} strokeWidth={2.25} color={t.color} />
                      {t.label}
                    </span>
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

        <div style={{ ...formGroupHeaderStyle, marginTop: 16 }}>Classification &amp; Assignment</div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Current Status</span>
          <select className="input-dark" value={formData.current_status} onChange={(e) => setFormData((p) => ({ ...p, current_status: e.target.value }))}>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Assigned Shop</span>
          <select className="input-dark" value={assignedShop} onChange={(e) => setAssignedShop(e.target.value)}>
            <option value="">Unassigned</option>
            {ceShops.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {selectedTypes.length > 0 && assignedShop && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              Auto-assigned based on type
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Assign to Facility #</span>
          {facilities.length > 0 ? (
            <select className="input-dark" value={formData.facility_number} onChange={(e) => setFormData((p) => ({ ...p, facility_number: e.target.value }))}>
              <option value="">— None —</option>
              {facilities.map((f) => <option key={f.id} value={`${f.facility_number} — ${f.description}`}>{f.facility_number} — {f.description}</option>)}
            </select>
          ) : (
            <input type="text" className="input-dark" placeholder="e.g., 06010 — Runway" value={formData.facility_number} onChange={(e) => setFormData((p) => ({ ...p, facility_number: e.target.value }))} />
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Estimated Completion Date (optional)</span>
          <input
            type="date"
            className="input-dark"
            value={formData.estimated_completion_date}
            onChange={(e) => setFormData((p) => ({ ...p, estimated_completion_date: e.target.value }))}
          />
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            DAFMAN 2.3.2.7.3 — expected CES closure date.
          </div>
        </div>

        <div style={{ ...formGroupHeaderStyle, marginTop: 16 }}>Location &amp; Linked Features</div>

        {/* Location Map */}
        <div style={{ marginBottom: 12 }}>
          <span className="section-label">Pin Location on Map</span>
          <DiscrepancyLocationMap
            onPointSelected={handlePointSelected}
            selectedLat={formData.latitude}
            selectedLng={formData.longitude}
            aspectRatio="1 / 1"
          />
        </div>

        {/* Link to Visual NAVAID — toggle + feature picker */}
        {lightingSystemIds.length > 0 && installationId && (
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setShowFeaturePicker(!showFeaturePicker)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 700,
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: showFeaturePicker ? '2px solid var(--color-cyan-bright)' : '2px solid var(--color-text-4)',
                background: showFeaturePicker ? 'color-mix(in srgb, var(--color-cyan-bright) 8%, transparent)' : 'transparent',
                color: showFeaturePicker ? 'var(--color-cyan-bright)' : 'var(--color-text-2)',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                border: showFeaturePicker ? '2px solid var(--color-cyan-bright)' : '2px solid var(--color-text-3)',
                background: showFeaturePicker ? 'var(--color-cyan-bright)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: '#000',
              }}>
                {showFeaturePicker ? '\u2713' : ''}
              </span>
              Link to Visual NAVAID
              {selectedFeatureIds.length > 0 && (
                <span style={{ fontSize: 'var(--fs-xs)', background: 'color-mix(in srgb, var(--color-cyan-bright) 20%, transparent)', color: 'var(--color-cyan-bright)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
                  {selectedFeatureIds.length} selected
                </span>
              )}
            </button>

            {showFeaturePicker && (
              <div style={{ marginTop: 8 }}>
                <InfraFeaturePicker
                  systemIds={lightingSystemIds}
                  baseId={installationId}
                  selectedFeatureIds={selectedFeatureIds}
                  onSelectionChange={setSelectedFeatureIds}
                />
              </div>
            )}
          </div>
        )}

        {/* GPS Use My Location */}
        <UseMyLocationButton
          variant="inline"
          onLocation={(c) =>
            setFormData((prev) => ({ ...prev, latitude: c.lat, longitude: c.lng }))
          }
          style={{ marginBottom: 8 }}
        />

        <div style={{ ...formGroupHeaderStyle, marginTop: 16 }}>Media</div>

        {photos.length > 0 && (
          <div className="photo-grid" style={{ marginBottom: 12 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid #38BDF833' }}>
                <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, background: 'var(--color-overlay)', border: 'none', color: 'var(--color-danger)', fontSize: 'var(--fs-md)', width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: 'none' }} />
        <div style={{ marginBottom: 12 }}>
          <PhotoPickerButton
            onUpload={() => fileInputRef.current?.click()}
          />
        </div>

        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : 'Save Discrepancy'}
        </button>
      </div>
    </div>
  )
}
