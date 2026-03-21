'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { WILDLIFE_SPECIES, type WildlifeSpecies, resolveWildlifeImage } from '@/lib/wildlife-species-data'

type Props = {
  onSelect: (species: WildlifeSpecies) => void
  onClose: () => void
  allowedSpecies?: Set<string> | null
  favoriteSpecies?: Set<string> | null
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

export function SpeciesPicker({ onSelect, onClose, allowedSpecies, favoriteSpecies }: Props) {
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const hasFavorites = favoriteSpecies && favoriteSpecies.size > 0

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const sourceList = useMemo(() => {
    if (allowedSpecies && allowedSpecies.size > 0) {
      return WILDLIFE_SPECIES.filter(s => allowedSpecies.has(s.common_name))
    }
    return WILDLIFE_SPECIES
  }, [allowedSpecies])

  const filtered = useMemo(() => {
    let list = sourceList
    if (showFavoritesOnly && hasFavorites) {
      list = list.filter(s => favoriteSpecies!.has(s.common_name))
    }
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
    // Sort: favorites first (if not in favorites-only mode), then risk, size, alpha
    return [...list].sort((a, b) => {
      if (hasFavorites && !showFavoritesOnly) {
        const aFav = favoriteSpecies!.has(a.common_name) ? 0 : 1
        const bFav = favoriteSpecies!.has(b.common_name) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav
      }
      const riskDiff = RISK_ORDER[a.strike_risk] - RISK_ORDER[b.strike_risk]
      if (riskDiff !== 0) return riskDiff
      const sizeDiff = SIZE_ORDER[a.size_category] - SIZE_ORDER[b.size_category]
      if (sizeDiff !== 0) return sizeDiff
      return a.common_name.localeCompare(b.common_name)
    })
  }, [search, activeGroup, sourceList, showFavoritesOnly, hasFavorites, favoriteSpecies])

  const favCount = hasFavorites
    ? sourceList.filter(s => favoriteSpecies!.has(s.common_name)).length
    : 0

  const groupCounts = useMemo(() => {
    const base = showFavoritesOnly && hasFavorites
      ? sourceList.filter(s => favoriteSpecies!.has(s.common_name))
      : sourceList
    const counts: Record<string, number> = { all: base.length }
    for (const sp of base) {
      counts[sp.group] = (counts[sp.group] || 0) + 1
    }
    return counts
  }, [sourceList, showFavoritesOnly, hasFavorites, favoriteSpecies])

  const riskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'var(--color-red)'
      case 'high': return '#F97316'
      case 'medium': return 'var(--color-amber)'
      default: return 'var(--color-green)'
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
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
        background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)',
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
                flex: '1 1 200px', minWidth: 0, padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface)', color: 'var(--color-text)',
                fontSize: 'var(--fs-base)',
              }}
            />
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0 }}>
              {hasFavorites && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--fs-sm)', fontWeight: 700, whiteSpace: 'nowrap',
                    background: showFavoritesOnly ? 'var(--color-amber)' : 'var(--color-bg-surface)',
                    color: showFavoritesOnly ? '#000' : 'var(--color-amber)',
                  }}
                >
                  ★ Favorites ({favCount})
                </button>
              )}
              {GROUPS.map(g => (
                <button
                  key={g.key}
                  onClick={() => setActiveGroup(g.key)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
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
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-red)', display: 'inline-block' }} /> Critical
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} /> High
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-amber)', display: 'inline-block' }} /> Med
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-green)', display: 'inline-block' }} /> Low
              </span>
            </div>
          </div>
        </div>

        {/* Species grid */}
        <div className="species-grid" style={{
          flex: 1, overflowY: 'auto', padding: '0 12px 16px',
        }}>
          {filtered.map((sp, idx) => {
            const isFav = hasFavorites && favoriteSpecies!.has(sp.common_name)
            // Insert a separator between favorites and non-favorites
            const prevFav = idx > 0 && hasFavorites && !showFavoritesOnly && favoriteSpecies!.has(filtered[idx - 1].common_name)
            const showSeparator = !showFavoritesOnly && hasFavorites && prevFav && !isFav

            return (
              <>{showSeparator && (
                <div key="__sep" style={{
                  gridColumn: '1 / -1', borderTop: '1px solid var(--color-border)',
                  margin: '4px 0', paddingTop: 6,
                  fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  All Species
                </div>
              )}
              <button
                key={sp.common_name}
                className="species-card"
                onClick={() => onSelect(sp)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: 6, borderRadius: 'var(--radius-md)',
                  border: isFav ? '1.5px solid var(--color-amber)' : '1px solid var(--color-border)',
                  background: 'var(--color-bg-surface)', cursor: 'pointer',
                  textAlign: 'center', color: 'var(--color-text)',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{
                  width: '100%', aspectRatio: '4/3', borderRadius: 'var(--radius-md)', overflow: 'hidden',
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
                  {/* Favorite star */}
                  {isFav && (
                    <div style={{
                      position: 'absolute', top: 2, left: 3,
                      fontSize: 12, color: 'var(--color-amber)', lineHeight: 1,
                    }}>★</div>
                  )}
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
              </>
            )
          })}
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
