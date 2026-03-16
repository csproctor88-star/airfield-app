'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { createStrike, updateStrike, type WildlifeStrikeRow } from '@/lib/supabase/wildlife'
import { WILDLIFE_SPECIES, type WildlifeSpecies, resolveWildlifeImage } from '@/lib/wildlife-species-data'
import { createClient } from '@/lib/supabase/client'
import { SpeciesPicker } from './species-picker'

const LocationPickerMap = dynamic(
  () => import('@/components/ui/location-picker-map'),
  { ssr: false },
)
import {
  FLIGHT_PHASES,
  DAMAGE_LEVELS,
  AIRCRAFT_PARTS_STRIKE,
  FLIGHT_EFFECTS,
  ENGINE_TYPES,
  SKY_CONDITIONS,
  PRECIPITATION_OPTIONS,
  TIME_OF_DAY_OPTIONS,
} from '@/lib/constants'
import { fetchWeatherWithFormFields } from '@/lib/weather'

type Props = {
  currentUser: string
  baseId?: string | null
  onClose: () => void
  onSaved: (displayId?: string) => void
  initialData?: WildlifeStrikeRow | null
  checkId?: string | null
  inline?: boolean
}

export function StrikeForm({ currentUser, baseId, onClose, onSaved, initialData, checkId, inline }: Props) {
  const isEdit = !!initialData
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<WildlifeSpecies | null>(() => {
    if (initialData?.species_common) return WILDLIFE_SPECIES.find(s => s.common_name === initialData.species_common) ?? null
    return null
  })
  const [showPicker, setShowPicker] = useState(false)
  const [numberStruck, setNumberStruck] = useState(initialData?.number_struck ?? 1)
  const [numberSeen, setNumberSeen] = useState<number | null>(initialData?.number_seen ?? null)
  const [locationText, setLocationText] = useState(initialData?.location_text ?? '')
  const [timeOfDay, setTimeOfDay] = useState(initialData?.time_of_day ?? '')
  const [skyCondition, setSkyCondition] = useState(initialData?.sky_condition ?? '')
  const [precipitation, setPrecipitation] = useState(initialData?.precipitation ?? '')
  const [aircraftType, setAircraftType] = useState(initialData?.aircraft_type ?? '')
  const [aircraftRegistration, setAircraftRegistration] = useState(initialData?.aircraft_registration ?? '')
  const [engineType, setEngineType] = useState(initialData?.engine_type ?? '')
  const [phaseOfFlight, setPhaseOfFlight] = useState(initialData?.phase_of_flight ?? '')
  const [altitudeAgl, setAltitudeAgl] = useState<number | null>(initialData?.altitude_agl ?? null)
  const [speedIas, setSpeedIas] = useState<number | null>(initialData?.speed_ias ?? null)
  const [pilotWarned, setPilotWarned] = useState<boolean | null>(initialData?.pilot_warned ?? null)
  const [partsStruck, setPartsStruck] = useState<string[]>(initialData?.parts_struck ?? [])
  const [partsDamaged, setPartsDamaged] = useState<string[]>(initialData?.parts_damaged ?? [])
  const [damageLevel, setDamageLevel] = useState(initialData?.damage_level ?? 'none')
  const [engineIngested, setEngineIngested] = useState(initialData?.engine_ingested ?? false)
  const [flightEffect, setFlightEffect] = useState(initialData?.flight_effect ?? 'none')
  const [repairCost, setRepairCost] = useState<number | null>(initialData?.repair_cost ?? null)
  const [hoursOutOfService, setHoursOutOfService] = useState<number | null>(initialData?.hours_out_of_service ?? null)
  const [remainsCollected, setRemainsCollected] = useState(initialData?.remains_collected ?? false)
  const [remainsSentToLab, setRemainsSentToLab] = useState(initialData?.remains_sent_to_lab ?? false)
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude ?? null)
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude ?? null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [flyToPoint, setFlyToPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [showMap, setShowMap] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

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

  function togglePart(part: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(part) ? list.filter(p => p !== part) : [...list, part])
  }

  function formatPartLabel(part: string) {
    return part.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  async function handleSubmit() {
    setSaving(true)

    if (isEdit && initialData) {
      const { error } = await updateStrike(initialData.id, {
        species_common: selectedSpecies?.common_name ?? null,
        species_scientific: selectedSpecies?.scientific_name ?? null,
        species_group: selectedSpecies?.group ?? null,
        size_category: selectedSpecies?.size_category ?? null,
        number_struck: numberStruck,
        number_seen: numberSeen,
        latitude, longitude,
        location_text: locationText || null,
        time_of_day: timeOfDay || null,
        sky_condition: skyCondition || null,
        precipitation: precipitation || null,
        aircraft_type: aircraftType || null,
        aircraft_registration: aircraftRegistration || null,
        engine_type: engineType || null,
        phase_of_flight: phaseOfFlight || null,
        altitude_agl: altitudeAgl,
        speed_ias: speedIas,
        pilot_warned: pilotWarned,
        parts_struck: partsStruck,
        parts_damaged: partsDamaged,
        damage_level: damageLevel,
        engine_ingested: engineIngested,
        flight_effect: flightEffect,
        repair_cost: repairCost,
        hours_out_of_service: hoursOutOfService,
        remains_collected: remainsCollected,
        remains_sent_to_lab: remainsSentToLab,
        notes: notes || null,
      })
      setSaving(false)
      if (error) { toast.error(error); return }
      toast.success('Strike report updated')
      onSaved()
      return
    }

    const { data: created, error } = await createStrike({
      species_common: selectedSpecies?.common_name ?? null,
      species_scientific: selectedSpecies?.scientific_name ?? null,
      species_group: selectedSpecies?.group ?? null,
      size_category: selectedSpecies?.size_category ?? null,
      number_struck: numberStruck,
      number_seen: numberSeen,
      latitude, longitude,
      location_text: locationText || null,
      time_of_day: timeOfDay || null,
      sky_condition: skyCondition || null,
      precipitation: precipitation || null,
      aircraft_type: aircraftType || null,
      aircraft_registration: aircraftRegistration || null,
      engine_type: engineType || null,
      phase_of_flight: phaseOfFlight || null,
      altitude_agl: altitudeAgl,
      speed_ias: speedIas,
      pilot_warned: pilotWarned,
      parts_struck: partsStruck,
      parts_damaged: partsDamaged,
      damage_level: damageLevel,
      engine_ingested: engineIngested,
      flight_effect: flightEffect,
      repair_cost: repairCost,
      hours_out_of_service: hoursOutOfService,
      remains_collected: remainsCollected,
      remains_sent_to_lab: remainsSentToLab,
      reported_by: currentUser,
      reported_by_id: userId,
      notes: notes || null,
      base_id: baseId,
    })

    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Wildlife strike reported')
    onSaved(created?.display_id)
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)', color: 'var(--color-text)',
    fontSize: 'var(--fs-base)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
    marginBottom: 4, display: 'block',
  }

  const sectionStyle: React.CSSProperties = {
    fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-text)',
    marginTop: 16, marginBottom: 8, paddingBottom: 4,
    borderBottom: '1px solid var(--color-border)',
  }

  const formContent = (
    <>
        {!inline && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: '#EF4444' }}>{isEdit ? 'Edit Strike Report' : 'Report Wildlife Strike'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--color-text-3)' }}>×</button>
        </div>
        )}

        {/* Species */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Species</label>
          {selectedSpecies ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 8, borderRadius: 8, background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
            }}>
              <img
                src={resolveWildlifeImage(selectedSpecies)!}
                alt={selectedSpecies.common_name}
                style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{selectedSpecies.common_name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                  {selectedSpecies.scientific_name} · {selectedSpecies.group}
                </div>
              </div>
              <button
                onClick={() => setSelectedSpecies(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', fontSize: 18, padding: 4 }}
              >×</button>
            </div>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              style={{
                ...selectStyle, cursor: 'pointer', textAlign: 'left',
                color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>Tap to select species (or leave blank)...</span>
              <span style={{ fontSize: 'var(--fs-sm)' }}>Browse</span>
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}># Struck</label>
            <input type="number" min={1} value={numberStruck}
              onChange={e => setNumberStruck(Math.max(1, parseInt(e.target.value) || 1))}
              style={selectStyle} />
          </div>
          <div>
            <label style={labelStyle}># Seen</label>
            <input type="number" min={0} value={numberSeen ?? ''}
              onChange={e => setNumberSeen(e.target.value ? parseInt(e.target.value) : null)}
              style={selectStyle} />
          </div>
        </div>

        {/* Location */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Location</label>
          <input type="text" placeholder="e.g. RWY 01, TWY B"
            value={locationText} onChange={e => setLocationText(e.target.value)} style={selectStyle} />
        </div>

        {/* GPS + Map Location */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Pin Location</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={captureLocation}
              disabled={gpsLoading}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
                color: latitude ? '#EF4444' : 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: gpsLoading ? 'wait' : 'pointer',
                opacity: gpsLoading ? 0.6 : 1,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
              </svg>
              {gpsLoading ? 'Getting Location...' : latitude ? 'Update GPS' : 'Use My Location'}
            </button>
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: showMap ? '#EF4444' : 'var(--color-bg-surface)',
                color: showMap ? '#fff' : 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              {showMap ? 'Hide Map' : 'Pin on Map'}
            </button>
          </div>
          {latitude != null && longitude != null && !showMap && (
            <div style={{ fontSize: 'var(--fs-xs)', color: '#EF4444', fontFamily: 'monospace' }}>
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </div>
          )}
          {showMap && (
            <LocationPickerMap
              onPointSelected={handlePointSelected}
              selectedLat={latitude}
              selectedLng={longitude}
              flyToPoint={flyToPoint}
              markerColor="#EF4444"
              promptText="Tap map to mark strike location"
              aspectRatio="16 / 9"
              maxHeight="240px"
            />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Time</label>
            <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {TIME_OF_DAY_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Sky</label>
            <select value={skyCondition} onChange={e => setSkyCondition(e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {SKY_CONDITIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Precip</label>
            <select value={precipitation} onChange={e => setPrecipitation(e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {PRECIPITATION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Aircraft Info */}
        <div style={sectionStyle}>Aircraft Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Aircraft Type</label>
            <input type="text" placeholder="e.g. C-130J, F-16"
              value={aircraftType} onChange={e => setAircraftType(e.target.value)} style={selectStyle} />
          </div>
          <div>
            <label style={labelStyle}>Registration/Tail #</label>
            <input type="text" placeholder="e.g. 88-0012"
              value={aircraftRegistration} onChange={e => setAircraftRegistration(e.target.value)} style={selectStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Engine Type</label>
            <select value={engineType} onChange={e => setEngineType(e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {ENGINE_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phase of Flight</label>
            <select value={phaseOfFlight} onChange={e => setPhaseOfFlight(e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {FLIGHT_PHASES.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Pilot Warned?</label>
            <select
              value={pilotWarned === null ? '' : pilotWarned ? 'yes' : 'no'}
              onChange={e => setPilotWarned(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}
              style={selectStyle}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Altitude (AGL ft)</label>
            <input type="number" min={0} value={altitudeAgl ?? ''}
              onChange={e => setAltitudeAgl(e.target.value ? parseInt(e.target.value) : null)} style={selectStyle} />
          </div>
          <div>
            <label style={labelStyle}>Speed (IAS kts)</label>
            <input type="number" min={0} value={speedIas ?? ''}
              onChange={e => setSpeedIas(e.target.value ? parseInt(e.target.value) : null)} style={selectStyle} />
          </div>
        </div>

        {/* Damage Assessment */}
        <div style={sectionStyle}>Damage Assessment</div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Parts Struck</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {AIRCRAFT_PARTS_STRIKE.map(part => (
              <button key={part}
                onClick={() => togglePart(part, partsStruck, setPartsStruck)}
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                  border: '1px solid var(--color-border)', cursor: 'pointer',
                  background: partsStruck.includes(part) ? '#EF444420' : 'var(--color-bg-surface)',
                  color: partsStruck.includes(part) ? '#EF4444' : 'var(--color-text-2)',
                }}
              >
                {formatPartLabel(part)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Parts Damaged</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {partsStruck.map(part => (
              <button key={part}
                onClick={() => togglePart(part, partsDamaged, setPartsDamaged)}
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                  border: '1px solid var(--color-border)', cursor: 'pointer',
                  background: partsDamaged.includes(part) ? '#F9731620' : 'var(--color-bg-surface)',
                  color: partsDamaged.includes(part) ? '#F97316' : 'var(--color-text-2)',
                }}
              >
                {formatPartLabel(part)}
              </button>
            ))}
            {partsStruck.length === 0 && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>Select parts struck first</span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Damage Level</label>
            <select value={damageLevel} onChange={e => setDamageLevel(e.target.value)} style={selectStyle}>
              {DAMAGE_LEVELS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Flight Effect</label>
            <select value={flightEffect} onChange={e => setFlightEffect(e.target.value)} style={selectStyle}>
              {FLIGHT_EFFECTS.map(fe => <option key={fe.value} value={fe.value}>{fe.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Engine Ingested?</label>
            <select
              value={engineIngested ? 'yes' : 'no'}
              onChange={e => setEngineIngested(e.target.value === 'yes')}
              style={selectStyle}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Repair Cost ($)</label>
            <input type="number" min={0} value={repairCost ?? ''}
              onChange={e => setRepairCost(e.target.value ? parseFloat(e.target.value) : null)} style={selectStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Hours Out of Service</label>
          <input type="number" min={0} value={hoursOutOfService ?? ''}
            onChange={e => setHoursOutOfService(e.target.value ? parseInt(e.target.value) : null)} style={selectStyle} />
        </div>

        {/* Remains */}
        <div style={sectionStyle}>Remains</div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={remainsCollected} onChange={e => setRemainsCollected(e.target.checked)} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>Remains Collected</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={remainsSentToLab} onChange={e => setRemainsSentToLab(e.target.checked)} />
            <span style={{ fontSize: 'var(--fs-sm)' }}>Sent to Smithsonian</span>
          </label>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Additional details..." style={{ ...selectStyle, resize: 'vertical' }} />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: '100%', padding: '12px', borderRadius: 8, border: 'none',
            background: saving ? 'var(--color-text-4)' : '#EF4444',
            color: '#fff', fontWeight: 800, fontSize: 'var(--fs-md)', cursor: 'pointer',
          }}
        >
          {saving ? 'Saving...' : isEdit ? 'Update Strike' : 'Report Strike'}
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
          />
        )}
      </>
    )
  }

  return (
    <>
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--color-bg)', borderRadius: '16px 16px 0 0',
        padding: 20,
      }}>
        {formContent}
      </div>
    </div>
    {showPicker && (
      <SpeciesPicker
        onSelect={sp => { setSelectedSpecies(sp); setShowPicker(false) }}
        onClose={() => setShowPicker(false)}
      />
    )}
    </>
  )
}
