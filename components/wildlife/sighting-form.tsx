'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { createSighting } from '@/lib/supabase/wildlife'
import { type WildlifeSpecies, resolveWildlifeImage } from '@/lib/wildlife-species-data'
import {
  WILDLIFE_BEHAVIORS,
  WILDLIFE_ACTIONS,
  DISPERSAL_METHODS,
  SKY_CONDITIONS,
  PRECIPITATION_OPTIONS,
  TIME_OF_DAY_OPTIONS,
} from '@/lib/constants'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { SpeciesPicker } from './species-picker'

const LocationPickerMap = dynamic(
  () => import('@/components/ui/location-picker-map'),
  { ssr: false },
)

type Props = {
  currentUser: string
  baseId?: string | null
  onClose: () => void
  onSaved: () => void
}

export function SightingForm({ currentUser, baseId, onClose, onSaved }: Props) {
  const { areas: installationAreas } = useInstallation()

  const [userId, setUserId] = useState<string | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<WildlifeSpecies | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [countObserved, setCountObserved] = useState(1)
  const [behavior, setBehavior] = useState('')
  const [locationText, setLocationText] = useState('')
  const [airfieldZone, setAirfieldZone] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [skyCondition, setSkyCondition] = useState('')
  const [precipitation, setPrecipitation] = useState('')
  const [actionTaken, setActionTaken] = useState('none')
  const [dispersalMethod, setDispersalMethod] = useState('')
  const [dispersalEffective, setDispersalEffective] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [flyToPoint, setFlyToPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [showMap, setShowMap] = useState(false)

  // Get current user ID
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // Auto-detect time of day
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 7) setTimeOfDay('dawn')
    else if (hour >= 7 && hour < 17) setTimeOfDay('day')
    else if (hour >= 17 && hour < 19) setTimeOfDay('dusk')
    else setTimeOfDay('night')
  }, [])

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
    const { error } = await createSighting({
      species_common: selectedSpecies.common_name,
      species_scientific: selectedSpecies.scientific_name,
      species_group: selectedSpecies.group,
      size_category: selectedSpecies.size_category,
      count_observed: countObserved,
      behavior: behavior || null,
      latitude,
      longitude,
      location_text: locationText || null,
      airfield_zone: airfieldZone || null,
      time_of_day: timeOfDay || null,
      sky_condition: skyCondition || null,
      precipitation: precipitation || null,
      action_taken: actionTaken,
      dispersal_method: actionTaken !== 'none' ? dispersalMethod || null : null,
      dispersal_effective: actionTaken !== 'none' ? dispersalEffective : null,
      observed_by: currentUser,
      observed_by_id: userId,
      notes: notes || null,
      base_id: baseId,
    })

    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Wildlife sighting logged')
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

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return '#EF4444'
      case 'high': return '#F97316'
      case 'medium': return '#FBBF24'
      default: return '#10B981'
    }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>Log Wildlife Sighting</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--color-text-3)' }}>×</button>
          </div>

          {/* Species selector — tap to open full picker */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Species *</label>
            {selectedSpecies ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 8, borderRadius: 8, background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
              }}>
                <img
                  src={resolveWildlifeImage(selectedSpecies)!}
                  alt={selectedSpecies.common_name}
                  style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
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
                      display: 'inline-block', padding: '1px 6px', borderRadius: 4,
                      fontSize: '10px', fontWeight: 700, color: '#fff',
                      background: riskColor(selectedSpecies.strike_risk),
                    }}>
                      {selectedSpecies.strike_risk}
                    </span>
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
                <span>Tap to select species...</span>
                <span style={{ fontSize: 'var(--fs-sm)' }}>Browse All</span>
              </button>
            )}
          </div>

          {/* Count + Behavior */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Count *</label>
              <input
                type="number" min={1} value={countObserved}
                onChange={e => setCountObserved(Math.max(1, parseInt(e.target.value) || 1))}
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

          {/* Location text + Zone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Location</label>
              <input
                type="text" placeholder="e.g. RWY 01, TWY A"
                value={locationText} onChange={e => setLocationText(e.target.value)}
                style={selectStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Airfield Zone</label>
              <select value={airfieldZone} onChange={e => setAirfieldZone(e.target.value)} style={selectStyle}>
                <option value="">— Select —</option>
                {(installationAreas || []).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
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
                  color: latitude ? '#10B981' : 'var(--color-text-2)',
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
                  background: showMap ? 'var(--color-cyan)' : 'var(--color-bg-surface)',
                  color: showMap ? '#000' : 'var(--color-text-2)',
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
              <div style={{ fontSize: 'var(--fs-xs)', color: '#10B981', fontFamily: 'monospace' }}>
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

          {/* Conditions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
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
          </div>

          {/* Action taken */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Action Taken</label>
            <select value={actionTaken} onChange={e => setActionTaken(e.target.value)} style={selectStyle}>
              {WILDLIFE_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>

          {actionTaken !== 'none' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
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

          {/* Notes */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Additional observations..."
              style={{ ...selectStyle, resize: 'vertical' }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedSpecies}
            style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: saving || !selectedSpecies ? 'var(--color-text-4)' : '#10B981',
              color: '#fff', fontWeight: 800, fontSize: 'var(--fs-md)', cursor: 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Log Sighting'}
          </button>
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
