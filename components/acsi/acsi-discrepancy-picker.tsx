'use client'

import { useState, useEffect, useMemo } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancies, fetchDiscrepancyPhotos } from '@/lib/supabase/discrepancies'
import type { DiscrepancyRow } from '@/lib/supabase/discrepancies'
import type { AcsiDiscrepancyDetail } from '@/lib/supabase/types'
import { X, Search, Link2, Check, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { STATUS_CONFIG, DISCREPANCY_TYPES } from '@/lib/constants'
import { toast } from 'sonner'

interface AcsiDiscrepancyPickerProps {
  onSelect: (detail: AcsiDiscrepancyDetail) => void
  onClose: () => void
  alreadyLinkedIds?: Set<string>
}

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  color: cfg.color,
}))

export function AcsiDiscrepancyPicker({ onSelect, onClose, alreadyLinkedIds }: AcsiDiscrepancyPickerProps) {
  const { installationId } = useInstallation()
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchDiscrepancies(installationId).then(rows => {
      setDiscrepancies(rows)
      setLoading(false)
    })
  }, [installationId])

  // Derive available types from actual data
  const availableTypes = useMemo(() => {
    const typeSet = new Set(discrepancies.map(d => d.type).filter(Boolean))
    return DISCREPANCY_TYPES.filter(t => typeSet.has(t.value))
  }, [discrepancies])

  const availableStatuses = useMemo(() => {
    const statusSet = new Set<string>(discrepancies.map(d => d.status).filter(Boolean))
    return STATUS_OPTIONS.filter(s => statusSet.has(s.value))
  }, [discrepancies])

  const filtered = discrepancies.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (typeFilter !== 'all' && d.type !== typeFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      d.display_id?.toLowerCase().includes(q) ||
      d.title?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q) ||
      d.location_text?.toLowerCase().includes(q) ||
      d.work_order_number?.toLowerCase().includes(q) ||
      d.type?.toLowerCase().includes(q)
    )
  })

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)

  const toggleSelection = (disc: DiscrepancyRow) => {
    if (submitting) return
    if (alreadyLinkedIds?.has(disc.id)) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(disc.id)) next.delete(disc.id)
      else next.add(disc.id)
      return next
    })
  }

  const buildDetail = (disc: DiscrepancyRow, photoIds: string[]): AcsiDiscrepancyDetail => {
    const pins: { lat: number; lng: number }[] = []
    if (disc.latitude && disc.longitude) pins.push({ lat: disc.latitude, lng: disc.longitude })
    // Compose: "[WO# xxx] <location> — <title> — <description>"
    // WO# in brackets keeps WOs paired with their discrepancy on merge;
    // location flows inline so the sentence reads naturally.
    const title = (disc.title || '').trim()
    const description = (disc.description || '').trim()
    const desc = description && description !== title ? description : ''
    const body = [disc.location_text, title, desc].filter(Boolean).join(' — ')
    const prefix = disc.work_order_number ? `[WO# ${disc.work_order_number}] ` : ''
    return {
      comment: prefix + body,
      work_order: '',
      project_number: '',
      estimated_cost: '',
      estimated_completion: '',
      photo_ids: photoIds,
      areas: [],
      latitude: disc.latitude,
      longitude: disc.longitude,
      pins,
      linked_discrepancy_id: disc.id,
    }
  }

  const handleConfirm = async () => {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)
    const rows = discrepancies.filter(d => selected.has(d.id))
    const resolved = await Promise.all(rows.map(async (disc) => {
      let photoIds: string[] = []
      try {
        const photos = await fetchDiscrepancyPhotos(disc.id)
        photoIds = photos.map(p => p.id)
      } catch { /* photos are optional */ }
      return { disc, photoIds }
    }))

    let totalPhotos = 0
    for (const { disc, photoIds } of resolved) {
      totalPhotos += photoIds.length
      onSelect(buildDetail(disc, photoIds))
    }

    const count = resolved.length
    const photoText = totalPhotos > 0 ? ` with ${totalPhotos} photo${totalPhotos === 1 ? '' : 's'}` : ''
    toast.success(`Linked ${count} discrepanc${count === 1 ? 'y' : 'ies'}${photoText}`)
    onClose()
  }

  const statusColor = (d: DiscrepancyRow) => {
    const cfg = STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG]
    return cfg?.color || 'var(--color-text-3)'
  }

  const isLinked = (d: DiscrepancyRow) => alreadyLinkedIds?.has(d.id)

  const chipStyle = (active: boolean, color?: string): React.CSSProperties => ({
    padding: '5px 10px',
    borderRadius: 6,
    border: active ? `1px solid ${color || 'var(--color-cyan)'}` : '1px solid var(--color-border)',
    background: active ? `${color || 'var(--color-cyan)'}18` : 'transparent',
    color: active ? (color || 'var(--color-cyan)') : 'var(--color-text-3)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  return (
    <div
      className="modal-overlay"
      style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%',
        maxWidth: 600,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg-surface)',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px', borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link2 size={16} style={{ color: 'var(--color-cyan)' }} />
            <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
              Link Existing Discrepancy
            </span>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--color-text-3)',
            cursor: 'pointer', padding: 4,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Search + filter toggle */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--color-text-4)',
              }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, title, location, WO#..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-input)',
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--fs-sm)',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 12px', borderRadius: 8,
                border: activeFilterCount > 0 ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
                background: activeFilterCount > 0 ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                color: activeFilterCount > 0 ? 'var(--color-cyan)' : 'var(--color-text-3)',
                cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600,
              }}
            >
              <Filter size={14} />
              {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
            </button>
          </div>

          {/* Filter chips */}
          {showFilters && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Status filter */}
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 4 }}>Status</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button type="button" onClick={() => setStatusFilter('all')} style={chipStyle(statusFilter === 'all')}>All</button>
                  {availableStatuses.map(s => (
                    <button key={s.value} type="button" onClick={() => setStatusFilter(s.value)} style={chipStyle(statusFilter === s.value, s.color)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Type filter */}
              <div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 4 }}>Type</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button type="button" onClick={() => setTypeFilter('all')} style={chipStyle(typeFilter === 'all')}>All</button>
                  {availableTypes.map(t => (
                    <button key={t.value} type="button" onClick={() => setTypeFilter(t.value)} style={chipStyle(typeFilter === t.value)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginTop: 6 }}>
            {loading ? 'Loading...' : `${filtered.length} discrepanc${filtered.length === 1 ? 'y' : 'ies'} found`}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
              {search || activeFilterCount > 0 ? 'No discrepancies match your filters.' : 'No discrepancies found for this installation.'}
            </div>
          )}

          {filtered.map(d => {
            const linked = isLinked(d)
            const isSelected = selected.has(d.id)
            const disabled = linked || submitting
            return (
              <button
                key={d.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleSelection(d)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  marginBottom: 4,
                  borderRadius: 8,
                  border: isSelected
                    ? '1px solid var(--color-cyan)'
                    : linked
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid var(--color-border)',
                  background: isSelected
                    ? 'rgba(56, 189, 248, 0.10)'
                    : linked
                      ? 'rgba(16, 185, 129, 0.06)'
                      : 'var(--color-bg-elevated)',
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: linked ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                {/* Checkbox indicator */}
                <span style={{
                  flex: '0 0 auto',
                  width: 18, height: 18, marginTop: 2,
                  borderRadius: 4,
                  border: isSelected ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
                  background: isSelected ? 'var(--color-cyan)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <Check size={12} strokeWidth={3} color="#0b1117" />}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)',
                      }}>
                        {d.display_id}
                      </span>
                      {linked && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10B981',
                          fontSize: '10px', fontWeight: 700, letterSpacing: '0.02em',
                        }}>
                          <Check size={10} />
                          LINKED
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {d.photo_count > 0 && (
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                          {d.photo_count} photo{d.photo_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      <Badge label={d.status} color={statusColor(d)} />
                    </div>
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 2 }}>
                    {d.title}
                  </div>
                  {d.location_text && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                      {d.location_text}
                    </div>
                  )}
                  {d.work_order_number && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', fontWeight: 600, marginTop: 2 }}>
                      WO# {d.work_order_number}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Sticky footer — actions */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)',
        }}>
          <span style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
            {selected.size === 0
              ? 'Select one or more discrepancies to link'
              : `${selected.size} selected`}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-sm)', fontWeight: 600,
              cursor: submitting ? 'default' : 'pointer',
            }}
          >Cancel</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0 || submitting}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--color-cyan)',
              background: selected.size === 0 ? 'rgba(56, 189, 248, 0.15)' : 'var(--color-cyan)',
              color: selected.size === 0 ? 'var(--color-cyan)' : '#0b1117',
              fontSize: 'var(--fs-sm)', fontWeight: 700,
              cursor: (selected.size === 0 || submitting) ? 'default' : 'pointer',
              opacity: selected.size === 0 ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Link2 size={14} />
            {submitting
              ? 'Linking…'
              : selected.size <= 1
                ? 'Link'
                : `Link ${selected.size} discrepancies`}
          </button>
        </div>
      </div>
    </div>
  )
}
