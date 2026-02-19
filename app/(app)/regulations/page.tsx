'use client'

import { useState, useMemo } from 'react'
import { Search, ExternalLink, ChevronDown, ChevronUp, X, FileText } from 'lucide-react'
import { ALL_REGULATIONS, type RegulationEntry } from '@/lib/regulations-data'
import { REGULATION_CATEGORIES, REGULATION_PUB_TYPES, REGULATION_SOURCE_SECTIONS } from '@/lib/constants'

// --- Badge color by entry type ---
function entryTypeBadge(entry: RegulationEntry): { label: string; bg: string; color: string } {
  if (entry.is_core) return { label: 'CORE', bg: 'rgba(52,211,153,0.15)', color: '#34D399' }
  if (entry.is_scrubbed) return { label: 'SCRUBBED', bg: 'rgba(165,180,252,0.15)', color: '#A5B4FC' }
  if (entry.is_cross_ref) return { label: 'CROSS-REF', bg: 'rgba(253,230,138,0.15)', color: '#FDE68A' }
  return { label: 'DIRECT', bg: 'rgba(241,245,249,0.10)', color: '#CBD5E1' }
}

// --- Get category config ---
function getCategoryConfig(categoryValue: string) {
  return REGULATION_CATEGORIES.find(c => c.value === categoryValue)
}

// --- Get pub type label ---
function getPubTypeLabel(pubType: string) {
  return REGULATION_PUB_TYPES.find(p => p.value === pubType)?.label ?? pubType
}

// --- Get source section label ---
function getSectionLabel(section: string) {
  return REGULATION_SOURCE_SECTIONS.find(s => s.value === section)?.label ?? section
}

