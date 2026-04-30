'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import {
  Zap, X, Crosshair, MapPin, Plane, Wrench, Bird as BirdIcon,
} from 'lucide-react'
import { createStrike, updateStrike, type WildlifeStrikeRow } from '@/lib/supabase/wildlife'
import { WILDLIFE_SPECIES, type WildlifeSpecies, resolveWildlifeImage } from '@/lib/wildlife-species-data'
import { createClient } from '@/lib/supabase/client'
import { fetchBaseSpecies } from '@/lib/supabase/base-wildlife-species'
import { SpeciesPicker } from './species-picker'

const LocationPickerMap = dynamic(
  () => import('@/components/ui/location-picker-map-google'),
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
  BWC_OPTIONS,
} from '@/lib/constants'
import { useDashboard } from '@/lib/dashboard-context'
import { useInstallation } from '@/lib/installation-context'
import { fetchWeatherWithFormFields } from '@/lib/weather'
import { formatZuluTime } from '@/lib/utils'

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
  const { bwcValue: currentBwc } = useDashboard()
  const { installationId, areas: installationAreas } = useInstallation()
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
    if (initialData?.species_common) return WILDLIFE_SPECIES.find(s => s.common_name === initialData.species_common) ?? null
    return null
  })
  const [showPicker, setShowPicker] = useState(false)
  const [numberStruck, setNumberStruck] = useState<number | ''>(initialData?.number_struck ?? 1)
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
  const [bwcAtTime, setBwcAtTime] = useState(initialData?.bwc_at_time ?? '')
  const [strikeTime, setStrikeTime] = useState(() => {
    if (initialData?.strike_date) {
      const d = new Date(initialData.strike_date)
      return d.toISOString().slice(0, 16)
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
        number_struck: numberStruck || 1,
        number_seen: numberSeen,
        latitude, longitude,
        location_text: locationText || null,
        strike_date: strikeTime + 'Z',
        time_of_day: timeOfDay || null,
        sky_condition: skyCondition || null,
        precipitation: precipitation || null,
        bwc_at_time: bwcAtTime || null,
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
      number_struck: numberStruck || 1,
      number_seen: numberSeen,
      latitude, longitude,
      location_text: locationText || null,
      strike_date: strikeTime + 'Z',
      time_of_day: timeOfDay || null,
      sky_condition: skyCondition || null,
      precipitation: precipitation || null,
      bwc_at_time: bwcAtTime || null,
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
    width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)', color: 'var(--color-text)',
    fontSize: 'var(--fs-base)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
    marginBottom: 4, display: 'block',
  }

  const sectionStyle: React.CSSProperties = {
    fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginTop: 18, marginBottom: 8, paddingBottom: 6,
    borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
    display: 'flex', alignItems: 'center', gap: 8,
  }

  const formContent = (
    <>
        {!inline && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, paddingBottom: 8, marginBottom: 14,
          borderBottom: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={16} color="var(--color-danger)" />
            <div style={{
              fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{isEdit ? 'Edit Strike Report' : 'Report Wildlife Strike'}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-3)', padding: 4,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><X size={18} /></button>
        </div>
        )}

        {/* GPS + Map Location — anchored at the top of the form so
            the user pins the strike location first; the rest of the
            fields (species, count, aircraft, damage, etc.) flow
            under it. */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Pin Location</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={captureLocation}
              disabled={gpsLoading}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: latitude
                  ? '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)'
                  : '1px solid var(--color-border)',
                background: latitude
                  ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
                  : 'var(--color-bg-surface)',
                color: latitude ? 'var(--color-danger)' : 'var(--color-text-2)',
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
                  ? '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)'
                  : '1px solid var(--color-border)',
                background: showMap
                  ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)'
                  : 'var(--color-bg-surface)',
                color: showMap ? 'var(--color-danger)' : 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <MapPin size={14} />
              {showMap ? 'Hide Map' : 'Pin on Map'}
            </button>
          </div>
          {latitude != null && longitude != null && !showMap && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', fontFamily: 'monospace' }}>
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

        {/* Species */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Species</label>
          {selectedSpecies ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 8, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
            }}>
              <img
                src={resolveWildlifeImage(selectedSpecies)!}
                alt={selectedSpecies.common_name}
                style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
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
              <span>Tap to select species (or leave blank)...</span>
              <span style={{ fontSize: 'var(--fs-sm)' }}>Browse</span>
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}># Struck</label>
            <input type="number" min={1} value={numberStruck}
              onChange={e => {
                const v = e.target.value
                setNumberStruck(v === '' ? '' : Math.max(1, parseInt(v) || 1))
              }}
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
          <select value={locationText} onChange={e => setLocationText(e.target.value)} style={selectStyle}>
            <option value="">— Select —</option>
            {(installationAreas || []).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Strike Time (Zulu) */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Time of Strike (Zulu)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="datetime-local" lang="en-GB"
              value={strikeTime}
              onChange={e => setStrikeTime(e.target.value)}
              style={{ ...selectStyle, flex: 1 }}
            />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', flexShrink: 0 }}>Z</span>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            {formatZuluTime(new Date(strikeTime + 'Z'))}Z — all times in UTC/Zulu
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
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
          <div>
            <label style={labelStyle}>BWC</label>
            <select value={bwcAtTime} onChange={e => setBwcAtTime(e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {BWC_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* Aircraft Info */}
        <div style={sectionStyle}><Plane size={13} /> Aircraft Information</div>
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
        <div style={sectionStyle}><Wrench size={13} /> Damage Assessment</div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Parts Struck</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {AIRCRAFT_PARTS_STRIKE.map(part => {
              const selected = partsStruck.includes(part)
              return (
                <button key={part}
                  onClick={() => togglePart(part, partsStruck, setPartsStruck)}
                  style={{
                    padding: '4px 9px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-xs)', fontWeight: 700,
                    border: selected
                      ? '1px solid color-mix(in srgb, var(--color-danger) 50%, transparent)'
                      : '1px solid var(--color-border)',
                    background: selected
                      ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)'
                      : 'var(--color-bg-surface)',
                    color: selected ? 'var(--color-danger)' : 'var(--color-text-2)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {formatPartLabel(part)}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Parts Damaged</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {partsStruck.map(part => {
              const selected = partsDamaged.includes(part)
              return (
                <button key={part}
                  onClick={() => togglePart(part, partsDamaged, setPartsDamaged)}
                  style={{
                    padding: '4px 9px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-xs)', fontWeight: 700,
                    border: selected
                      ? '1px solid color-mix(in srgb, var(--color-orange) 50%, transparent)'
                      : '1px solid var(--color-border)',
                    background: selected
                      ? 'color-mix(in srgb, var(--color-orange) 14%, transparent)'
                      : 'var(--color-bg-surface)',
                    color: selected ? 'var(--color-orange)' : 'var(--color-text-2)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {formatPartLabel(part)}
                </button>
              )
            })}
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
        <div style={sectionStyle}><BirdIcon size={13} /> Remains</div>
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
            width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)',
            background: saving
              ? 'var(--color-bg-elevated)'
              : 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
            color: saving ? 'var(--color-text-4)' : 'var(--color-danger)',
            fontWeight: 700, fontSize: 'var(--fs-md)',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Zap size={16} />
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
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
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
      />
    )}
    </>
  )
}
