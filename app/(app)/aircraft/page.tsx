'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import {
  Search, ChevronDown, ChevronUp, Star, Plane, Shield,
  ArrowUpDown, X, SlidersHorizontal, Layers,
} from 'lucide-react'
import type { AircraftCharacteristics } from '@/aircraft_database_schema'
import {
  allAircraft,
  AIRCRAFT_COUNT,
  SORT_OPTIONS,
  sortAircraft,
  fmtNum,
  fmtWeight,
  getFavorites,
  setFavorites,
} from '@/lib/aircraft-data'
import type { AircraftSortField } from '@/lib/aircraft-data'

// ─── ACN/PCN Panel ──────────────────────────────────────────

function AcnPcnPanel({
  aircraft,
  onClose,
}: {
  aircraft: AircraftCharacteristics
  onClose: () => void
}) {
  const [pcnValue, setPcnValue] = useState('')
  const [pavementType, setPavementType] = useState<'rigid' | 'flexible'>('rigid')
  const [subgrade, setSubgrade] = useState<'A' | 'B' | 'C' | 'D'>('B')
  const [weightMode, setWeightMode] = useState<'max' | 'min'>('max')

  const acn = aircraft.acn
  if (!acn) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>ACN/PCN Comparison</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color="#64748B" />
          </button>
        </div>
        <div style={{ fontSize: 17, color: '#94A3B8' }}>No ACN data available for this aircraft.</div>
      </div>
    )
  }

  const acnKey = `${weightMode}_${pavementType === 'rigid' ? 'rigid' : 'flex'}_${subgrade}` as keyof typeof acn
  const acnValue = parseFloat(String(acn[acnKey] || '0'))
  const pcn = parseFloat(pcnValue) || 0
  const hasComparison = pcnValue.length > 0 && pcn > 0

  let resultColor = '#94A3B8'
  let resultText = 'Enter your airfield PCN to compare'
  if (hasComparison) {
    if (acnValue <= pcn) {
      resultColor = '#34D399'
      resultText = `PASS — ACN ${acnValue.toFixed(1)} ≤ PCN ${pcn}`
    } else {
      resultColor = '#EF4444'
      resultText = `EXCEEDS — ACN ${acnValue.toFixed(1)} > PCN ${pcn}`
    }
  }

  const acnWeight = weightMode === 'max' ? acn.max_wt : acn.min_wt

  return (
    <div style={{ padding: 16, background: 'rgba(4,7,12,0.6)', borderRadius: 10, border: '1px solid rgba(56,189,248,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>ACN/PCN Comparison</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X size={16} color="#64748B" />
        </button>
      </div>

      {/* Weight Mode Toggle */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 15, color: '#64748B', marginBottom: 4, fontWeight: 600 }}>WEIGHT CONDITION</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['max', 'min'] as const).map(m => (
            <button
              key={m}
              onClick={() => setWeightMode(m)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 6,
                border: weightMode === m ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(148,163,184,0.15)',
                background: weightMode === m ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: weightMode === m ? '#38BDF8' : '#94A3B8',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {m === 'max' ? 'Max Weight' : 'Min Weight'}
              {acnWeight ? ` (${parseFloat(acnWeight).toLocaleString()}k)` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Pavement Type */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 15, color: '#64748B', marginBottom: 4, fontWeight: 600 }}>PAVEMENT TYPE</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['rigid', 'flexible'] as const).map(t => (
            <button
              key={t}
              onClick={() => setPavementType(t)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 6,
                border: pavementType === t ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(148,163,184,0.15)',
                background: pavementType === t ? 'rgba(56,189,248,0.1)' : 'transparent',
                color: pavementType === t ? '#38BDF8' : '#94A3B8',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t === 'rigid' ? 'Rigid (K)' : 'Flexible (CBR)'}
            </button>
          ))}
        </div>
      </div>

      {/* Subgrade */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 15, color: '#64748B', marginBottom: 4, fontWeight: 600 }}>
          SUBGRADE STRENGTH
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['A', 'B', 'C', 'D'] as const).map(s => {
            const labels = pavementType === 'rigid'
              ? { A: 'High (K=500)', B: 'Med (K=300)', C: 'Low (K=150)', D: 'Ultra-Low (K=75)' }
              : { A: 'High (CBR=15)', B: 'Med (CBR=10)', C: 'Low (CBR=6)', D: 'Ultra-Low (CBR=3)' }
            return (
              <button
                key={s}
                onClick={() => setSubgrade(s)}
                style={{
                  flex: 1,
                  padding: '6px 2px',
                  borderRadius: 6,
                  border: subgrade === s ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(148,163,184,0.15)',
                  background: subgrade === s ? 'rgba(56,189,248,0.1)' : 'transparent',
                  color: subgrade === s ? '#38BDF8' : '#94A3B8',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  lineHeight: 1.2,
                }}
              >
                {labels[s]}
              </button>
            )
          })}
        </div>
      </div>

      {/* PCN Input */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, color: '#64748B', marginBottom: 4, fontWeight: 600 }}>YOUR AIRFIELD PCN</div>
        <input
          type="number"
          value={pcnValue}
          onChange={e => setPcnValue(e.target.value)}
          placeholder="Enter PCN value..."
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid rgba(148,163,184,0.15)',
            background: 'rgba(15,23,42,0.6)',
            color: '#F1F5F9',
            fontSize: 18,
            outline: 'none',
          }}
        />
      </div>

      {/* ACN Result */}
      <div style={{
        padding: '10px 12px',
        borderRadius: 8,
        background: hasComparison
          ? acnValue <= pcn ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)'
          : 'rgba(148,163,184,0.05)',
        border: `1px solid ${hasComparison ? (acnValue <= pcn ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(148,163,184,0.1)'}`,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: resultColor, marginBottom: 2 }}>
          {resultText}
        </div>
        <div style={{ fontSize: 15, color: '#64748B' }}>
          ACN = {acnValue.toFixed(1)} ({weightMode} wt, {pavementType}, subgrade {subgrade})
        </div>
      </div>

      {/* Full ACN Table */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 15, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>ALL ACN VALUES</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 15, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#64748B' }}>
                <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 600 }}>Cond.</th>
                <th style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 600 }}>A</th>
                <th style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 600 }}>B</th>
                <th style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 600 }}>C</th>
                <th style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 600 }}>D</th>
              </tr>
            </thead>
            <tbody>
              {['max', 'min'].map(w => (
                ['rigid', 'flex'].map(p => {
                  const label = `${w === 'max' ? 'Max' : 'Min'} ${p === 'rigid' ? 'Rigid' : 'Flex'}`
                  return (
                    <tr key={`${w}_${p}`} style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                      <td style={{ padding: '3px 4px', color: '#94A3B8', fontWeight: 600 }}>{label}</td>
                      {(['A', 'B', 'C', 'D'] as const).map(s => {
                        const k = `${w}_${p}_${s}` as keyof typeof acn
                        const v = acn[k]
                        const isSelected = weightMode === w && pavementType === (p === 'rigid' ? 'rigid' : 'flexible') && subgrade === s
                        return (
                          <td
                            key={s}
                            style={{
                              textAlign: 'center',
                              padding: '3px 4px',
                              color: isSelected ? '#38BDF8' : '#CBD5E1',
                              fontWeight: isSelected ? 700 : 400,
                              background: isSelected ? 'rgba(56,189,248,0.06)' : 'transparent',
                              borderRadius: 3,
                            }}
                          >
                            {v || '—'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Aircraft Detail Card ────────────────────────────────────

function AircraftDetailCard({
  ac,
  isFavorite,
  onToggleFavorite,
}: {
  ac: AircraftCharacteristics
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showAcn, setShowAcn] = useState(false)

  const isMilitary = ac.category === 'military'

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        border: isFavorite ? '1px solid rgba(250,204,21,0.2)' : undefined,
      }}
    >
      {/* Card Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          cursor: 'pointer',
        }}
      >
        {/* Category Badge */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: isMilitary ? 'rgba(139,92,246,0.1)' : 'rgba(56,189,248,0.1)',
            border: `1px solid ${isMilitary ? 'rgba(139,92,246,0.2)' : 'rgba(56,189,248,0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isMilitary
            ? <Shield size={16} color="#8B5CF6" />
            : <Plane size={16} color="#38BDF8" />
          }
        </div>

        {/* Name & Manufacturer */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#F1F5F9',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {ac.aircraft}
          </div>
          {ac.group_index && (
            <div style={{ fontSize: 15, color: '#64748B' }}>
              Group {ac.group_index}
            </div>
          )}
        </div>

        {/* Expand Arrow */}
        {expanded
          ? <ChevronUp size={16} color="#64748B" style={{ flexShrink: 0 }} />
          : <ChevronDown size={16} color="#64748B" style={{ flexShrink: 0 }} />
        }
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(148,163,184,0.06)',
          padding: '12px 14px',
        }}>
          {/* Manufacturer */}
          {ac.manufacturer && (
            <div style={{ fontSize: 16, color: '#94A3B8', marginBottom: 10 }}>
              {ac.manufacturer}
            </div>
          )}

          {/* Dimensions */}
          <div style={{
            display: 'flex',
            gap: 1,
            marginBottom: 14,
          }}>
            {[
              { label: 'Wingspan', value: fmtNum(ac.wing_span_ft, 'ft') },
              { label: 'Length', value: fmtNum(ac.length_ft, 'ft') },
              { label: 'Height', value: fmtNum(ac.height_ft, 'ft') },
            ].map(({ label, value }) => (
              <div key={label} style={{
                flex: 1,
                background: 'rgba(4,7,12,0.5)',
                padding: '5px 6px',
                borderRadius: 5,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, color: '#CBD5E1', fontWeight: 600 }}>{value}</div>
                <div style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Aircraft Image */}
          {ac.image_url && (
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: 8,
                overflow: 'hidden',
                marginBottom: 14,
                background: 'rgba(4,7,12,0.5)',
              }}
            >
              <Image
                src={ac.image_url}
                alt={ac.aircraft}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                style={{ objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '7px 0',
                borderRadius: 6,
                border: isFavorite ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(148,163,184,0.15)',
                background: isFavorite ? 'rgba(250,204,21,0.08)' : 'transparent',
                color: isFavorite ? '#FACC15' : '#94A3B8',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Star size={13} fill={isFavorite ? '#FACC15' : 'none'} />
              {isFavorite ? 'Pinned' : 'Pin'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowAcn(!showAcn) }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '7px 0',
                borderRadius: 6,
                border: showAcn ? '1px solid rgba(34,211,153,0.3)' : '1px solid rgba(148,163,184,0.15)',
                background: showAcn ? 'rgba(34,211,153,0.08)' : 'transparent',
                color: showAcn ? '#34D399' : '#94A3B8',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Layers size={13} />
              ACN/PCN
            </button>
          </div>

          {/* ACN/PCN Panel */}
          {showAcn && (
            <div style={{ marginBottom: 14 }}>
              <AcnPcnPanel aircraft={ac} onClose={() => setShowAcn(false)} />
            </div>
          )}

          {/* Turn Data */}
          <DetailSection title="Turn Data">
            <DetailGrid items={[
              { label: 'Pivot Point', value: fmtNum(ac.pivot_point_ft, 'ft') },
              { label: 'Turn Radius', value: fmtNum(ac.turn_radius_ft, 'ft') },
              { label: '180° Diameter', value: fmtNum(ac.turn_diameter_180_ft, 'ft') },
              { label: 'Controlling Gear', value: ac.controlling_gear || '—' },
            ]} />
          </DetailSection>

          {/* Weights */}
          <DetailSection title="Weights">
            <DetailGrid items={[
              { label: 'Empty Weight', value: fmtWeight(ac.basic_empty_wt_klbs) },
              ...(isMilitary ? [{ label: 'Mission T/O', value: fmtWeight(ac.basic_mission_to_wt_klbs) }] : []),
              { label: 'Max Takeoff', value: fmtWeight(ac.max_to_wt_klbs) },
              ...(isMilitary ? [{ label: 'Mission Landing', value: fmtWeight(ac.basic_mission_ldg_wt_klbs) }] : []),
              { label: 'Max Landing', value: fmtWeight(ac.max_ldg_wt_klbs) },
            ]} />
          </DetailSection>

          {/* Performance (military only) */}
          {isMilitary && (ac.to_dist || ac.ldg_dist) && (
            <DetailSection title="Performance">
              <DetailGrid items={[
                { label: 'Takeoff Distance', value: ac.to_dist ? `${ac.to_dist} ft` : '—' },
                { label: 'Landing Distance', value: ac.ldg_dist ? `${ac.ldg_dist} ft` : '—' },
              ]} />
            </DetailSection>
          )}

          {/* Landing Gear */}
          <DetailSection title="Landing Gear">
            {ac.gear_config && (
              <div style={{
                fontSize: 15,
                color: '#94A3B8',
                marginBottom: 8,
                padding: '6px 8px',
                background: 'rgba(4,7,12,0.4)',
                borderRadius: 5,
                lineHeight: 1.5,
              }}>
                {ac.gear_config}
              </div>
            )}
            <DetailGrid items={[
              { label: 'Nose Config', value: ac.nose_assemblies_tires || '—' },
              { label: 'Main Config', value: ac.main_assemblies_tires || '—' },
            ]} />

            {/* Main Gear Detail */}
            {ac.main_pct_gross_load && (
              <>
                <div style={{ fontSize: 15, color: '#64748B', fontWeight: 600, margin: '8px 0 4px', letterSpacing: '0.05em' }}>
                  MAIN GEAR
                </div>
                <DetailGrid items={[
                  { label: '% Gross Load', value: `${ac.main_pct_gross_load}%` },
                  { label: 'Max Assembly Load', value: fmtWeight(ac.main_max_assembly_load_klbs) },
                  { label: 'Max Wheel Load', value: fmtWeight(ac.main_max_single_wheel_load_klbs) },
                  { label: 'Contact Pressure', value: fmtNum(ac.main_contact_pressure_psi, 'PSI') },
                  { label: 'Contact Area', value: fmtNum(ac.main_contact_area_sqin, 'sq in') },
                  { label: 'Footprint Width', value: fmtNum(ac.main_footprint_width_in, 'in') },
                ]} />
              </>
            )}

            {/* Nose Gear Detail */}
            {ac.nose_pct_gross_load && (
              <>
                <div style={{ fontSize: 15, color: '#64748B', fontWeight: 600, margin: '8px 0 4px', letterSpacing: '0.05em' }}>
                  NOSE GEAR
                </div>
                <DetailGrid items={[
                  { label: '% Gross Load', value: `${ac.nose_pct_gross_load}%` },
                  { label: 'Max Assembly Load', value: fmtWeight(ac.nose_max_assembly_load_klbs) },
                  { label: 'Max Wheel Load', value: fmtWeight(ac.nose_max_single_wheel_load_klbs) },
                  { label: 'Contact Pressure', value: fmtNum(ac.nose_contact_pressure_psi, 'PSI') },
                  { label: 'Contact Area', value: fmtNum(ac.nose_contact_area_sqin, 'sq in') },
                  { label: 'Footprint Width', value: fmtNum(ac.nose_footprint_width_in, 'in') },
                ]} />
              </>
            )}
          </DetailSection>

        </div>
      )}
    </div>
  )
}

// ─── Detail Sub-components ──────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 15,
        color: '#38BDF8',
        fontWeight: 700,
        letterSpacing: '0.08em',
        marginBottom: 6,
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function DetailGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
      {items.map(({ label, value }) => (
        <div key={label} style={{
          padding: '5px 8px',
          background: 'rgba(4,7,12,0.4)',
          borderRadius: 5,
        }}>
          <div style={{ fontSize: 14, color: '#CBD5E1', fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────

export default function AircraftPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | 'military' | 'commercial'>('all')
  const [sortField, setSortField] = useState<AircraftSortField>('name')
  const [sortDesc, setSortDesc] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [favorites, setFavoritesState] = useState<Set<string>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Load favorites from localStorage on mount
  useEffect(() => {
    setFavoritesState(getFavorites())
  }, [])

  const toggleFavorite = useCallback((name: string) => {
    setFavoritesState(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      setFavorites(next)
      return next
    })
  }, [])

  // Filter and sort
  const filtered = useMemo(() => {
    let list = allAircraft

    // Category filter
    if (category !== 'all') {
      list = list.filter(a => a.category === category)
    }

    // Favorites filter
    if (showFavoritesOnly) {
      list = list.filter(a => favorites.has(a.aircraft))
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(a =>
        a.aircraft.toLowerCase().includes(q) ||
        (a.manufacturer && a.manufacturer.toLowerCase().includes(q)) ||
        (a.gear_config && a.gear_config.toLowerCase().includes(q))
      )
    }

    // Sort
    list = sortAircraft(list, sortField, sortDesc)

    // Pin favorites to top (unless viewing favorites only)
    if (!showFavoritesOnly && favorites.size > 0) {
      const pinned = list.filter(a => favorites.has(a.aircraft))
      const rest = list.filter(a => !favorites.has(a.aircraft))
      list = [...pinned, ...rest]
    }

    return list
  }, [search, category, sortField, sortDesc, favorites, showFavoritesOnly])

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>Aircraft Database</div>
          <div style={{ fontSize: 15, color: '#64748B' }}>
            {AIRCRAFT_COUNT.total} aircraft &bull; {AIRCRAFT_COUNT.military} military &bull; {AIRCRAFT_COUNT.commercial} commercial
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {favorites.size > 0 && (
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              style={{
                background: showFavoritesOnly ? 'rgba(250,204,21,0.1)' : 'none',
                border: showFavoritesOnly ? '1px solid rgba(250,204,21,0.3)' : '1px solid rgba(148,163,184,0.15)',
                borderRadius: 8,
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Star size={14} color={showFavoritesOnly ? '#FACC15' : '#64748B'} fill={showFavoritesOnly ? '#FACC15' : 'none'} />
              <span style={{ fontSize: 15, color: showFavoritesOnly ? '#FACC15' : '#64748B', fontWeight: 600 }}>
                {favorites.size}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              background: showFilters ? 'rgba(56,189,248,0.1)' : 'none',
              border: showFilters ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.15)',
              borderRadius: 8,
              padding: '6px 8px',
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} color={showFilters ? '#38BDF8' : '#64748B'} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(15,23,42,0.6)',
        borderRadius: 10,
        padding: '8px 12px',
        border: '1px solid rgba(148,163,184,0.1)',
        marginBottom: 10,
      }}>
        <Search size={16} color="#64748B" />
        <input
          type="text"
          placeholder="Search aircraft, manufacturer, gear type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#F1F5F9',
            fontSize: 18,
            outline: 'none',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
          >
            <X size={14} color="#64748B" />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[
          { key: 'all' as const, label: 'All', count: AIRCRAFT_COUNT.total },
          { key: 'military' as const, label: 'Military', count: AIRCRAFT_COUNT.military },
          { key: 'commercial' as const, label: 'Commercial', count: AIRCRAFT_COUNT.commercial },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: 8,
              border: category === key ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.1)',
              background: category === key ? 'rgba(56,189,248,0.08)' : 'transparent',
              color: category === key ? '#38BDF8' : '#94A3B8',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Sort & Filter Panel */}
      {showFilters && (
        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 15, color: '#64748B', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>
            SORT BY
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  if (sortField === value) {
                    setSortDesc(!sortDesc)
                  } else {
                    setSortField(value)
                    setSortDesc(false)
                  }
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: sortField === value ? '1px solid rgba(56,189,248,0.3)' : '1px solid rgba(148,163,184,0.1)',
                  background: sortField === value ? 'rgba(56,189,248,0.08)' : 'transparent',
                  color: sortField === value ? '#38BDF8' : '#94A3B8',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {label}
                {sortField === value && (
                  <ArrowUpDown size={10} style={{ transform: sortDesc ? 'scaleY(-1)' : undefined }} />
                )}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 15, color: '#64748B' }}>
            Tap active sort to reverse direction. Pinned aircraft always appear first.
          </div>
        </div>
      )}

      {/* Results Count */}
      <div style={{ fontSize: 16, color: '#64748B', marginBottom: 8 }}>
        {showFavoritesOnly ? `${filtered.length} pinned aircraft` : `${filtered.length} aircraft`}
        {search && ` matching "${search}"`}
      </div>

      {/* Aircraft List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <Search size={24} color="#334155" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: 18, color: '#94A3B8', fontWeight: 600 }}>No aircraft found</div>
            <div style={{ fontSize: 16, color: '#64748B', marginTop: 4 }}>
              {showFavoritesOnly
                ? 'No pinned aircraft match your filters.'
                : 'Try a different search term or category.'}
            </div>
          </div>
        )}

        {filtered.map((ac) => (
          <AircraftDetailCard
            key={ac.aircraft}
            ac={ac}
            isFavorite={favorites.has(ac.aircraft)}
            onToggleFavorite={() => toggleFavorite(ac.aircraft)}
          />
        ))}
      </div>
    </div>
  )
}