export default function RegulationsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [pubTypeFilter, setPubTypeFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Derive counts
  const coreCount = ALL_REGULATIONS.filter(r => r.is_core).length
  const directCount = ALL_REGULATIONS.filter(r => !r.is_core && !r.is_cross_ref && !r.is_scrubbed).length
  const crossRefCount = ALL_REGULATIONS.filter(r => r.is_cross_ref).length
  const scrubbedCount = ALL_REGULATIONS.filter(r => r.is_scrubbed).length

  // Filter & search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return ALL_REGULATIONS.filter(r => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      if (pubTypeFilter !== 'all' && r.pub_type !== pubTypeFilter) return false
      if (sourceFilter !== 'all' && r.source_section !== sourceFilter) return false
      if (!q) return true
      return (
        r.reg_id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      )
    })
  }, [search, categoryFilter, pubTypeFilter, sourceFilter])

  const hasActiveFilters = categoryFilter !== 'all' || pubTypeFilter !== 'all' || sourceFilter !== 'all'

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Regulations</div>
        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>
          {ALL_REGULATIONS.length} total
        </div>
      </div>

      {/* KPI badges row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'CORE', value: coreCount, color: '#34D399' },
          { label: 'DIRECT', value: directCount, color: '#CBD5E1' },
          { label: 'CROSS-REF', value: crossRefCount, color: '#FDE68A' },
          { label: 'SCRUBBED', value: scrubbedCount, color: '#A5B4FC' },
        ].map(k => (
          <div
            key={k.label}
            style={{
              background: 'rgba(10,16,28,0.92)',
              border: '1px solid rgba(56,189,248,0.06)',
              borderRadius: 10,
              padding: '8px 4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 8, color: '#64748B', letterSpacing: '0.08em', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search
          size={14}
          color="#64748B"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          placeholder="Search regulations, titles, tags..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 32px',
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid #1E293B',
            borderRadius: 8,
            color: '#E2E8F0',
            fontSize: 12,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            }}
          >
            <X size={14} color="#64748B" />
          </button>
        )}
      </div>

      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: hasActiveFilters ? 'rgba(34,211,238,0.08)' : 'transparent',
          border: `1px solid ${hasActiveFilters ? 'rgba(34,211,238,0.25)' : 'rgba(56,189,248,0.06)'}`,
          borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
          color: hasActiveFilters ? '#22D3EE' : '#64748B',
          fontSize: 10, fontWeight: 700, fontFamily: 'inherit', marginBottom: 8,
        }}
      >
        {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Filters {hasActiveFilters && `(active)`}
        {hasActiveFilters && (
          <span
            onClick={e => { e.stopPropagation(); setCategoryFilter('all'); setPubTypeFilter('all'); setSourceFilter('all') }}
            style={{ marginLeft: 4, color: '#EF4444', cursor: 'pointer' }}
          >
            Clear
          </span>
        )}
      </button>

      {/* Filter dropdowns */}
      {showFilters && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 12,
          padding: 10, background: 'rgba(10,16,28,0.8)', borderRadius: 8,
          border: '1px solid rgba(56,189,248,0.06)',
        }}>
          {/* Category filter */}
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, letterSpacing: '0.06em' }}>CATEGORY</div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', background: 'rgba(15,23,42,0.8)',
                border: '1px solid #1E293B', borderRadius: 6, color: '#E2E8F0',
                fontSize: 11, fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="all">All Categories</option>
              {REGULATION_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {/* Pub type filter */}
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, letterSpacing: '0.06em' }}>PUB TYPE</div>
            <select
              value={pubTypeFilter}
              onChange={e => setPubTypeFilter(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', background: 'rgba(15,23,42,0.8)',
                border: '1px solid #1E293B', borderRadius: 6, color: '#E2E8F0',
                fontSize: 11, fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="all">All Types</option>
              {REGULATION_PUB_TYPES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {/* Source section filter */}
          <div>
            <div style={{ fontSize: 9, color: '#64748B', fontWeight: 600, marginBottom: 4, letterSpacing: '0.06em' }}>SOURCE SECTION</div>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', background: 'rgba(15,23,42,0.8)',
                border: '1px solid #1E293B', borderRadius: 6, color: '#E2E8F0',
                fontSize: 11, fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="all">All Sections</option>
              {REGULATION_SOURCE_SECTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <div style={{ fontSize: 10, color: '#64748B', marginBottom: 8, fontWeight: 600 }}>
        {filtered.length === ALL_REGULATIONS.length
          ? `Showing all ${filtered.length} regulations`
          : `${filtered.length} of ${ALL_REGULATIONS.length} regulations`
        }
      </div>

      {/* Regulation cards */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: '#64748B', fontSize: 12 }}>
          No regulations match your search.
        </div>
      ) : (
        filtered.map(reg => {
          const badge = entryTypeBadge(reg)
          const catConfig = getCategoryConfig(reg.category)
          const isExpanded = expandedId === reg.reg_id

          return (
            <div
              key={reg.reg_id}
              className="card"
              onClick={() => setExpandedId(isExpanded ? null : reg.reg_id)}
              style={{
                marginBottom: 8,
                padding: '10px 12px',
                cursor: 'pointer',
                border: isExpanded
                  ? '1px solid rgba(56,189,248,0.2)'
                  : '1px solid rgba(56,189,248,0.06)',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Top row: reg_id + badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#38BDF8', marginBottom: 2 }}>
                    {reg.reg_id}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.3 }}>
                    {reg.title}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                    background: badge.bg, color: badge.color,
                    padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                  }}>
                    {badge.label}
                  </div>
                </div>
              </div>

              {/* Category + pub type chips */}
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {catConfig && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, color: catConfig.color,
                    background: catConfig.color + '18', padding: '1px 6px', borderRadius: 3,
                  }}>
                    {catConfig.label}
                  </span>
                )}
                <span style={{
                  fontSize: 8, fontWeight: 600, color: '#94A3B8',
                  background: 'rgba(148,163,184,0.10)', padding: '1px 6px', borderRadius: 3,
                }}>
                  {reg.pub_type}
                </span>
                {reg.publication_date && (
                  <span style={{
                    fontSize: 8, fontWeight: 600, color: '#64748B',
                    padding: '1px 4px',
                  }}>
                    {reg.publication_date}
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ marginTop: 10, borderTop: '1px solid rgba(56,189,248,0.06)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6, marginBottom: 10 }}>
                    {reg.description}
                  </div>

                  {/* Metadata grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>SOURCE SECTION</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{getSectionLabel(reg.source_section)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>PUB TYPE</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{getPubTypeLabel(reg.pub_type)}</div>
                    </div>
                    {reg.source_volume && (
                      <div>
                        <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>SOURCE VOLUME</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{reg.source_volume}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em' }}>DATE</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{reg.publication_date ?? 'N/A'}</div>
                    </div>
                  </div>

                  {/* Tags */}
                  {reg.tags.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 8, color: '#64748B', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 4 }}>TAGS</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {reg.tags.map(tag => (
                          <span
                            key={tag}
                            onClick={e => { e.stopPropagation(); setSearch(tag) }}
                            style={{
                              fontSize: 9, color: '#94A3B8', background: 'rgba(148,163,184,0.08)',
                              padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                              border: '1px solid rgba(148,163,184,0.10)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {reg.url && (
                      <>
                        <a
                          href={reg.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: 'linear-gradient(135deg, #0369A1, #0EA5E9)',
                            color: '#fff', fontSize: 11, fontWeight: 700,
                            padding: '6px 14px', borderRadius: 6, textDecoration: 'none',
                            border: 'none',
                          }}
                        >
                          <FileText size={12} />
                          View in App
                        </a>
                        <a
                          href={reg.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: 'transparent',
                            border: '1px solid rgba(56,189,248,0.2)',
                            color: '#94A3B8', fontSize: 11, fontWeight: 700,
                            padding: '6px 14px', borderRadius: 6, textDecoration: 'none',
                          }}
                        >
                          <ExternalLink size={12} />
                          Open External
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

    </div>
  )
}
