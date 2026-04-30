'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  Eye, X, Crosshair, MapPin, AlertTriangle, CheckCircle2,
  Cloud, Megaphone, MessageSquare,
} from 'lucide-react'
import { createSighting, updateSighting, type WildlifeSightingRow } from '@/lib/supabase/wildlife'
import { WILDLIFE_SPECIES, type WildlifeSpecies, resolveWildlifeImage } from '@/lib/wildlife-species-data'
import {
  WILDLIFE_BEHAVIORS,
  WILDLIFE_ACTIONS,
  DISPERSAL_METHODS,
  SKY_CONDITIONS,
  PRECIPITATION_OPTIONS,
  TIME_OF_DAY_OPTIONS,
  BWC_OPTIONS,
} from '@/lib/constants'
import { useInstallation } from '@/lib/installation-context'
import { useDashboard } from '@/lib/dashboard-context'
import { createClient } from '@/lib/supabase/client'
import { fetchWeatherWithFormFields } from '@/lib/weather'
import { formatZuluTime } from '@/lib/utils'
import { fetchBaseSpecies } from '@/lib/supabase/base-wildlife-species'
import { SpeciesPicker } from './species-picker'

const LocationPickerMap = dynamic(
  () => import('@/components/ui/location-picker-map-google'),
  { ssr: false },
)

type Props = {
  currentUser: string
  baseId?: string | null
  onClose: () => void
  onSaved: (displayId?: string) => void
  initialData?: WildlifeSightingRow | null
  checkId?: string | null
  required?: boolean
  inline?: boolean
}

