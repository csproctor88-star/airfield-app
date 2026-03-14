'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { createStrike } from '@/lib/supabase/wildlife'
import { WILDLIFE_SPECIES, type WildlifeSpecies } from '@/lib/wildlife-species-data'
import { createClient } from '@/lib/supabase/client'
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

type Props = {
  currentUser: string
  baseId?: string | null
  onClose: () => void
  onSaved: () => void
}

export function StrikeForm({ currentUser, baseId, onClose, onSaved }: Props) {
  const [userId, setUserId] = useState<string | null>(null)
  const [speciesSearch, setSpeciesSearch] = useState('')
  const [selectedSpecies, setSelectedSpecies] = useState<WildlifeSpecies | null>(null)
  const [showSpeciesList, setShowSpeciesList] = useState(false)
  const [numberStruck, setNumberStruck] = useState(1)
  const [numberSeen, setNumberSeen] = useState<number | null>(null)
  const [locationText, setLocationText] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [skyCondition, setSkyCondition] = useState('')
  const [precipitation, setPrecipitation] = useState('')
  const [aircraftType, setAircraftType] = useState('')
  const [aircraftRegistration, setAircraftRegistration] = useState('')
  const [engineType, setEngineType] = useState('')
  const [phaseOfFlight, setPhaseOfFlight] = useState('')
  const [altitudeAgl, setAltitudeAgl] = useState<number | null>(null)
  const [speedIas, setSpeedIas] = useState<number | null>(null)
  const [pilotWarned, setPilotWarned] = useState<boolean | null>(null)
  const [partsStruck, setPartsStruck] = useState<string[]>([])
  const [partsDamaged, setPartsDamaged] = useState<string[]>([])
  const [damageLevel, setDamageLevel] = useState('none')
  const [engineIngested, setEngineIngested] = useState(false)
  const [flightEffect, setFlightEffect] = useState('none')
  const [repairCost, setRepairCost] = useState<number | null>(null)
  const [hoursOutOfService, setHoursOutOfService] = useState<number | null>(null)
  const [remainsCollected, setRemainsCollected] = useState(false)
  const [remainsSentToLab, setRemainsSentToLab] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 7) setTimeOfDay('dawn')
    else if (hour >= 7 && hour < 17) setTimeOfDay('day')
    else if (hour >= 17 && hour < 19) setTimeOfDay('dusk')
    else setTimeOfDay('night')
  }, [])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude) },
        () => {},
      )
    }
  }, [])

  const filteredSpecies = speciesSearch.length > 0
    ? WILDLIFE_SPECIES.filter(s =>
        s.common_name.toLowerCase().includes(speciesSearch.toLowerCase()) ||
        s.scientific_name.toLowerCase().includes(speciesSearch.toLowerCase()),
      ).slice(0, 10)
    : WILDLIFE_SPECIES.slice(0, 10)

  function togglePart(part: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(part) ? list.filter(p => p !== part) : [...list, part])
  }

  function formatPartLabel(part: string) {
    return part.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  async function handleSubmit() {
    setSaving(true)
    const { error } = await createStrike({
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
    onSaved()
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

  return (
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: '#EF4444' }}>Report Wildlife Strike</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--color-text-3)' }}>×</button>
        </div>

        {/* Species */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Species</label>
          <input
            type="text"
            placeholder="Search species (or leave blank if unknown)..."
            value={selectedSpecies ? selectedSpecies.common_name : speciesSearch}
            onChange={e => { setSpeciesSearch(e.target.value); setSelectedSpecies(null); setShowSpeciesList(true) }}
            onFocus={() => setShowSpeciesList(true)}
            style={selectStyle}
          />
          {showSpeciesList && !selectedSpecies && speciesSearch.length > 0 && (
            <div style={{
              border: '1px solid var(--color-border)', borderRadius: 6,
              maxHeight: 180, overflowY: 'auto', background: 'var(--color-bg-surface)', marginTop: 4,
            }}>
              {filteredSpecies.map(sp => (
                <button
                  key={sp.common_name}
                  onClick={() => { setSelectedSpecies(sp); setShowSpeciesList(false); setSpeciesSearch('') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 10px', background: 'none', border: 'none',
                    borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
                    textAlign: 'left', color: 'var(--color-text)',
                  }}
                >
                  {sp.image_url && (
                    <img src={sp.image_url} alt={sp.common_name}
                      style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--fs-base)' }}>{sp.common_name}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>{sp.scientific_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedSpecies && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
              {selectedSpecies.image_url && (
                <img src={selectedSpecies.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              <span style={{ fontStyle: 'italic' }}>{selectedSpecies.scientific_name}</span>
              <button onClick={() => { setSelectedSpecies(null); setSpeciesSearch('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}>×</button>
            </div>
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

        {/* Location & Conditions */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Location</label>
          <input type="text" placeholder="e.g. RWY 01, TWY B"
            value={locationText} onChange={e => setLocationText(e.target.value)} style={selectStyle} />
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

        {/* GPS indicator */}
        {latitude && longitude && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10 }}>
            GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </div>
        )}

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
          {saving ? 'Saving...' : 'Report Strike'}
        </button>
      </div>
    </div>
  )
}
