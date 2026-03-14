'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { WILDLIFE_SPECIES, type WildlifeSpecies, resolveWildlifeImage } from '@/lib/wildlife-species-data'

type Props = {
  onSelect: (species: WildlifeSpecies) => void
  onClose: () => void
}

const GROUPS = [
  { key: 'all', label: 'All' },
  { key: 'bird', label: 'Birds' },
  { key: 'mammal', label: 'Mammals' },
  { key: 'reptile', label: 'Reptiles' },
  { key: 'bat', label: 'Bats' },
] as const

const SIZE_ORDER = { large: 0, medium: 1, small: 2 }
const RISK_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

export function SpeciesPicker({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    let list = WILDLIFE_SPECIES
    if (activeGroup !== 'all') {
      list = list.filter(s => s.group === activeGroup)
    }
    if (search.length > 0) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.common_name.toLowerCase().includes(q) ||
        s.scientific_name.toLowerCase().includes(q),
      )
    }
    // Sort: critical/high risk first, then by size (large→small), then alphabetical
    return [...list].sort((a, b) => {
      const riskDiff = RISK_ORDER[a.strike_risk] - RISK_ORDER[b.strike_risk]
      if (riskDiff !== 0) return riskDiff
      const sizeDiff = SIZE_ORDER[a.size_category] - SIZE_ORDER[b.size_category]
      if (sizeDiff !== 0) return sizeDiff
      return a.common_name.localeCompare(b.common_name)
    })
  }, [search, activeGroup])

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: WILDLIFE_SPECIES.length }
    for (const sp of WILDLIFE_SPECIES) {
      counts[sp.group] = (counts[sp.group] || 0) + 1
    }
    return counts
  }, [])

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return '#EF4444'
      case 'high': return '#F97316'
      case 'medium': return '#FBBF24'
      default: return '#10B981'
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 250, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {/* Responsive inline style tag for grid columns */}
      <style>{`
        .species-grid {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(3, 1fr);
          align-content: start;
        }
        @media (min-width: 600px) {
          .species-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (min-width: 800px) {
          .species-grid { grid-template-columns: repeat(5, 1fr); }
        }
        @media (min-width: 1000px) {
          .species-grid { grid-template-columns: repeat(6, 1fr); }
        }
        .species-card:hover {
          border-color: var(--color-cyan) !important;
        }
      `}</style>
      <div style={{
        width: '96vw', maxWidth: 960, height: '90vh', maxHeight: 800,
        background: 'var(--color-bg)', borderRadius: 16,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>Select Species</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--color-text-3)' }}>×</button>
          </div>

          {/* Search + Group tabs row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name or scientific name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: '1 1 200px', minWidth: 0, padding: '10px 12px', borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface)', color: 'var(--color-text)',
                fontSize: 'var(--fs-base)',
              }}
            />
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0 }}>
              {GROUPS.map(g => (
                <button
                  key={g.key}
                  onClick={() => setActiveGroup(g.key)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 'var(--fs-sm)', fontWeight: 700, whiteSpace: 'nowrap',
                    background: activeGroup === g.key ? 'var(--color-cyan)' : 'var(--color-bg-surface)',
                    color: activeGroup === g.key ? '#000' : 'var(--color-text-2)',
                  }}
                >
                  {g.label} ({groupCounts[g.key] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Results count + legend */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingBottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
          }}>
            <span>{filtered.length} species {search && `matching "${search}"`}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} /> Critical
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} /> High
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} /> Med
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /> Low
              </span>
            </div>
          </div>
        </div>

        {/* Species grid */}
        <div className="species-grid" style={{
          flex: 1, overflowY: 'auto', padding: '0 12px 16px',
        }}>
          {filtered.map(sp => (
            <button
              key={sp.common_name}
              className="species-card"
              onClick={() => onSelect(sp)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: 6, borderRadius: 10, border: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface)', cursor: 'pointer',
                textAlign: 'center', color: 'var(--color-text)',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{
                width: '100%', aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden',
                background: 'var(--color-bg)', marginBottom: 4, position: 'relative',
              }}>
                <img
                  src={resolveWildlifeImage(sp)!}
                  alt={sp.common_name}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => {
                    const img = e.target as HTMLImageElement
                    img.style.display = 'none'
                    const parent = img.parentElement
                    if (parent && !parent.querySelector('.fallback-icon')) {
                      const div = document.createElement('div')
                      div.className = 'fallback-icon'
                      div.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:28px;color:var(--color-text-4);'
                      div.textContent = sp.group === 'bird' ? '\uD83E\uDD85' : sp.group === 'mammal' ? '\uD83E\uDD8C' : sp.group === 'bat' ? '\uD83E\uDD87' : '\uD83E\uDD8E'
                      parent.appendChild(div)
                    }
                  }}
                />
                {/* Risk indicator dot */}
                <div style={{
                  position: 'absolute', top: 3, right: 3, width: 10, height: 10,
                  borderRadius: '50%', background: riskColor(sp.strike_risk),
                  border: '1.5px solid var(--color-bg-surface)',
                }} />
              </div>
              <div style={{
                fontWeight: 700, fontSize: 'var(--fs-xs)', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                minHeight: '2.4em', width: '100%',
              }}>
                {sp.common_name}
              </div>
              <div style={{
                fontSize: '9px', color: 'var(--color-text-4)', fontStyle: 'italic',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                width: '100%',
              }}>
                {sp.scientific_name}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>
              No species found matching &quot;{search}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
