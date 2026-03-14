'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import {
  fetchSightings, fetchStrikes, deleteSighting, deleteStrike,
  fetchSighting, fetchStrike,
  type WildlifeSightingRow, type WildlifeStrikeRow,
} from '@/lib/supabase/wildlife'
import { formatZuluDateTime } from '@/lib/utils'
import { SightingForm } from '@/components/wildlife/sighting-form'
import { StrikeForm } from '@/components/wildlife/strike-form'
import { WildlifeHeatmap } from '@/components/wildlife/wildlife-heatmap'
import { WildlifeAnalytics } from '@/components/wildlife/wildlife-analytics'
import { WildlifeReport } from '@/components/wildlife/wildlife-report'
import {
  WILDLIFE_ACTIONS,
  DAMAGE_LEVELS,
} from '@/lib/constants'

type Tab = 'log' | 'heatmap' | 'analytics' | 'reports'
type EntryType = 'all' | 'sighting' | 'strike'

export default function WildlifePage() {
  const { installationId } = useInstallation()
  const [tab, setTab] = useState<Tab>('log')
  const [showSightingForm, setShowSightingForm] = useState(false)
  const [showStrikeForm, setShowStrikeForm] = useState(false)
  const [editingSighting, setEditingSighting] = useState<WildlifeSightingRow | null>(null)
  const [editingStrike, setEditingStrike] = useState<WildlifeStrikeRow | null>(null)
  const [sightings, setSightings] = useState<WildlifeSightingRow[]>([])
  const [strikes, setStrikes] = useState<WildlifeStrikeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState('Inspector')
  const [filterType, setFilterType] = useState<EntryType>('all')
  const [filterDays, setFilterDays] = useState(30)

  const loadData = useCallback(async () => {
    setLoading(true)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - filterDays)

    const [sResult, xResult] = await Promise.all([
      fetchSightings(installationId, { startDate: startDate.toISOString() }),
      fetchStrikes(installationId, { startDate: startDate.toISOString() }),
    ])
    setSightings(sResult.data)
    setStrikes(xResult.data)
    setLoading(false)
  }, [installationId, filterDays])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setCurrentUser('Demo User')
      setLoading(false)
      return
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, rank, first_name, last_name')
        .eq('id', user.id)
        .single()
      if (profile?.first_name && profile?.last_name) {
        const displayName = `${profile.first_name} ${profile.last_name}`
        setCurrentUser(profile.rank ? `${profile.rank} ${displayName}` : displayName)
      } else if (profile?.name) {
        setCurrentUser(profile.rank ? `${profile.rank} ${profile.name}` : profile.name)
      }
    })
    loadData()
  }, [installationId, loadData])

  async function handleDeleteSighting(id: string) {
    if (!confirm('Delete this wildlife sighting?')) return
    const { error } = await deleteSighting(id)
    if (error) { toast.error(error); return }
    toast.success('Sighting deleted')
    loadData()
  }

  async function handleDeleteStrike(id: string) {
    if (!confirm('Delete this wildlife strike report?')) return
    const { error } = await deleteStrike(id)
    if (error) { toast.error(error); return }
    toast.success('Strike report deleted')
    loadData()
  }

  async function handleEditSighting(id: string) {
    const row = await fetchSighting(id)
    if (!row) { toast.error('Could not load sighting'); return }
    setEditingSighting(row)
  }

  async function handleEditStrike(id: string) {
    const row = await fetchStrike(id)
    if (!row) { toast.error('Could not load strike report'); return }
    setEditingStrike(row)
  }

  // Merge sightings and strikes into a unified timeline
  const timeline = [
    ...sightings.map(s => ({
      id: s.id,
      type: 'sighting' as const,
      date: s.observed_at,
      species: s.species_common,
      count: s.count_observed,
      location: s.location_text,
      action: s.action_taken,
      dispersalMethod: s.dispersal_method,
      dispersalEffective: s.dispersal_effective,
      damage: null as string | null,
      displayId: s.display_id,
      notes: s.notes,
    })),
    ...strikes.map(s => ({
      id: s.id,
      type: 'strike' as const,
      date: s.strike_date,
      species: s.species_common || 'Unknown',
      count: s.number_struck,
      location: s.location_text,
      action: null as string | null,
      dispersalMethod: null as string | null,
      dispersalEffective: null as boolean | null,
      damage: s.damage_level,
      displayId: s.display_id,
      notes: s.notes,
    })),
  ]
    .filter(e => filterType === 'all' || e.type === filterType)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const tabs: { key: Tab; label: string }[] = [
    { key: 'log', label: 'Activity Log' },
    { key: 'heatmap', label: 'Heatmap' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'reports', label: 'Reports' },
  ]

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Wildlife / BASH</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowSightingForm(true)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#10B981', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-base)',
            }}
          >
            + Sighting
          </button>
          <button
            onClick={() => setShowStrikeForm(true)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-base)',
            }}
          >
            + Strike
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)',
        marginBottom: 16, overflowX: 'auto',
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 18px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: tab === t.key ? 800 : 500,
              color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-2)',
              borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              marginBottom: -2,
              fontSize: 'var(--fs-md)',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sighting Form Modal */}
      {showSightingForm && (
        <SightingForm
          currentUser={currentUser}
          baseId={installationId}
          onClose={() => setShowSightingForm(false)}
          onSaved={() => { setShowSightingForm(false); loadData() }}
        />
      )}

      {/* Strike Form Modal */}
      {showStrikeForm && (
        <StrikeForm
          currentUser={currentUser}
          baseId={installationId}
          onClose={() => setShowStrikeForm(false)}
          onSaved={() => { setShowStrikeForm(false); loadData() }}
        />
      )}

      {/* Edit Sighting Modal */}
      {editingSighting && (
        <SightingForm
          currentUser={currentUser}
          baseId={installationId}
          initialData={editingSighting}
          onClose={() => setEditingSighting(null)}
          onSaved={() => { setEditingSighting(null); loadData() }}
        />
      )}

      {/* Edit Strike Modal */}
      {editingStrike && (
        <StrikeForm
          currentUser={currentUser}
          baseId={installationId}
          initialData={editingStrike}
          onClose={() => setEditingStrike(null)}
          onSaved={() => { setEditingStrike(null); loadData() }}
        />
      )}

      {/* Tab Content */}
      {tab === 'log' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as EntryType)}
              style={{
                padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface)', color: 'var(--color-text)',
                fontSize: 'var(--fs-base)',
              }}
            >
              <option value="all">All Types</option>
              <option value="sighting">Sightings Only</option>
              <option value="strike">Strikes Only</option>
            </select>
            <select
              value={filterDays}
              onChange={e => setFilterDays(Number(e.target.value))}
              style={{
                padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface)', color: 'var(--color-text)',
                fontSize: 'var(--fs-base)',
              }}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 12 months</option>
            </select>
          </div>

          {/* Timeline */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>Loading...</div>
          ) : timeline.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 40, color: 'var(--color-text-3)',
              background: 'var(--color-bg-surface)', borderRadius: 12,
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 'var(--fs-3xl)', marginBottom: 8 }}>🦅</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>No wildlife activity recorded</div>
              <div style={{ fontSize: 'var(--fs-sm)' }}>Use "+ Sighting" or "+ Strike" to log wildlife observations</div>
            </div>
          ) : (
            <div style={{
              background: 'var(--color-bg-surface)', borderRadius: 12,
              border: '1px solid var(--color-border)', overflow: 'hidden',
            }}>
              {timeline.map(entry => {
                const isSighting = entry.type === 'sighting'
                const actionLabel = entry.action && entry.action !== 'none'
                  ? WILDLIFE_ACTIONS.find(a => a.value === entry.action)?.label || entry.action
                  : null
                const damageConfig = entry.damage
                  ? DAMAGE_LEVELS.find(d => d.value === entry.damage)
                  : null

                return (
                  <div
                    key={`${entry.type}-${entry.id}`}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    {/* Type badge */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                      background: isSighting ? '#10B98115' : '#EF444415',
                      border: `1px solid ${isSighting ? '#10B98130' : '#EF444430'}`,
                    }}>
                      {isSighting ? '👁️' : '💥'}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)' }}>
                          {entry.count}x {entry.species}
                        </span>
                        <span style={{
                          fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                          background: isSighting ? '#10B98120' : '#EF444420',
                          color: isSighting ? '#10B981' : '#EF4444',
                        }}>
                          {isSighting ? 'SIGHTING' : 'STRIKE'}
                        </span>
                        {actionLabel && (
                          <span style={{
                            fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                            background: '#F59E0B20', color: '#F59E0B',
                          }}>
                            {actionLabel}
                          </span>
                        )}
                        {damageConfig && entry.damage !== 'none' && (
                          <span style={{
                            fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                            background: `${damageConfig.color}20`, color: damageConfig.color,
                          }}>
                            DMG: {damageConfig.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
                        {entry.location && <span>{entry.location} · </span>}
                        <span>{formatZuluDateTime(entry.date)}</span>
                        <span style={{ marginLeft: 6, color: 'var(--color-text-4)' }}>{entry.displayId}</span>
                      </div>
                      {entry.notes && (
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginTop: 4, fontStyle: 'italic' }}>
                          {entry.notes}
                        </div>
                      )}
                    </div>

                    {/* Edit + Delete */}
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => isSighting ? handleEditSighting(entry.id) : handleEditStrike(entry.id)}
                        title="Edit"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-text-4)', fontSize: 14, padding: 4,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => isSighting ? handleDeleteSighting(entry.id) : handleDeleteStrike(entry.id)}
                        title="Delete"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-text-4)', fontSize: 16, padding: 4,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Summary footer */}
          {!loading && timeline.length > 0 && (
            <div style={{
              marginTop: 10, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
              display: 'flex', gap: 16,
            }}>
              <span>{sightings.length} sighting{sightings.length !== 1 ? 's' : ''}</span>
              <span>{strikes.length} strike{strikes.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {tab === 'heatmap' && (
        <WildlifeHeatmap baseId={installationId} />
      )}

      {tab === 'analytics' && (
        <WildlifeAnalytics baseId={installationId} />
      )}

      {tab === 'reports' && (
        <WildlifeReport baseId={installationId} />
      )}
    </div>
  )
}
