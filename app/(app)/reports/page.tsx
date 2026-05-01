'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, AlertTriangle, TrendingUp, Clock, Lightbulb, Loader2, ChevronRight } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAnalyticsData, type AnalyticsData } from '@/lib/reports/analytics-data'

const CHECK_TYPE_LABELS: Record<string, string> = {
  fod: 'FOD', rsc: 'RSC', rcr: 'RCR', bash: 'BASH',
  ife: 'IFE', ground_emergency: 'Ground Emergency', heavy_aircraft: 'Heavy Aircraft',
}

const REPORT_CARDS = [
  { title: 'Daily Operations Summary', description: 'All activity for a selected date or range.', href: '/reports/daily', icon: FileText, color: 'var(--color-cyan)' },
  { title: 'Discrepancy Report', description: 'Filtered exports by status, type, shop, or location.', href: '/reports/discrepancies', icon: AlertTriangle, color: 'var(--color-warning)' },
  { title: 'Discrepancy Trends', description: 'Opened vs closed over time.', href: '/reports/trends', icon: TrendingUp, color: 'var(--color-purple)' },
  { title: 'Aging Discrepancies', description: 'By aging tier and shop with filtered exports.', href: '/reports/aging', icon: Clock, color: 'var(--color-danger)' },
  { title: 'Airfield Lighting Report', description: 'System health, outages, feature inventory.', href: '/reports/lighting', icon: Lightbulb, color: 'var(--color-status-pass)' },
]

const TIME_FRAMES = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '6mo' },
  { value: 365, label: '1yr' },
]

