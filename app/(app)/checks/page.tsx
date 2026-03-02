'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  CHECK_TYPE_CONFIG,
  RSC_CONDITIONS,
  RCR_CONDITION_TYPES,
  BASH_CONDITION_CODES,
  EMERGENCY_ACTIONS,
} from '@/lib/constants'
import type { CheckType } from '@/lib/supabase/types'
import { createCheck, uploadCheckPhoto, fetchRecentChecks, type CheckRow } from '@/lib/supabase/checks'
import { DEMO_CHECKS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { getAirfieldDiagram } from '@/lib/airfield-diagram'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'

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

export default function AirfieldChecksPage() {
  const router = useRouter()
  const { installationId, areas: installationAreas } = useInstallation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [checkType, setCheckType] = useState<CheckType | ''>('')
  const [areas, setAreas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState('Inspector')
  const [recentChecks, setRecentChecks] = useState<CheckRow[]>([])
  const [gpsLoading, setGpsLoading] = useState(false)

  // ── Airfield diagram state ──
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null)
  const [showDiagram, setShowDiagram] = useState(false)

  useEffect(() => {
    if (!installationId) return
    getAirfieldDiagram(installationId).then(setDiagramUrl).catch(() => setDiagramUrl(null))
  }, [installationId])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setCurrentUser('Demo User')
      setRecentChecks(DEMO_CHECKS.slice(0, 5) as unknown as CheckRow[])
      return
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any).from('profiles').select('name, rank, first_name, last_name').eq('id', user.id).single()
      if (profile?.first_name && profile?.last_name) {
        const displayName = `${profile.first_name} ${profile.last_name}`
        setCurrentUser(profile.rank ? `${profile.rank} ${displayName}` : displayName)
      } else if (profile?.name) {
        setCurrentUser(profile.rank ? `${profile.rank} ${profile.name}` : profile.name)
      } else if (user.user_metadata?.name) {
        setCurrentUser(user.user_metadata.name)
      } else if (user.email) {
        setCurrentUser(user.email.split('@')[0])
      }
    })
    fetchRecentChecks(installationId, 5).then(setRecentChecks)
  }, [installationId])

  // Issue Found toggle
  const [issueFound, setIssueFound] = useState(false)

  // Location
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)
  const [flyToPoint, setFlyToPoint] = useState<{ lat: number; lng: number } | null>(null)

  const handlePointSelected = useCallback((lat: number, lng: number) => {
    setSelectedLat(lat)
    setSelectedLng(lng)
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
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setSelectedLat(lat)
        setSelectedLng(lng)
        setFlyToPoint({ lat, lng })
        setGpsLoading(false)
        toast.success(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
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
      user_name: currentUser,
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

    // Auto-save any pending remark text
    const allRemarks = [...remarks]
    if (remarkText.trim()) {
      allRemarks.unshift({
        id: `local-${Date.now()}`,
        comment: remarkText.trim(),
        user_name: currentUser,
        created_at: new Date().toISOString(),
      })
      setRemarkText('')
      setRemarks(allRemarks)
    }

    const data = buildCheckData()
    const comments = allRemarks.map((r) => ({
      comment: r.comment,
      user_name: r.user_name,
      created_at: r.created_at,
    }))

    const { data: created, error } = await createCheck({
      check_type: checkType,
      areas,
      data,
      completed_by: currentUser,
      comments,
      latitude: selectedLat,
      longitude: selectedLng,
      base_id: installationId,
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
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Airfield Check</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>DAFI 13-213 / UFC 3-260-01</div>
      </div>

      {/* Check Type Dropdown */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Check Type
        </div>
        <select
          className="input-dark"
          value={checkType}
          onChange={(e) => {
            const newType = e.target.value as CheckType | ''
            setCheckType(newType)
            resetTypeFields()
            setAreas([])
            // Auto-select all runway areas for RSC
            if (newType === 'rsc') {
              setAreas(installationAreas.filter(a => a.toUpperCase().startsWith('RWY')))
            }
          }}
          style={{ fontSize: 'var(--fs-lg)' }}
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
            <span style={{ fontSize: 'var(--fs-base)', color: typeConfig.color, fontWeight: 600 }}>{typeConfig.label}</span>
          </div>
        )}
      </div>

      {/* Recent Checks — shown when no check type selected */}
      {!checkType && recentChecks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Recent Checks
          </div>
          {recentChecks.map((rc) => {
            const cfg = CHECK_TYPE_CONFIG[rc.check_type as keyof typeof CHECK_TYPE_CONFIG]
            return (
              <Link
                key={rc.id}
                href={`/checks/${rc.id}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', marginBottom: 4, borderRadius: 8,
                  background: 'var(--color-bg-surface-solid)', border: '1px solid var(--color-border-mid)',
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{cfg?.icon}</span>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-cyan)', fontFamily: 'monospace' }}>{rc.display_id}</span>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>{cfg?.label}</span>
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                  {rc.completed_at ? new Date(rc.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </Link>
            )
          })}
          <Link
            href="/checks/history"
            style={{
              display: 'block', textAlign: 'center', padding: '10px',
              fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--color-cyan)',
              textDecoration: 'none',
            }}
          >
            View Full Check History →
          </Link>
        </div>
      )}

      {/* Dynamic Fields Based on Check Type */}
      {checkType && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            {typeConfig?.label} Details
          </div>

          {/* RSC */}
          {checkType === 'rsc' && (
            <div>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Runway Surface Condition</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {RSC_CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRscCondition(c)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-lg)', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border: rscCondition === c
                        ? `1.5px solid ${c === 'Dry' ? 'var(--color-success)' : 'var(--color-accent)'}`
                        : '1.5px solid var(--color-border-mid)',
                      background: rscCondition === c
                        ? c === 'Dry' ? 'rgba(34,197,94,0.13)' : 'rgba(59,130,246,0.13)'
                        : 'var(--color-bg-elevated)',
                      color: rscCondition === c
                        ? c === 'Dry' ? 'var(--color-success)' : 'var(--color-accent)'
                        : 'var(--color-text-3)',
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
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>RCR Value</div>
                <input
                  className="input-dark"
                  type="number"
                  placeholder="e.g., 23"
                  value={rcrValue}
                  onChange={(e) => setRcrValue(e.target.value)}
                  style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, fontFamily: 'monospace', textAlign: 'center' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Condition Type</div>
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
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Condition Code</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {BASH_CONDITION_CODES.map((code) => {
                    const colors: Record<string, string> = { LOW: 'var(--color-success)', MODERATE: 'var(--color-warning)', SEVERE: 'var(--color-danger)', PROHIBITED: '#DC2626' }
                    const bgColors: Record<string, string> = { LOW: 'rgba(34,197,94,0.13)', MODERATE: 'rgba(234,179,8,0.13)', SEVERE: 'rgba(239,68,68,0.13)', PROHIBITED: 'rgba(220,38,38,0.18)' }
                    const active = bashCondition === code
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setBashCondition(code)}
                        style={{
                          flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          border: active ? `1.5px solid ${colors[code]}` : '1.5px solid var(--color-border-mid)',
                          background: active ? bgColors[code] : 'var(--color-bg-elevated)',
                          color: active ? colors[code] : 'var(--color-text-3)',
                        }}
                      >
                        {code}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Species Observed</div>
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
              <div className="form-row">
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Aircraft Type</div>
                  <input className="input-dark" placeholder="e.g., KC-135R" value={aircraftType}
                    onChange={(e) => setAircraftType(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Callsign</div>
                  <input className="input-dark" placeholder="e.g., BOLT 31" value={callsign}
                    onChange={(e) => setCallsign(e.target.value)} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Nature of Emergency</div>
                <input className="input-dark" placeholder="Describe the emergency..."
                  value={emergencyNature} onChange={(e) => setEmergencyNature(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 6 }}>AM Action Checklist</div>
                <div className="checklist-grid">
                  {EMERGENCY_ACTIONS.map((action) => {
                    const checked = checkedActions.includes(action)
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => toggleAction(action)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 6, border: checked ? '1.5px solid var(--color-success)' : '1.5px solid var(--color-border-mid)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-base)', textAlign: 'left',
                          background: checked ? 'rgba(34,197,94,0.07)' : 'var(--color-bg-elevated)',
                          color: checked ? 'var(--color-success)' : 'var(--color-text-2)',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: checked ? '2px solid var(--color-success)' : '2px solid var(--color-text-4)',
                          background: checked ? 'rgba(34,197,94,0.13)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--fs-md)', fontWeight: 700,
                        }}>
                          {checked ? '✓' : ''}
                        </span>
                        {action}
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
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Aircraft Type (if applicable)</div>
                <input className="input-dark" placeholder="e.g., A-10C" value={aircraftType}
                  onChange={(e) => setAircraftType(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Nature of Emergency</div>
                <input className="input-dark" placeholder="Describe the emergency..."
                  value={emergencyNature} onChange={(e) => setEmergencyNature(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 6 }}>AM Action Checklist</div>
                <div className="checklist-grid">
                  {EMERGENCY_ACTIONS.map((action) => {
                    const checked = checkedActions.includes(action)
                    return (
                      <button
                        key={action}
                        type="button"
                        onClick={() => toggleAction(action)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 6, border: checked ? '1.5px solid var(--color-success)' : '1.5px solid var(--color-border-mid)',
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-base)', textAlign: 'left',
                          background: checked ? 'rgba(34,197,94,0.07)' : 'var(--color-bg-elevated)',
                          color: checked ? 'var(--color-success)' : 'var(--color-text-2)',
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: checked ? '2px solid var(--color-success)' : '2px solid var(--color-text-4)',
                          background: checked ? 'rgba(34,197,94,0.13)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--fs-md)', fontWeight: 700,
                        }}>
                          {checked ? '✓' : ''}
                        </span>
                        {action}
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
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', marginBottom: 4 }}>Aircraft Type / MDS</div>
              <input className="input-dark" placeholder="e.g., C-17A Globemaster III"
                value={heavyAircraftType} onChange={(e) => setHeavyAircraftType(e.target.value)} />
            </div>
          )}

          {/* FOD */}
          {checkType === 'fod' && (
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
              Document FOD items found in the remarks section below.
            </div>
          )}
        </div>
      )}

      {/* Areas Checked */}
      {checkType && (() => {
        const displayAreas = checkType === 'rsc'
          ? installationAreas.filter(a => a.toUpperCase().startsWith('RWY'))
          : installationAreas
        return (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            {checkType === 'rsc' ? 'Runway Areas Checked' : 'Areas Checked'}
          </div>
          {displayAreas.length === 0 && (
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
              No runway areas configured for this installation.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {displayAreas.map((area) => {
              const selected = areas.includes(area)
              return (
                <button
                  key={area}
                  type="button"
                  onClick={() => toggleArea(area)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: selected ? '1.5px solid var(--color-cyan)' : '1.5px solid var(--color-border-mid)',
                    background: selected ? 'rgba(34,211,238,0.09)' : 'var(--color-bg-elevated)',
                    color: selected ? 'var(--color-cyan)' : 'var(--color-text-3)',
                  }}
                >
                  {selected ? '✓ ' : ''}{area}
                </button>
              )
            })}
          </div>
          {areas.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
              {areas.length} area{areas.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
        )
      })()}

      {/* Airfield Diagram Button */}
      {checkType && (
        <button
          type="button"
          onClick={() => diagramUrl ? setShowDiagram(true) : toast.info('No airfield diagram uploaded — add one in Settings > Base Configuration')}
          style={{
            width: '100%', padding: '12px', marginBottom: 8, borderRadius: 10,
            border: '1px dashed var(--color-text-4)', background: 'var(--color-bg-surface-solid)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 'var(--fs-3xl)' }}>🗺️</span>
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
            fontFamily: 'inherit', fontSize: 'var(--fs-lg)', fontWeight: 700,
            border: issueFound ? '2px solid var(--color-danger)' : '2px solid var(--color-text-4)',
            background: issueFound ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-surface-solid)',
            color: issueFound ? 'var(--color-danger)' : 'var(--color-text-2)',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
            border: issueFound ? '2px solid var(--color-danger)' : '2px solid var(--color-text-3)',
            background: issueFound ? 'var(--color-danger)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--fs-xl)', fontWeight: 800, color: '#FFFFFF',
          }}>
            {issueFound ? '✓' : ''}
          </span>
          Issue Found
        </button>
      )}

      {/* Pin Location on Map — only when issue found */}
      {checkType && issueFound && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Pin Location on Map
          </div>
          <CheckLocationMap
            onPointSelected={handlePointSelected}
            selectedLat={selectedLat}
            selectedLng={selectedLng}
            flyToPoint={flyToPoint}
          />
        </div>
      )}

      {/* GPS Use My Location — only when issue found */}
      {checkType && issueFound && (
        <button
          type="button"
          onClick={captureLocation}
          disabled={gpsLoading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '10px 16px', marginBottom: 8, borderRadius: 8,
            border: '1px solid var(--color-border-active)', background: 'var(--color-border)',
            color: 'var(--color-accent)', fontSize: 'var(--fs-md)', fontWeight: 600,
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
      )}

      {/* Remarks Section */}
      {checkType && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
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
                background: remarkText.trim() ? 'var(--color-cyan)' : 'var(--color-bg-elevated)',
                color: remarkText.trim() ? 'var(--color-bg-surface-solid)' : 'var(--color-text-4)',
                fontSize: 'var(--fs-base)', fontWeight: 700, cursor: remarkText.trim() ? 'pointer' : 'default',
                fontFamily: 'inherit', alignSelf: 'flex-end', height: 36,
              }}
            >
              Save
            </button>
          </div>

          {remarks.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-bg-elevated)', paddingTop: 10 }}>
              {remarks.map((remark) => (
                <div key={remark.id} style={{ borderLeft: '2px solid var(--color-text-4)', paddingLeft: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{remark.user_name}</span>
                    {' — '}
                    {new Date(remark.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' '}
                    {new Date(remark.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{remark.comment}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photos Section — only when issue found */}
      {checkType && issueFound && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Photos
          </div>

          {photos.length > 0 && (
            <div className="photo-grid" style={{ marginBottom: 8 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-active)' }}>
                  <img src={p.url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: 2, right: 2, background: 'var(--color-overlay)', border: 'none',
                      color: '#EF4444', fontSize: 'var(--fs-md)', width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
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
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
          <PhotoPickerButton
            onUpload={() => fileInputRef.current?.click()}
            onCapture={() => cameraInputRef.current?.click()}
          />
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
            background: 'var(--color-success)', fontSize: 'var(--fs-xl)', fontWeight: 800,
            padding: '14px', borderRadius: 10,
          }}
        >
          {saving ? 'Saving...' : '✓ Complete Check'}
        </button>
      )}

      {checkType && (
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
          Will be recorded as completed by <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{currentUser}</span>
        </div>
      )}

      {/* ── Airfield Diagram Fullscreen Overlay ── */}
      {showDiagram && diagramUrl && (
        <div
          onClick={() => setShowDiagram(false)}
          onTouchEnd={(e) => { if (e.target === e.currentTarget) setShowDiagram(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '60px 12px 24px',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowDiagram(false) }}
            style={{
              position: 'fixed', top: 12, right: 12, zIndex: 10000,
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
              padding: '10px 18px', color: '#fff', fontSize: 'var(--fs-xl)', fontWeight: 700, cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >Close</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={diagramUrl}
            alt="Airfield Diagram"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 100px)', objectFit: 'contain', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  )
}
