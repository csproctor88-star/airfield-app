'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Plus, Search, SlidersHorizontal, X, Image as ImageIcon,
} from 'lucide-react'
import { CHECK_TYPE_CONFIG } from '@/lib/constants'
import { getCheckIcon } from '@/lib/check-icons'
import { DEMO_CHECKS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { fetchChecks, type CheckRow } from '@/lib/supabase/checks'
import { useInstallation } from '@/lib/installation-context'
import { formatZuluDateShort, formatZuluTime } from '@/lib/utils'

export default function CheckHistoryPage() {
  const { installationId } = useInstallation()
  const [liveChecks, setLiveChecks] = useState<CheckRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      if (!supabase) {
        setUsingDemo(true)
        setLoading(false)
        return
      }
      const { data, error } = await fetchChecks(installationId)
      if (error) {
        toast.error(`DB error: ${error}`)
        setUsingDemo(true)
      } else {
        setLiveChecks(data)
      }
      setLoading(false)
    }
    load()
  }, [installationId])

  const checks = usingDemo ? DEMO_CHECKS : liveChecks

  // Filter
  const filtered = useMemo(() => checks.filter((c) => {
    if (typeFilter !== 'all' && c.check_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const typeLabel = CHECK_TYPE_CONFIG[c.check_type as keyof typeof CHECK_TYPE_CONFIG]?.label || c.check_type
      const areas = (c.areas || []).join(' ')
      const data = (c.data as Record<string, unknown>) || {}
      // Other-check Subject is the main differentiator between Other rows
      // — pull it into the search corpus alongside areas/type/by.
      const otherSubject = typeof data.other_subject === 'string' ? data.other_subject : ''
      const searchable = `${c.display_id} ${typeLabel} ${c.completed_by || ''} ${areas} ${otherSubject}`.toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  }), [checks, typeFilter, search])

  // Count by type
  const typeCounts = useMemo(() => Object.keys(CHECK_TYPE_CONFIG).reduce((acc, key) => {
    acc[key] = checks.filter((c) => c.check_type === key).length
    return acc
  }, {} as Record<string, number>), [checks])

  const hasFilter = typeFilter !== 'all' || search.trim().length > 0
  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0)
  const clearAll = () => { setTypeFilter('all'); setSearch('') }

  return (
    <div className="page-container">
      {/* Page header — tertiary "CHECK HISTORY" + accent underline +
          Lucide cyan + New action right. */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
        paddingBottom: 8, marginBottom: 12,
        borderBottom: '1px solid rgba(56,189,248,0.20)',
      }}>
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700,
          color: 'var(--color-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Check History · {checks.length}
        </div>
        <Link
          href="/checks"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(56,189,248,0.40)',
            background: 'rgba(56,189,248,0.10)',
            color: 'var(--color-accent)',
            fontSize: 'var(--fs-xs)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            textDecoration: 'none', fontFamily: 'inherit',
          }}
        >
          <Plus size={14} />
          New
        </Link>
      </div>

      {/* Search + Filters cluster — mirrors /discrepancies + /ppr. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} color="var(--color-text-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search checks: ID, type, area, who…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px 8px 30px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)', color: 'var(--color-text-1)',
              fontSize: 'var(--fs-sm)', fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => setFiltersOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${filtersOpen || activeFilterCount > 0 ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: filtersOpen ? 'rgba(56,189,248,0.08)' : 'var(--color-bg-surface)',
            color: filtersOpen || activeFilterCount > 0 ? 'var(--color-accent)' : 'var(--color-text-2)',
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 'var(--fs-xs)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span style={{
              minWidth: 18, padding: '0 5px', borderRadius: 9, lineHeight: '18px',
              background: 'var(--color-accent)', color: 'var(--color-bg)',
              fontSize: 'var(--fs-2xs)', fontWeight: 800, textAlign: 'center',
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {filtersOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30,
            minWidth: 320, padding: 12, borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div>
              <div style={{
                fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Check Type
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <FilterChip
                  active={typeFilter === 'all'}
                  label={`All (${checks.length})`}
                  color="var(--color-accent)"
                  onClick={() => setTypeFilter('all')}
                />
                {Object.entries(CHECK_TYPE_CONFIG).map(([key, cfg]) => {
                  const Icon = getCheckIcon(cfg.icon)
                  return (
                    <FilterChip
                      key={key}
                      active={typeFilter === key}
                      label={`${cfg.label} (${typeCounts[key] || 0})`}
                      color={cfg.color}
                      icon={<Icon size={14} />}
                      onClick={() => setTypeFilter(typeFilter === key ? 'all' : key)}
                    />
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={clearAll}
                disabled={!hasFilter}
                style={{
                  background: 'none', border: 'none',
                  color: hasFilter ? 'var(--color-accent)' : 'var(--color-text-3)',
                  fontSize: 'var(--fs-xs)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  cursor: hasFilter ? 'pointer' : 'default', padding: 0,
                }}
              >
                Clear all
              </button>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                {filtered.length} shown
              </span>
            </div>
          </div>
        )}
      </div>

      {hasFilter && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
          {search.trim() && (
            <ActiveChip label={`"${search.trim()}"`} onClear={() => setSearch('')} />
          )}
          {typeFilter !== 'all' && (
            <ActiveChip
              label={`Type: ${CHECK_TYPE_CONFIG[typeFilter as keyof typeof CHECK_TYPE_CONFIG]?.label || typeFilter}`}
              onClear={() => setTypeFilter('all')}
            />
          )}
          <button
            onClick={clearAll}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--color-accent)', cursor: 'pointer',
              fontSize: 'var(--fs-xs)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card weather-skeleton" style={{ height: 84, borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', margin: '0 0 12px' }}>
            {hasFilter ? 'No checks match the current filters.' : 'No checks completed yet.'}
          </p>
          <div style={{ display: 'inline-flex', gap: 8, justifyContent: 'center' }}>
            {hasFilter && (
              <button
                onClick={clearAll}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-surface)', color: 'var(--color-text-2)',
                  cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  fontFamily: 'inherit',
                }}
              >
                Clear all filters
              </button>
            )}
            <Link
              href="/checks"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(56,189,248,0.40)',
                background: 'rgba(56,189,248,0.10)', color: 'var(--color-accent)',
                cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                fontFamily: 'inherit', textDecoration: 'none',
              }}
            >
              <Plus size={14} />
              New Check
            </Link>
          </div>
        </div>
      )}

      {!loading && filtered.map((check) => {
        const cfg = CHECK_TYPE_CONFIG[check.check_type as keyof typeof CHECK_TYPE_CONFIG]
        const Icon = cfg ? getCheckIcon(cfg.icon) : null
        const data = check.data as Record<string, unknown>

        // Build a summary line based on check type
        let summary = ''
        if (check.check_type === 'rcr' && data.rcr_value) summary = `RCR: ${data.rcr_value} — ${data.condition_type || 'N/A'}`
        else if (check.check_type === 'rsc' && data.condition) summary = data.rcr_reported ? `${data.condition} | RWY RCR: ${data.rcr_value}${data.rcr_condition ? ` — ${data.rcr_condition}` : ''}` : `Condition: ${data.condition}`
        else if (check.check_type === 'bash' && data.condition_code) summary = `${data.condition_code}${data.species_observed ? ` — ${(data.species_observed as string).slice(0, 50)}` : ''}`
        else if ((check.check_type === 'ife' || check.check_type === 'ground_emergency') && data.nature) summary = `${data.aircraft_type || ''} ${data.callsign || ''} — ${data.nature}`.trim()
        else if (check.check_type === 'heavy_aircraft' && data.aircraft_type) summary = data.aircraft_type as string
        else if (check.check_type === 'other' && data.other_subject) summary = data.other_subject as string
        else if (check.check_type === 'construction') {
          // Pull the P/F/N/A counts for an at-a-glance summary.
          const items = (data.construction_items as Record<string, string>) || {}
          const counts = { P: 0, F: 0, NA: 0 }
          for (const v of Object.values(items)) {
            if (v === 'P') counts.P++
            else if (v === 'F') counts.F++
            else if (v === 'N/A') counts.NA++
          }
          summary = `${counts.P} Pass · ${counts.F} Fail · ${counts.NA} N/A`
        }

        return (
          <Link
            key={check.id}
            href={`/checks/${check.id}`}
            className="card"
            style={{
              display: 'block', marginBottom: 6, cursor: 'pointer',
              textDecoration: 'none', color: 'inherit',
              borderLeft: `3px solid ${cfg?.color || 'var(--color-text-3)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-accent)' }}>
                {check.display_id}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 'var(--fs-2xs)', fontWeight: 700,
                color: cfg?.color || 'var(--color-text-3)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {Icon && <Icon size={12} />}
                {cfg?.label || check.check_type}
              </span>
            </div>

            {summary && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 6, lineHeight: 1.45 }}>
                {summary}
              </div>
            )}

            {(check.areas || []).length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                {(check.areas || []).map((area: string) => (
                  <span key={area} style={{
                    fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)',
                    background: 'var(--color-bg-elevated)',
                    padding: '2px 6px', borderRadius: 4,
                    textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600,
                  }}>
                    {area}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{check.completed_by || 'Unknown'}</span>
                {check.photo_count > 0 && (
                  <>
                    <span>&bull;</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <ImageIcon size={11} />
                      {check.photo_count}
                    </span>
                  </>
                )}
              </div>
              <span>
                {check.completed_at
                  ? formatZuluDateShort(new Date(check.completed_at)) + ' ' + formatZuluTime(new Date(check.completed_at)) + 'Z'
                  : 'N/A'}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function FilterChip({
  active, label, color, icon, onClick,
}: {
  active: boolean
  label: string
  color: string
  icon?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        border: active ? `2px solid ${color}` : '1px solid var(--color-border)',
        borderLeft: `3px solid ${color}`,
        background: active ? `color-mix(in srgb, ${color} 10%, transparent)` : 'var(--color-bg)',
        color: active ? color : 'var(--color-text-2)',
        cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 'var(--fs-xs)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        textAlign: 'left', width: '100%',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 4px 3px 10px', borderRadius: 999,
      background: 'rgba(56,189,248,0.10)',
      border: '1px solid rgba(56,189,248,0.40)',
      color: 'var(--color-accent)',
      fontSize: 'var(--fs-2xs)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: 8,
          background: 'transparent', border: 'none', color: 'inherit',
          cursor: 'pointer', padding: 0,
        }}
      >
        <X size={11} />
      </button>
    </span>
  )
}
