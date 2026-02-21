'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  CHECK_TYPE_CONFIG,
  AIRFIELD_AREAS,
  RSC_CONDITIONS,
  RCR_CONDITION_TYPES,
  BASH_CONDITION_CODES,
  EMERGENCY_ACTIONS,
  EMERGENCY_AGENCIES,
} from '@/lib/constants'
import type { CheckType } from '@/lib/supabase/types'
import { createCheck, uploadCheckPhoto } from '@/lib/supabase/checks'

const CheckLocationMap = dynamic(
  () => import('@/components/discrepancies/location-map'),
  { ssr: false },
)

type LocalComment = {
  id: string
  comment: string
  user_name: string
  created_at: string
}

const CURRENT_USER = 'MSgt Proctor'

export default function AirfieldChecksPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [checkType, setCheckType] = useState<CheckType | ''>('')
  const [areas, setAreas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Issue Found toggle
  const [issueFound, setIssueFound] = useState(false)

  // Location
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)

  const handlePointSelected = useCallback((lat: number, lng: number) => {
    setSelectedLat(lat)
    setSelectedLng(lng)
    toast.success(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
  }, [])

  // Photos
  const [photos, setPhotos] = useState<{ file: File; url: string; name: string }[]>([])

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

  // Remarks
  const [remarkText, setRemarkText] = useState('')
  const [remarks, setRemarks] = useState<LocalComment[]>([])

  // Type-specific fields
  const [rscCondition, setRscCondition] = useState('')
  const [rcrValue, setRcrValue] = useState('')
  const [rcrConditionType, setRcrConditionType] = useState('')
  const [bashCondition, setBashCondition] = useState('')
  const [bashSpecies, setBashSpecies] = useState('')
  const [aircraftType, setAircraftType] = useState('')
  const [callsign, setCallsign] = useState('')
  const [emergencyNature, setEmergencyNature] = useState('')
  const [checkedActions, setCheckedActions] = useState<string[]>([])
  const [notifiedAgencies, setNotifiedAgencies] = useState<string[]>([])
  const [heavyAircraftType, setHeavyAircraftType] = useState('')

  const toggleArea = (area: string) => {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  const toggleAction = (action: string) => {
    setCheckedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    )
  }

  const toggleAgency = (agency: string) => {
    setNotifiedAgencies((prev) =>
      prev.includes(agency) ? prev.filter((a) => a !== agency) : [...prev, agency]
    )
  }

  const addRemark = () => {
    if (!remarkText.trim()) return
    const newRemark: LocalComment = {
      id: `local-${Date.now()}`,
      comment: remarkText.trim(),
      user_name: CURRENT_USER,
      created_at: new Date().toISOString(),
    }
    setRemarks((prev) => [newRemark, ...prev])
    setRemarkText('')
  }

  const buildCheckData = (): Record<string, unknown> => {
    switch (checkType) {
      case 'rsc':
        return { condition: rscCondition }
      case 'rcr':
        return { rcr_value: rcrValue, condition_type: rcrConditionType }
      case 'bash':
        return { condition_code: bashCondition, species_observed: bashSpecies }
      case 'ife':
        return {
          aircraft_type: aircraftType,
          callsign,
          nature: emergencyNature,
          actions: checkedActions,
          agencies_notified: notifiedAgencies,
        }
      case 'ground_emergency':
        return {
          aircraft_type: aircraftType,
          nature: emergencyNature,
          actions: checkedActions,
          agencies_notified: notifiedAgencies,
        }
      case 'heavy_aircraft':
        return { aircraft_type: heavyAircraftType }
      case 'fod':
      default:
        return {}
    }
  }

  const handleComplete = async () => {
    if (!checkType) {
      toast.error('Select a check type')
      return
    }
    if (areas.length === 0) {
      toast.error('Select at least one area')
      return
    }

    setSaving(true)

    const data = buildCheckData()
    const comments = remarks.map((r) => ({
      comment: r.comment,
      user_name: r.user_name,
      created_at: r.created_at,
    }))

    const { data: created, error } = await createCheck({
      check_type: checkType,
      areas,
      data,
      completed_by: CURRENT_USER,
      comments,
      latitude: selectedLat,
      longitude: selectedLng,
    })

    if (error || !created) {
      toast.error(`Failed to save: ${error}`)
      setSaving(false)
      return
    }

    // Upload photos
    if (photos.length > 0) {
      let uploaded = 0
      for (const photo of photos) {
        const { error: photoErr } = await uploadCheckPhoto(created.id, photo.file)
        if (!photoErr) uploaded++
      }
      if (uploaded < photos.length) {
        toast.error(`${photos.length - uploaded} photo(s) failed to upload`)
      }
    }

    setSaving(false)
    toast.success(`Check ${created.display_id} completed`)
    router.push(`/checks/${created.id}`)
  }

  const resetTypeFields = () => {
    setRscCondition('')
    setRcrValue('')
    setRcrConditionType('')
    setBashCondition('')
    setBashSpecies('')
    setAircraftType('')
    setCallsign('')
    setEmergencyNature('')
    setCheckedActions([])
    setNotifiedAgencies([])
    setHeavyAircraftType('')
    setSelectedLat(null)
    setSelectedLng(null)
    setIssueFound(false)
    setPhotos([])
  }

  const typeConfig = checkType ? CHECK_TYPE_CONFIG[checkType] : null

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Airfield Check</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>DAFI 13-213 / UFC 3-260-01</div>
        </div>
        <Link
          href="/checks/history"
          style={{
            background: '#22D3EE14', border: '1px solid #22D3EE33', borderRadius: 8,
            padding: '8px 14px', color: '#22D3EE', fontSize: 12, fontWeight: 600,
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          Check History
        </Link>
      </div>

      {/* Check Type Dropdown */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Check Type
        </div>
        <select
          className="input-dark"
          value={checkType}
          onChange={(e) => {
            setCheckType(e.target.value as CheckType | '')
            resetTypeFields()
          }}
          style={{ fontSize: 14 }}
        >
          <option value="">Select check type...</option>
          {Object.entries(CHECK_TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.icon} {cfg.label}
            </option>
          ))}
        </select>

        {typeConfig && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: typeConfig.color }} />
            <span style={{ fontSize: 12, color: typeConfig.color, fontWeight: 600 }}>{typeConfig.label}</span>
          </div>
        )}
      </div>

      {/* Dynamic Fields Based on Check Type */}
      {checkType && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            {typeConfig?.label} Details
          </div>

          {/* RSC */}
          {checkType === 'rsc' && (
            <div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Runway Surface Condition</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {RSC_CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRscCondition(c)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                      background: rscCondition === c
                        ? c === 'Dry' ? '#22C55E22' : '#3B82F622'
                        : '#1E293B',
                      color: rscCondition === c
                        ? c === 'Dry' ? '#22C55E' : '#3B82F6'
                        : '#64748B',
                      outline: rscCondition === c ? `2px solid ${c === 'Dry' ? '#22C55E' : '#3B82F6'}` : 'none',
                    }}
                  >
                    {c === 'Dry' ? '☀️' : '💧'} {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RCR */}
          {checkType === 'rcr' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>RCR Value</div>
                <input
                  className="input-dark"
                  type="number"
                  placeholder="e.g., 23"
                  value={rcrValue}
                  onChange={(e) => setRcrValue(e.target.value)}
                  style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', textAlign: 'center' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Condition Type</div>
                <select
                  className="input-dark"
                  value={rcrConditionType}
                  onChange={(e) => setRcrConditionType(e.target.value)}
                >
                  <option value="">Select condition...</option>
                  {RCR_CONDITION_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* BASH */}
          {checkType === 'bash' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Condition Code</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {BASH_CONDITION_CODES.map((code) => {
                    const colors: Record<string, string> = { LOW: '#22C55E', MODERATE: '#EAB308', SEVERE: '#EF4444' }
                    const active = bashCondition === code
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setBashCondition(code)}
                        style={{
                          flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                          background: active ? `${colors[code]}22` : '#1E293B',
                          color: active ? colors[code] : '#64748B',
                          outline: active ? `2px solid ${colors[code]}` : 'none',
                        }}
                      >
                        {code}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Species Observed</div>
                <textarea
                  className="input-dark"
                  rows={2}
                  placeholder="Species, count, behavior..."
                  value={bashSpecies}
                  onChange={(e) => setBashSpecies(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          )}

          {/* IFE */}
          {checkType === 'ife' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Aircraft Type</div>
                  <input className="input-dark" placeholder="e.g., KC-135R" value={aircraftType}
                    onChange={(e) => setAircraftType(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Callsign</div>
                  <input className="input-dark" placeholder="e.g., BOLT 31" value={callsign}
                    onChange={(e) => setCallsign(e.target.value)} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Nature of Emergency</div>
                <input className="input-dark" placeholder="Describe the emergency..."
                  value={emergencyNature} onChange={(e) => setEmergencyNature(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>AM Action Checklist</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {EMERGENCY_ACTIONS.map((action) => {
                    const checked = checkedActions.includes(action)
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => toggleAction(action)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 12, textAlign: 'left',
                          background: checked ? '#22C55E11' : '#1E293B',
                          color: checked ? '#22C55E' : '#94A3B8',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: checked ? '2px solid #22C55E' : '2px solid #334155',
                          background: checked ? '#22C55E22' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                        }}>
                          {checked ? '✓' : ''}
                        </span>
                        {action}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Agency Notifications</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {EMERGENCY_AGENCIES.map((agency) => {
                    const active = notifiedAgencies.includes(agency)
                    return (
                      <button
                        key={agency}
                        type="button"
                        onClick={() => toggleAgency(agency)}
                        style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                          background: active ? '#38BDF822' : '#1E293B',
                          color: active ? '#38BDF8' : '#64748B',
                          outline: active ? '1px solid #38BDF8' : 'none',
                        }}
                      >
                        {active ? '✓ ' : ''}{agency}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Ground Emergency */}
          {checkType === 'ground_emergency' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Aircraft Type (if applicable)</div>
                <input className="input-dark" placeholder="e.g., A-10C" value={aircraftType}
                  onChange={(e) => setAircraftType(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Nature of Emergency</div>
                <input className="input-dark" placeholder="Describe the emergency..."
                  value={emergencyNature} onChange={(e) => setEmergencyNature(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>AM Action Checklist</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {EMERGENCY_ACTIONS.map((action) => {
                    const checked = checkedActions.includes(action)
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => toggleAction(action)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 12, textAlign: 'left',
                          background: checked ? '#22C55E11' : '#1E293B',
                          color: checked ? '#22C55E' : '#94A3B8',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: checked ? '2px solid #22C55E' : '2px solid #334155',
                          background: checked ? '#22C55E22' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700,
                        }}>
                          {checked ? '✓' : ''}
                        </span>
                        {action}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Agency Notifications</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {EMERGENCY_AGENCIES.map((agency) => {
                    const active = notifiedAgencies.includes(agency)
                    return (
                      <button
                        key={agency}
                        type="button"
                        onClick={() => toggleAgency(agency)}
                        style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                          background: active ? '#38BDF822' : '#1E293B',
                          color: active ? '#38BDF8' : '#64748B',
                          outline: active ? '1px solid #38BDF8' : 'none',
                        }}
                      >
                        {active ? '✓ ' : ''}{agency}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Heavy Aircraft */}
          {checkType === 'heavy_aircraft' && (
            <div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>Aircraft Type / MDS</div>
              <input className="input-dark" placeholder="e.g., C-17A Globemaster III"
                value={heavyAircraftType} onChange={(e) => setHeavyAircraftType(e.target.value)} />
            </div>
          )}

          {/* FOD */}
          {checkType === 'fod' && (
            <div style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>
              Document FOD items found in the remarks section below.
            </div>
          )}
        </div>
      )}

      {/* Areas Checked */}
      {checkType && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Areas Checked
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {AIRFIELD_AREAS.map((area) => {
              const selected = areas.includes(area)
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                    background: selected ? '#22D3EE18' : '#1E293B',
                    color: selected ? '#22D3EE' : '#64748B',
                    outline: selected ? '1.5px solid #22D3EE' : 'none',
                  }}
                >
                  {selected ? '✓ ' : ''}{area}
                </button>
              )
            })}
          </div>
          {areas.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#94A3B8' }}>
              {areas.length} area{areas.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      )}

      {/* Airfield Diagram Button */}
      {checkType && (
        <button
          type="button"
          onClick={() => toast.info('Airfield diagram will be added — image pending')}
          style={{
            width: '100%', padding: '12px', marginBottom: 8, borderRadius: 10,
            border: '1px dashed #334155', background: '#0F172A', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: '#94A3B8', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 18 }}>🗺️</span>
          View Airfield Diagram
        </button>
      )}

      {/* Issue Found Toggle */}
      {checkType && (
        <button
          type="button"
          onClick={() => {
            const next = !issueFound
            setIssueFound(next)
            if (!next) {
              setPhotos([])
              setSelectedLat(null)
              setSelectedLng(null)
            }
          }}
          style={{
            width: '100%', padding: '12px 14px', marginBottom: 8, borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            border: issueFound ? '2px solid #EF4444' : '2px solid #334155',
            background: issueFound ? '#EF444414' : '#0F172A',
            color: issueFound ? '#EF4444' : '#94A3B8',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: issueFound ? '2px solid #EF4444' : '2px solid #475569',
            background: issueFound ? '#EF4444' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, color: '#FFFFFF',
          }}>
            {issueFound ? '✓' : ''}
          </span>
          Issue Found
        </button>
      )}

      {/* Pin Location on Map — only when issue found */}
      {checkType && issueFound && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Pin Location on Map
          </div>
          <CheckLocationMap
            onPointSelected={handlePointSelected}
            selectedLat={selectedLat}
            selectedLng={selectedLng}
          />
        </div>
      )}

      {/* Photos Section — only when issue found */}
      {checkType && issueFound && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Photos
          </div>

          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid #38BDF833' }}>
                  <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none',
                      color: '#EF4444', fontSize: 13, width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} style={{ display: 'none' }} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', background: '#38BDF814', border: '1px solid #38BDF833', borderRadius: 8,
              padding: 10, color: '#38BDF8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', minHeight: 44,
            }}
          >
            📸 Add Photo{photos.length > 0 ? ` (${photos.length})` : ''}
          </button>
        </div>
      )}

      {/* Remarks Section */}
      {checkType && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Remarks
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: remarks.length > 0 ? 12 : 0 }}>
            <textarea
              className="input-dark"
              rows={2}
              placeholder="Add a remark..."
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addRemark()
                }
              }}
              style={{ resize: 'vertical', flex: 1 }}
            />
            <button
              type="button"
              onClick={addRemark}
              disabled={!remarkText.trim()}
              style={{
                padding: '0 14px', borderRadius: 8, border: 'none',
                background: remarkText.trim() ? '#22D3EE' : '#1E293B',
                color: remarkText.trim() ? '#0F172A' : '#334155',
                fontSize: 12, fontWeight: 700, cursor: remarkText.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', alignSelf: 'flex-end', height: 36,
              }}
            >
              Save
            </button>
          </div>

          {remarks.length > 0 && (
            <div style={{ borderTop: '1px solid #1E293B', paddingTop: 10 }}>
              {remarks.map((remark) => (
                <div key={remark.id} style={{ borderLeft: '2px solid #334155', paddingLeft: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: '#38BDF8' }}>{remark.user_name}</span>
                    {' — '}
                    {new Date(remark.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' '}
                    {new Date(remark.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 12, color: '#CBD5E1', lineHeight: 1.4 }}>{remark.comment}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Complete Check Button */}
      {checkType && (
        <button
          type="button"
          className="btn-primary"
          onClick={handleComplete}
          disabled={saving || !checkType || areas.length === 0}
          style={{
            width: '100%', opacity: saving ? 0.7 : 1,
            background: '#22C55E', fontSize: 15, fontWeight: 800,
            padding: '14px', borderRadius: 10,
          }}
        >
          {saving ? 'Saving...' : '✓ Complete Check'}
        </button>
      )}

      {checkType && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#64748B' }}>
          Will be recorded as completed by <span style={{ color: '#38BDF8', fontWeight: 600 }}>{CURRENT_USER}</span>
        </div>
      )}
    </div>
  )
}
