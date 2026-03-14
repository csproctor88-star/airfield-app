'use client'

import { useState, useEffect } from 'react'
import { fetchWildlifeAnalytics, fetchBwcHistory, type WildlifeAnalytics as AnalyticsData, type BwcHistoryRow } from '@/lib/supabase/wildlife'
import { formatZuluDateTime } from '@/lib/utils'

type Props = {
  baseId?: string | null
}

const BWC_COLORS: Record<string, string> = {
  LOW: '#10B981',
  MOD: '#F59E0B',
  SEV: '#F97316',
  PROHIB: '#EF4444',
  MODERATE: '#F59E0B',
  SEVERE: '#F97316',
  PROHIBITED: '#EF4444',
}

export function WildlifeAnalytics({ baseId }: Props) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [bwcHistory, setBwcHistory] = useState<BwcHistoryRow[]>([])
  const [filterDays, setFilterDays] = useState(90)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - filterDays)
      const start = startDate.toISOString()

      const [analyticsResult, bwcResult] = await Promise.all([
        fetchWildlifeAnalytics(baseId, start),
        fetchBwcHistory(baseId, start),
      ])

      setAnalytics(analyticsResult)
      setBwcHistory(bwcResult)
      setLoading(false)
    }
    load()
  }, [baseId, filterDays])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>Loading analytics...</div>
  }

  if (!analytics) return null

  const dispersalPct = analytics.dispersalEffectiveness.total > 0
    ? Math.round((analytics.dispersalEffectiveness.effective / analytics.dispersalEffectiveness.total) * 100)
    : null

  const kpiCards = [
    { label: 'Total Sightings', value: analytics.totalSightings, color: '#10B981', icon: '👁️' },
    { label: 'Total Strikes', value: analytics.totalStrikes, color: '#EF4444', icon: '💥' },
    { label: 'Dispersal Actions', value: analytics.totalDispersal, color: '#F59E0B', icon: '📢' },
    { label: 'Dispersal Effectiveness', value: dispersalPct !== null ? `${dispersalPct}%` : '—', color: '#3B82F6', icon: '✓' },
  ]

  // Max bar height for charts
  const maxSightingsMonth = Math.max(...analytics.sightingsByMonth.map(m => m.count), 1)

  return (
    <div>
      {/* Period selector */}
      <div style={{ marginBottom: 14 }}>
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
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {kpiCards.map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--color-bg-surface)', borderRadius: 10,
            border: '1px solid var(--color-border)', padding: '14px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{kpi.icon}</div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Sightings by Month chart */}
      {analytics.sightingsByMonth.length > 0 && (
        <div style={{
          background: 'var(--color-bg-surface)', borderRadius: 10,
          border: '1px solid var(--color-border)', padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 'var(--fs-md)' }}>Sightings by Month</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
            {analytics.sightingsByMonth.map(m => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#10B981' }}>{m.count}</div>
                <div style={{
                  width: '100%', maxWidth: 30,
                  height: Math.max(4, (m.count / maxSightingsMonth) * 80),
                  background: '#10B981', borderRadius: '4px 4px 0 0',
                }} />
                <div style={{ fontSize: 8, color: 'var(--color-text-4)', whiteSpace: 'nowrap' }}>
                  {m.month.slice(5)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Species Table */}
      {analytics.topSpecies.length > 0 && (
        <div style={{
          background: 'var(--color-bg-surface)', borderRadius: 10,
          border: '1px solid var(--color-border)', padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 'var(--fs-md)' }}>Top Species</div>
          {analytics.topSpecies.map((sp, i) => {
            const pct = analytics.totalSightings > 0 ? Math.round((sp.count / analytics.totalSightings) * 100) : 0
            return (
              <div key={sp.species} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0', borderBottom: i < analytics.topSpecies.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <span style={{ width: 20, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 700 }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--fs-base)' }}>{sp.species}</span>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 700 }}>{sp.count}</span>
                <div style={{
                  width: 50, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden',
                }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#10B981', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', width: 32, textAlign: 'right' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Species Group Breakdown */}
      {analytics.speciesGroupBreakdown.length > 0 && (
        <div style={{
          background: 'var(--color-bg-surface)', borderRadius: 10,
          border: '1px solid var(--color-border)', padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 'var(--fs-md)' }}>By Species Group</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {analytics.speciesGroupBreakdown.map(g => (
              <div key={g.group} style={{
                padding: '8px 14px', borderRadius: 8,
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>{g.count}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'capitalize' }}>{g.group}s</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BWC History Timeline */}
      {bwcHistory.length > 0 && (
        <div style={{
          background: 'var(--color-bg-surface)', borderRadius: 10,
          border: '1px solid var(--color-border)', padding: 14, marginBottom: 14,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 10, fontSize: 'var(--fs-md)' }}>BWC History</div>
          {bwcHistory.slice(0, 20).map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
              borderBottom: i < Math.min(bwcHistory.length, 20) - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <span style={{
                fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                background: `${BWC_COLORS[entry.bwc_value] || '#64748B'}20`,
                color: BWC_COLORS[entry.bwc_value] || '#64748B',
              }}>
                {entry.bwc_value}
              </span>
              <span style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                {entry.set_by && <span>{entry.set_by} · </span>}
                {entry.source && <span style={{ fontStyle: 'italic' }}>{entry.source}</span>}
              </span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                {formatZuluDateTime(entry.set_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {analytics.totalSightings === 0 && analytics.totalStrikes === 0 && bwcHistory.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 40, background: 'var(--color-bg-surface)',
          borderRadius: 12, border: '1px solid var(--color-border)',
        }}>
          <div style={{ fontSize: 'var(--fs-3xl)', marginBottom: 8 }}>📊</div>
          <div style={{ fontWeight: 700 }}>No wildlife data for this period</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
            Log sightings and strikes to see analytics here
          </div>
        </div>
      )}
    </div>
  )
}