export function SightingForm({ currentUser, baseId, onClose, onSaved, initialData, checkId, required, inline }: Props) {
  const { installationId, areas: installationAreas } = useInstallation()
  const { bwcValue: currentBwc } = useDashboard()
  const isEdit = !!initialData

  const [baseSpeciesNames, setBaseSpeciesNames] = useState<Set<string> | null>(null)
  const [favoriteSpeciesNames, setFavoriteSpeciesNames] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (!installationId) return
    fetchBaseSpecies(installationId).then(rows => {
      if (rows.length > 0) {
        setBaseSpeciesNames(new Set(rows.map(r => r.species_common)))
        const favs = rows.filter(r => r.is_favorite).map(r => r.species_common)
        if (favs.length > 0) setFavoriteSpeciesNames(new Set(favs))
      }
    })
  }, [installationId])

  const [userId, setUserId] = useState<string | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<WildlifeSpecies | null>(() => {
    if (initialData) return WILDLIFE_SPECIES.find(s => s.common_name === initialData.species_common) ?? null
    return null
  })
  const [showPicker, setShowPicker] = useState(false)
  const [countObserved, setCountObserved] = useState<number | ''>(initialData?.count_observed ?? 1)
  const [behavior, setBehavior] = useState(initialData?.behavior ?? '')
  const [locationText, setLocationText] = useState(initialData?.location_text ?? '')
  const [airfieldZone, setAirfieldZone] = useState(initialData?.airfield_zone ?? '')
  const [timeOfDay, setTimeOfDay] = useState(initialData?.time_of_day ?? '')
  const [skyCondition, setSkyCondition] = useState(initialData?.sky_condition ?? '')
  const [precipitation, setPrecipitation] = useState(initialData?.precipitation ?? '')
  const [actionsTaken, setActionsTaken] = useState<string[]>(() => {
    if (initialData?.action_taken && initialData.action_taken !== 'none') return initialData.action_taken.split(',')
    return []
  })
  const [dispersalMethod, setDispersalMethod] = useState(initialData?.dispersal_method ?? '')
  const [dispersalEffective, setDispersalEffective] = useState<boolean | null>(initialData?.dispersal_effective ?? null)
  const [bwcAtTime, setBwcAtTime] = useState(initialData?.bwc_at_time ?? '')
  const [observationTime, setObservationTime] = useState(() => {
    if (initialData?.observed_at) {
      const d = new Date(initialData.observed_at)
      return d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm in UTC
    }
    return new Date().toISOString().slice(0, 16)
  })
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude ?? null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [flyToPoint, setFlyToPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [showMap, setShowMap] = useState(true)

  // Get current user ID
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // Auto-detect time of day, weather, and BWC (skip when editing)
  useEffect(() => {
    if (isEdit) return
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 7) setTimeOfDay('dawn')
    else if (hour >= 7 && hour < 17) setTimeOfDay('day')
    else if (hour >= 17 && hour < 19) setTimeOfDay('dusk')
    else setTimeOfDay('night')

    // Auto-fill weather from current conditions
    fetchWeatherWithFormFields().then(result => {
      if (!result) return
      setSkyCondition(result.sky_condition)
      setPrecipitation(result.precipitation)
    })
  }, [isEdit])

  // Auto-populate BWC from current airfield status
  useEffect(() => {
    if (!isEdit && currentBwc && !bwcAtTime) setBwcAtTime(currentBwc)
  }, [isEdit, currentBwc, bwcAtTime])

  const handlePointSelected = useCallback((lat: number, lng: number) => {
    setLatitude(lat)
    setLongitude(lng)
    toast.success(`Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
  }, [])

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setLatitude(lat)
        setLongitude(lng)
        setFlyToPoint({ lat, lng })
        setShowMap(true)
        setGpsLoading(false)
        toast.success(`GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      },
      (err) => {
        setGpsLoading(false)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            toast.error('Location access denied. Enable in browser settings.')
            break
          case err.POSITION_UNAVAILABLE:
            toast.error('Location unavailable. Try again outside.')
            break
          case err.TIMEOUT:
            toast.error('Location request timed out. Try again.')
            break
          default:
            toast.error('Could not get location')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [])

  async function handleSubmit() {
    if (!selectedSpecies) { toast.error('Select a species'); return }

    setSaving(true)

    if (isEdit && initialData) {
      const { error } = await updateSighting(initialData.id, {
        species_common: selectedSpecies.common_name,
        species_scientific: selectedSpecies.scientific_name,
        species_group: selectedSpecies.group,
        size_category: selectedSpecies.size_category,
        count_observed: countObserved || 1,
        behavior: behavior || null,
        latitude,
        longitude,
        location_text: airfieldZone || null,
        airfield_zone: airfieldZone || null,
        observed_at: observationTime + 'Z',
        time_of_day: timeOfDay || null,
        sky_condition: skyCondition || null,
        precipitation: precipitation || null,
        action_taken: actionsTaken.length > 0 ? actionsTaken.join(',') : 'none',
        dispersal_method: actionsTaken.length > 0 ? dispersalMethod || null : null,
        dispersal_effective: actionsTaken.length > 0 ? dispersalEffective : null,
        bwc_at_time: bwcAtTime || null,
        notes: notes || null,
      })
      setSaving(false)
      if (error) { toast.error(error); return }
      toast.success('Sighting updated')
      onSaved()
      return
    }

    const { data: created, error } = await createSighting({
      species_common: selectedSpecies.common_name,
      species_scientific: selectedSpecies.scientific_name,
      species_group: selectedSpecies.group,
      size_category: selectedSpecies.size_category,
      count_observed: countObserved || 1,
      behavior: behavior || null,
      latitude,
      longitude,
      location_text: airfieldZone || null,
      airfield_zone: airfieldZone || null,
      observed_at: observationTime + 'Z',
      time_of_day: timeOfDay || null,
      sky_condition: skyCondition || null,
      precipitation: precipitation || null,
      action_taken: actionsTaken.length > 0 ? actionsTaken.join(',') : 'none',
      dispersal_method: actionsTaken.length > 0 ? dispersalMethod || null : null,
      dispersal_effective: actionsTaken.length > 0 ? dispersalEffective : null,
      bwc_at_time: bwcAtTime || null,
      observed_by: currentUser,
      observed_by_id: userId,
      check_id: checkId ?? undefined,
      notes: notes || null,
      base_id: baseId,
    })

    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Wildlife sighting logged')
    onSaved(created?.display_id)
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)', color: 'var(--color-text)',
    fontSize: 'var(--fs-base)',
  }

  // Field-level label — sentence case, dim, lighter weight. Sits under
  // a card's section header so the two-tier hierarchy reads clean:
  // bold uppercase section title above, lighter sub-label below.
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
    marginBottom: 4, display: 'block', letterSpacing: '0.02em',
  }

  // Card chrome — matches the recipe used on /inspections/construction/new
  const cardStyle: React.CSSProperties = {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 12, marginBottom: 10,
  }

  // Section header — bold uppercase tier label with a Lucide icon prefix
  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
  }

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'var(--color-danger)'
      case 'high': return 'var(--color-orange)'
      case 'medium': return 'var(--color-warning)'
      default: return 'var(--color-success)'
    }
  }

  const formContent = (
    <>
          {required && !inline && (
            <div style={{
              padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-surface))',
              border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
              fontSize: 'var(--fs-sm)', color: 'var(--color-danger)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={14} />
              BASH issue found — log the wildlife sighting before continuing.
            </div>
          )}
          {!inline && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8, paddingBottom: 8, marginBottom: 14,
            borderBottom: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Eye size={16} color="var(--color-success)" />
              <div style={{
                fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{isEdit ? 'Edit Sighting' : required ? 'Log BASH Sighting' : 'Log Wildlife Sighting'}</div>
            </div>
            {!required && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-3)', padding: 4,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              ><X size={18} /></button>
            )}
          </div>
          )}

          {/* PIN LOCATION card — anchored at the top so the user pins
              the sighting first. */}
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <MapPin size={12} /> Pin Location
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={captureLocation}
                disabled={gpsLoading}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  border: latitude
                    ? '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)'
                    : '1px solid var(--color-border)',
                  background: latitude
                    ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                    : 'var(--color-bg-inset)',
                  color: latitude ? 'var(--color-success)' : 'var(--color-text-2)',
                  fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: gpsLoading ? 'wait' : 'pointer',
                  opacity: gpsLoading ? 0.6 : 1, fontFamily: 'inherit',
                }}
              >
                <Crosshair size={14} />
                {gpsLoading ? 'Getting Location...' : latitude ? 'Update GPS' : 'Use My Location'}
              </button>
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  border: showMap
                    ? '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)'
                    : '1px solid var(--color-border)',
                  background: showMap
                    ? 'color-mix(in srgb, var(--color-cyan) 12%, transparent)'
                    : 'var(--color-bg-inset)',
                  color: showMap ? 'var(--color-cyan)' : 'var(--color-text-2)',
                  fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <MapPin size={14} />
                {showMap ? 'Hide Map' : 'Pin on Map'}
              </button>
            </div>
            {latitude != null && longitude != null && !showMap && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-success)', fontFamily: 'monospace' }}>
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </div>
            )}
            {showMap && (
              <LocationPickerMap
                onPointSelected={handlePointSelected}
                selectedLat={latitude}
                selectedLng={longitude}
                flyToPoint={flyToPoint}
                markerColor="#10B981"
                promptText="Tap map to mark sighting location"
                aspectRatio="16 / 9"
                maxHeight="240px"
              />
            )}
          </div>

          {/* WILDLIFE OBSERVED card — species, time, count, behavior */}
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <Eye size={12} /> Wildlife Observed
            </div>

          {/* Species selector — tap to open full picker */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Species *</label>
            {selectedSpecies ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 8, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}>
                <img
                  src={resolveWildlifeImage(selectedSpecies)!}
                  alt={selectedSpecies.common_name}
                  style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{selectedSpecies.common_name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                    {selectedSpecies.scientific_name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--color-text-3)' }}>{selectedSpecies.group} · {selectedSpecies.size_category}</span>
                    <span style={{
                      display: 'inline-block', padding: '1px 7px', borderRadius: 'var(--radius-full)',
                      fontSize: '10px', fontWeight: 700, color: riskColor(selectedSpecies.strike_risk),
                      background: `color-mix(in srgb, ${riskColor(selectedSpecies.strike_risk)} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${riskColor(selectedSpecies.strike_risk)} 35%, transparent)`,
                    }}>
                      {selectedSpecies.strike_risk}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSpecies(null)}
                  aria-label="Clear species"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-3)', padding: 4,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                ><X size={16} /></button>
              </div>
            ) : (
              <button
                onClick={() => setShowPicker(true)}
                style={{
                  ...selectStyle, cursor: 'pointer', textAlign: 'left',
                  color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <span>Tap to select species...</span>
                <span style={{ fontSize: 'var(--fs-sm)' }}>Browse All</span>
              </button>
            )}
          </div>

          {/* Observation Time (Zulu) */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Time of Observation (Zulu)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="datetime-local" lang="en-GB"
                value={observationTime}
                onChange={e => setObservationTime(e.target.value)}
                style={{ ...selectStyle, flex: 1 }}
              />
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', flexShrink: 0 }}>Z</span>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              {formatZuluTime(new Date(observationTime + 'Z'))}Z — all times in UTC/Zulu
            </div>
          </div>

            {/* Count + Behavior */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Count *</label>
                <input
                  type="number" min={1} value={countObserved}
                  onChange={e => {
                    const v = e.target.value
                    setCountObserved(v === '' ? '' : Math.max(1, parseInt(v) || 1))
                  }}
                  style={selectStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Behavior</label>
                <select value={behavior} onChange={e => setBehavior(e.target.value)} style={selectStyle}>
                  <option value="">— Select —</option>
                  {WILDLIFE_BEHAVIORS.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* WHERE & CONDITIONS card — airfield zone + 4-col conditions */}
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <Cloud size={12} /> Where & Conditions
            </div>

            {/* Location */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Location</label>
              <select value={airfieldZone} onChange={e => setAirfieldZone(e.target.value)} style={selectStyle}>
                <option value="">— Select —</option>
                {(installationAreas || []).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Conditions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Time of Day</label>
                <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} style={selectStyle}>
                  <option value="">—</option>
                  {TIME_OF_DAY_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Sky</label>
                <select value={skyCondition} onChange={e => setSkyCondition(e.target.value)} style={selectStyle}>
                  <option value="">—</option>
                  {SKY_CONDITIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Precip</label>
                <select value={precipitation} onChange={e => setPrecipitation(e.target.value)} style={selectStyle}>
                  <option value="">—</option>
                  {PRECIPITATION_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>BWC</label>
                <select value={bwcAtTime} onChange={e => setBwcAtTime(e.target.value)} style={selectStyle}>
                  <option value="">—</option>
                  {BWC_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* RESPONSE card — action taken + dispersal method/effective */}
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <Megaphone size={12} /> Response
            </div>

            <div style={{ marginBottom: actionsTaken.length > 0 ? 12 : 0 }}>
              <label style={labelStyle}>Action Taken</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {WILDLIFE_ACTIONS.filter(a => a.value !== 'none').map(a => {
                  const selected = actionsTaken.includes(a.value)
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setActionsTaken(prev => selected ? prev.filter(v => v !== a.value) : [...prev, a.value])}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-full)',
                        border: selected
                          ? '1px solid color-mix(in srgb, var(--color-success) 50%, transparent)'
                          : '1px solid var(--color-border)',
                        background: selected
                          ? 'color-mix(in srgb, var(--color-success) 14%, transparent)'
                          : 'var(--color-bg-inset)',
                        color: selected ? 'var(--color-success)' : 'var(--color-text-2)',
                        fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {a.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {actionsTaken.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Method</label>
                  <select value={dispersalMethod} onChange={e => setDispersalMethod(e.target.value)} style={selectStyle}>
                    <option value="">— Select —</option>
                    {DISPERSAL_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Effective?</label>
                  <select
                    value={dispersalEffective === null ? '' : dispersalEffective ? 'yes' : 'no'}
                    onChange={e => setDispersalEffective(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}
                    style={selectStyle}
                  >
                    <option value="">—</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* NOTES card */}
          <div style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <MessageSquare size={12} /> Notes
            </div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={3} placeholder="Additional observations..."
              style={{ ...selectStyle, resize: 'vertical' }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedSpecies}
            style={{
              width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--color-success) 45%, transparent)',
              background: saving || !selectedSpecies
                ? 'var(--color-bg-elevated)'
                : 'color-mix(in srgb, var(--color-success) 18%, transparent)',
              color: saving || !selectedSpecies ? 'var(--color-text-4)' : 'var(--color-success)',
              fontWeight: 700, fontSize: 'var(--fs-md)',
              cursor: saving || !selectedSpecies ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <CheckCircle2 size={16} />
            {saving ? 'Saving...' : isEdit ? 'Update Sighting' : 'Log Sighting'}
          </button>
    </>
  )

  if (inline) {
    return (
      <>
        <div style={{ padding: 0 }}>
          {formContent}
        </div>
        {showPicker && (
          <SpeciesPicker
            onSelect={sp => { setSelectedSpecies(sp); setShowPicker(false) }}
            onClose={() => setShowPicker(false)}
            allowedSpecies={baseSpeciesNames}
            favoriteSpecies={favoriteSpeciesNames}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div
        className="modal-overlay"
        style={{ alignItems: 'flex-end', padding: 0 }}
        onMouseDown={e => { if (e.target === e.currentTarget && !required) onClose() }}
      >
        <div style={{
          width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--color-bg)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          padding: 20,
        }}>
          {formContent}
        </div>
      </div>

      {showPicker && (
        <SpeciesPicker
          onSelect={sp => { setSelectedSpecies(sp); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
          allowedSpecies={baseSpeciesNames}
          favoriteSpecies={favoriteSpeciesNames}
        />
      )}
    </>
  )
}