export default function ReportsPage() {
  const { installationId } = useInstallation()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')

  // Custom range — defaults to last 30 days
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [customStart, setCustomStart] = useState(thirtyDaysAgo)
  const [customEnd, setCustomEnd] = useState(today)

  useEffect(() => {
    setLoading(true)
    if (mode === 'custom') {
      const startMs = new Date(customStart + 'T00:00:00').getTime()
      const endMs = new Date(customEnd + 'T23:59:59').getTime()
      const computedDays = Math.max(1, Math.round((endMs - startMs) / 86400000))
      const untilIso = new Date(endMs).toISOString()
      fetchAnalyticsData(installationId, computedDays, untilIso).then(data => {
        setAnalytics(data)
        setLoading(false)
      })
    } else {
      fetchAnalyticsData(installationId, days).then(data => {
        setAnalytics(data)
        setLoading(false)
      })
    }
  }, [installationId, days, mode, customStart, customEnd])

  const periodLabel = mode === 'custom'
    ? `${customStart} → ${customEnd}`
    : TIME_FRAMES.find(t => t.value === days)?.label || `${days}d`

  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, marginBottom: 14 }}>Reports & Analytics</div>

      {/* Report links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {REPORT_CARDS.map((card) => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center',
              background: 'var(--color-bg-surface)', borderRadius: 8,
              border: '1px solid var(--color-border)',
              borderLeft: `3px solid ${card.color}`,
              cursor: 'pointer',
            }}>
              <card.icon size={18} color={card.color} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>{card.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 1 }}>{card.description}</div>
              </div>
              <ChevronRight size={16} color="var(--color-text-4)" style={{ flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>

      {/* Analytics header with time frame selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>
          Analytics
        </div>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {TIME_FRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => { setMode('preset'); setDays(tf.value) }}
              style={{
                padding: '4px 10px', border: 'none', fontSize: 'var(--fs-xs)', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                background: mode === 'preset' && days === tf.value ? 'var(--color-cyan)' : 'transparent',
                color: mode === 'preset' && days === tf.value ? 'var(--color-cyan-btn-text)' : 'var(--color-text-3)',
              }}
            >
              {tf.label}
            </button>
          ))}
          <button
            onClick={() => setMode('custom')}
            style={{
              padding: '4px 10px', border: 'none', fontSize: 'var(--fs-xs)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              background: mode === 'custom' ? 'var(--color-cyan)' : 'transparent',
              color: mode === 'custom' ? 'var(--color-cyan-btn-text)' : 'var(--color-text-3)',
              borderLeft: '1px solid var(--color-border)',
            }}
          >
            Custom
          </button>
        </div>
      </div>

      {mode === 'custom' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap',
          padding: '8px 10px', borderRadius: 6, background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
        }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>From</span>
          <input
            type="date"
            value={customStart}
            max={customEnd}
            onChange={e => setCustomStart(e.target.value)}
            style={{
              padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4,
              background: 'var(--color-bg)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
              fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>To</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            max={today}
            onChange={e => setCustomEnd(e.target.value)}
            style={{
              padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4,
              background: 'var(--color-bg)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <Loader2 size={24} color="var(--color-text-3)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 8 }}>Loading analytics...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

          {/* Airfield Inspections */}
          <StyledCard accent="var(--color-cyan)">
            <CardHeader>Airfield Inspections</CardHeader>
            <BigNumber value={analytics.airfieldInspections.completed} label="completed" />
            {analytics.airfieldInspections.avgMinutes != null && (
              <StatRow label="Avg Time" value={`${analytics.airfieldInspections.avgMinutes} min`} />
            )}
            {analytics.airfieldInspections.passRate != null && (
              <StatRow label="Pass Rate" value={`${analytics.airfieldInspections.passRate}%`}>
                <MiniBar pct={analytics.airfieldInspections.passRate} color={analytics.airfieldInspections.passRate >= 90 ? 'var(--color-status-pass)' : 'var(--color-warning)'} />
              </StatRow>
            )}
          </StyledCard>

          {/* Lighting Inspections */}
          <StyledCard accent="var(--color-purple)">
            <CardHeader>Lighting Inspections</CardHeader>
            <BigNumber value={analytics.lightingInspections.completed} label="completed" />
            {analytics.lightingInspections.avgMinutes != null && (
              <StatRow label="Avg Time" value={`${analytics.lightingInspections.avgMinutes} min`} />
            )}
            {analytics.lightingInspections.passRate != null && (
              <StatRow label="Pass Rate" value={`${analytics.lightingInspections.passRate}%`}>
                <MiniBar pct={analytics.lightingInspections.passRate} color={analytics.lightingInspections.passRate >= 90 ? 'var(--color-status-pass)' : 'var(--color-warning)'} />
              </StatRow>
            )}
          </StyledCard>

          {/* Airfield Checks */}
          <StyledCard accent="var(--color-cyan)">
            <CardHeader>Airfield Checks</CardHeader>
            <BigNumber value={analytics.checks.last30Days} label="total" />
            <StatRow label="Avg / Day" value={analytics.checks.avgPerDay} />
            {analytics.checks.avgCompletionMinutes != null && (
              <StatRow label="Avg Time" value={`${analytics.checks.avgCompletionMinutes} min`} />
            )}
            {analytics.checks.byType.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {analytics.checks.byType.slice(0, 4).map(t => (
                  <span key={t.type} style={{
                    fontSize: 'var(--fs-2xs)', padding: '1px 6px', borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-cyan) 8%, transparent)', color: 'var(--color-text-3)',
                  }}>
                    {CHECK_TYPE_LABELS[t.type] || t.type} {t.count}
                  </span>
                ))}
              </div>
            )}
          </StyledCard>

          {/* Discrepancies */}
          <StyledCard accent="var(--color-warning)">
            <CardHeader>Discrepancies</CardHeader>
            <BigNumber value={analytics.discrepancies.currentOpen} label="open" color={analytics.discrepancies.currentOpen > 0 ? 'var(--color-warning)' : 'var(--color-status-pass)'} />
            {analytics.discrepancies.avgDaysToClose != null && (
              <StatRow label="Avg Days to Close" value={analytics.discrepancies.avgDaysToClose} />
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                Opened <span style={{ fontWeight: 700, color: 'var(--color-text-2)' }}>{analytics.discrepancies.openedLast30}</span>
              </span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                Closed <span style={{ fontWeight: 700, color: 'var(--color-text-2)' }}>{analytics.discrepancies.closedLast30}</span>
              </span>
              {(analytics.discrepancies.openedLast30 > 0 || analytics.discrepancies.closedLast30 > 0) && (
                <span style={{
                  fontSize: 'var(--fs-xs)', fontWeight: 700,
                  color: analytics.discrepancies.openedLast30 > analytics.discrepancies.closedLast30 ? 'var(--color-danger)' : 'var(--color-status-pass)',
                }}>
                  Net {analytics.discrepancies.openedLast30 > analytics.discrepancies.closedLast30 ? '+' : ''}
                  {analytics.discrepancies.openedLast30 - analytics.discrepancies.closedLast30}
                </span>
              )}
            </div>
          </StyledCard>

          {/* QRC Executions */}
          <StyledCard accent="var(--color-orange)">
            <CardHeader>QRC Executions</CardHeader>
            <BigNumber value={analytics.qrc.executionsLast30} label="executed" />
            {analytics.qrc.avgResponseMinutes != null && (
              <StatRow label="Avg Response" value={`${analytics.qrc.avgResponseMinutes} min`} />
            )}
          </StyledCard>

          {/* Personnel */}
          <StyledCard accent="var(--color-text-3)">
            <CardHeader>Personnel on Airfield</CardHeader>
            <BigNumber value={analytics.personnel.activeToday} label="active today" />
            {analytics.personnel.avgPerDay != null && (
              <StatRow label="Avg / Day" value={analytics.personnel.avgPerDay} />
            )}
          </StyledCard>

          {/* Obstructions */}
          <StyledCard accent="var(--color-warning)">
            <CardHeader>Obstruction Evaluations</CardHeader>
            <BigNumber value={analytics.obstructions.evaluated} label="evaluated" />
            <StatRow label="Violations Found" value={analytics.obstructions.violations}>
              {analytics.obstructions.violations > 0 && (
                <span style={{
                  fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                  background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)',
                }}>
                  {analytics.obstructions.evaluated > 0
                    ? `${Math.round((analytics.obstructions.violations / analytics.obstructions.evaluated) * 100)}%`
                    : '0%'}
                </span>
              )}
            </StatRow>
          </StyledCard>

          {/* Parking Plans */}
          <StyledCard accent="var(--color-accent)">
            <CardHeader>Parking Plans</CardHeader>
            <BigNumber value={analytics.parking.totalPlans} label="total plans" />
            <StatRow label={`Created (${periodLabel})`} value={analytics.parking.createdInPeriod} />
            {analytics.parking.activePlan && (
              <div style={{ marginTop: 2, fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
                Active: <span style={{ fontWeight: 600, color: 'var(--color-cyan)' }}>{analytics.parking.activePlan}</span>
              </div>
            )}
          </StyledCard>

          {/* Wildlife / BASH */}
          <StyledCard accent="var(--color-success)">
            <CardHeader>Wildlife / BASH</CardHeader>
            <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>{analytics.wildlife.sightings}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', fontWeight: 600 }}>sightings</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: analytics.wildlife.strikes > 0 ? 'var(--color-danger)' : 'var(--color-text-1)' }}>{analytics.wildlife.strikes}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', fontWeight: 600 }}>strikes</div>
              </div>
            </div>
            {analytics.wildlife.topSpecies && (
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
                Top species: <span style={{ fontWeight: 600, color: 'var(--color-text-2)' }}>{analytics.wildlife.topSpecies}</span>
              </div>
            )}
          </StyledCard>

          {/* Customer Feedback */}
          <StyledCard accent="var(--color-warning)">
            <CardHeader>Customer Feedback</CardHeader>
            <BigNumber value={analytics.feedback.recentCount} label={`submissions (${periodLabel})`} />
            <StatRow label="Total all-time" value={analytics.feedback.total} />
            {analytics.feedback.avgRating != null && (
              <StatRow label="Avg rating" value={`${analytics.feedback.avgRating.toFixed(1)} / 5`} />
            )}
          </StyledCard>

        </div>
      )}
    </div>
  )
}

// ── Styled card with accent top border ──

function StyledCard({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-bg-surface)', borderRadius: 10, padding: '12px 14px',
      border: '1px solid var(--color-border)',
      borderTop: `3px solid ${accent}`,
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2,
    }}>
      {children}
    </div>
  )
}

function BigNumber({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 2 }}>
      <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: color || 'var(--color-text-1)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function StatRow({ label, value, children }: { label: string; value: string | number; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1px 0' }}>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {children}
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>{value}</span>
      </div>
    </div>
  )
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 2, background: color }} />
    </div>
  )
}
