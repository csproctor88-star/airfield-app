'use client'

import { useState, useEffect } from 'react'
import { fetchWildlifeAnalytics, fetchBwcHistory, type WildlifeAnalytics as AnalyticsData, type BwcHistoryRow } from '@/lib/supabase/wildlife'
import { formatZuluDateTime } from '@/lib/utils'
import {
  Eye, Zap, Megaphone, CheckCircle2,
  BarChart3, Award, Layers, Clock,
} from 'lucide-react'

type Props = {
  baseId?: string | null
}

const BWC_COLORS: Record<string, string> = {
  LOW: 'var(--color-success)',
  MOD: 'var(--color-amber)',
  SEV: 'var(--color-orange)',
  PROHIB: 'var(--color-danger)',
  MODERATE: 'var(--color-amber)',
  SEVERE: 'var(--color-orange)',
  PROHIBITED: 'var(--color-danger)',
}

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: 10, paddingBottom: 6,
  borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
  display: 'flex', alignItems: 'center', gap: 8,
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

  const kpiCards: { label: string; value: number | string; color: string; Icon: typeof Eye }[] = [
    { label: 'Total Sightings', value: analytics.totalSightings, color: 'var(--color-success)', Icon: Eye },
    { label: 'Total Strikes', value: analytics.totalStrikes, color: 'var(--color-danger)', Icon: Zap },
    { label: 'Dispersal Actions', value: analytics.totalDispersal, color: 'var(--color-amber)', Icon: Megaphone },
    { label: 'Dispersal Effectiveness', value: dispersalPct !== null ? `${dispersalPct}%` : '—', color: 'var(--color-cyan)', Icon: CheckCircle2 },
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
            padding: '7px 12px', borderRadius: 'var(--radius-md)',
            border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
            background: 'color-mix(in srgb, var(--color-cyan) 8%, var(--color-bg-surface))',
            color: 'var(--color-cyan)',
            fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>

      {/* KPI Cards — outlined-pill chrome with Lucide icons replacing emoji */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
        {kpiCards.map(kpi => {
          const Icon = kpi.Icon
          return (
            <div key={kpi.label} style={{
              background: `color-mix(in srgb, ${kpi.color} 8%, var(--color-bg-surface))`,
              borderRadius: 'var(--radius-md)',
              border: `1px solid color-mix(in srgb, ${kpi.color} 30%, transparent)`,
              borderLeft: `3px solid ${kpi.color}`,
              padding: '14px 12px',
              textAlign: 'center',
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: kpi.color, marginBottom: 6 }}>
                <Icon size={22} />
              </div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>{kpi.label}</div>
            </div>
          )
        })}
      </div>

      {/* Sightings by Month chart */}
      {analytics.sightingsByMonth.length > 0 && (
        <div style={{
          background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)', padding: 14, marginBottom: 14,
        }}>
          <div style={SECTION_HEADER}><BarChart3 size={13} /> Sightings by Month</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
            {analytics.sightingsByMonth.map(m => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-success)' }}>{m.count}</div>
                <div style={{
                  width: '100%', maxWidth: 30,
                  height: Math.max(4, (m.count / maxSightingsMonth) * 80),
                  background: 'var(--color-success)', borderRadius: '4px 4px 0 0',
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
          background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)', padding: 14, marginBottom: 14,
        }}>
          <div style={SECTION_HEADER}><Award size={13} /> Top Species</div>
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
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-success)', borderRadius: 3 }} />
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
          background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)', padding: 14, marginBottom: 14,
        }}>
          <div style={SECTION_HEADER}><Layers size={13} /> By Species Group</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {analytics.speciesGroupBreakdown.map(g => (
              <div key={g.group} style={{
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
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
          background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)', padding: 14, marginBottom: 14,
        }}>
          <div style={SECTION_HEADER}><Clock size={13} /> BWC History</div>
          {bwcHistory.slice(0, 20).map((entry, i) => {
            const tierColor = BWC_COLORS[entry.bwc_value] || 'var(--color-text-3)'
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                borderBottom: i < Math.min(bwcHistory.length, 20) - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <span style={{
                  fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '2px 9px',
                  borderRadius: 'var(--radius-full)',
                  background: `color-mix(in srgb, ${tierColor} 14%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${tierColor} 35%, transparent)`,
                  color: tierColor,
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
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {analytics.totalSightings === 0 && analytics.totalStrikes === 0 && bwcHistory.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 40, background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
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
