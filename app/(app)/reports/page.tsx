'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, AlertTriangle, TrendingUp, Clock, Lightbulb, Loader2 } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAnalyticsData, type AnalyticsData } from '@/lib/reports/analytics-data'

const CHECK_TYPE_LABELS: Record<string, string> = {
  fod: 'FOD', rsc: 'RSC', rcr: 'RCR', bash: 'BASH',
  ife: 'IFE', ground_emergency: 'Ground Emergency', heavy_aircraft: 'Heavy Aircraft',
}

const REPORT_CARDS = [
  {
    title: 'Daily Operations Summary',
    description: 'All airfield activity for a selected date or date range.',
    href: '/reports/daily',
    icon: FileText,
    color: '#0EA5E9',
  },
  {
    title: 'Discrepancy Report',
    description: 'Filtered discrepancy exports — by status, type, shop, or location.',
    href: '/reports/discrepancies',
    icon: AlertTriangle,
    color: '#FBBF24',
  },
  {
    title: 'Discrepancy Trends',
    description: 'Opened vs closed over time with top areas and types.',
    href: '/reports/trends',
    icon: TrendingUp,
    color: '#8B5CF6',
  },
  {
    title: 'Aging Discrepancies',
    description: 'Open discrepancies by aging tier and shop with filtered exports.',
    href: '/reports/aging',
    icon: Clock,
    color: '#EF4444',
  },
  {
    title: 'Airfield Lighting Report',
    description: 'System health, outages, and feature inventory with filtered exports.',
    href: '/reports/lighting',
    icon: Lightbulb,
    color: '#22C55E',
  },
]

export default function ReportsPage() {
  const { installationId } = useInstallation()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalyticsData(installationId).then(data => {
      setAnalytics(data)
      setLoading(false)
    })
  }, [installationId])

  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>Reports & Analytics</div>

      {/* Report links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {REPORT_CARDS.map((card) => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center',
              background: 'var(--color-bg-surface)', borderRadius: 8,
              border: `1px solid ${card.color}22`, cursor: 'pointer',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${card.color}14`, border: `1px solid ${card.color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <card.icon size={18} color={card.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>{card.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', lineHeight: 1.4 }}>{card.description}</div>
              </div>
              <span style={{ color: 'var(--color-text-4)', fontSize: 'var(--fs-xl)' }}>›</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Analytics */}
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 10 }}>
        30-Day Analytics
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <Loader2 size={24} color="var(--color-text-3)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 8 }}>Loading analytics...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : analytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Inspections & Checks — side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <AnalyticsCard title="Inspections">
              <MetricRow label="Completed" value={analytics.inspections.last30Days} />
              {analytics.inspections.avgCompletionMinutes != null && (
                <MetricRow label="Avg Completion" value={`${analytics.inspections.avgCompletionMinutes} min`} />
              )}
              {analytics.inspections.passRate != null && (
                <MetricRow label="Item Pass Rate" value={`${analytics.inspections.passRate}%`} color={analytics.inspections.passRate >= 90 ? '#22C55E' : '#FBBF24'} />
              )}
            </AnalyticsCard>

            <AnalyticsCard title="Airfield Checks">
              <MetricRow label="Total" value={analytics.checks.last30Days} />
              <MetricRow label="Avg / Day" value={analytics.checks.avgPerDay} />
              {analytics.checks.byType.slice(0, 3).map(t => (
                <MetricRow key={t.type} label={CHECK_TYPE_LABELS[t.type] || t.type} value={t.count} subtle />
              ))}
            </AnalyticsCard>
          </div>

          {/* Discrepancies — full width */}
          <AnalyticsCard title="Discrepancies">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <MetricRow label="Currently Open" value={analytics.discrepancies.currentOpen} color={analytics.discrepancies.currentOpen > 0 ? '#FBBF24' : '#22C55E'} />
              {analytics.discrepancies.avgDaysToClose != null && (
                <MetricRow label="Avg Days to Close" value={analytics.discrepancies.avgDaysToClose} color={analytics.discrepancies.avgDaysToClose > 30 ? '#EF4444' : 'var(--color-text-1)'} />
              )}
              <MetricRow label="Opened (30d)" value={analytics.discrepancies.openedLast30} />
              <MetricRow label="Closed (30d)" value={analytics.discrepancies.closedLast30} />
            </div>
            {analytics.discrepancies.openedLast30 > 0 && analytics.discrepancies.closedLast30 > 0 && (
              <div style={{ marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                Net change: <span style={{
                  fontWeight: 700,
                  color: analytics.discrepancies.openedLast30 > analytics.discrepancies.closedLast30 ? '#EF4444' : '#22C55E',
                }}>
                  {analytics.discrepancies.openedLast30 > analytics.discrepancies.closedLast30 ? '+' : ''}
                  {analytics.discrepancies.openedLast30 - analytics.discrepancies.closedLast30}
                </span>
              </div>
            )}
          </AnalyticsCard>

          {/* QRC & Personnel — side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <AnalyticsCard title="QRC Executions">
              <MetricRow label="Executed" value={analytics.qrc.executionsLast30} />
              {analytics.qrc.avgResponseMinutes != null && (
                <MetricRow label="Avg Response" value={`${analytics.qrc.avgResponseMinutes} min`} />
              )}
            </AnalyticsCard>

            <AnalyticsCard title="Personnel on Airfield">
              <MetricRow label="Active Today" value={analytics.personnel.activeToday} />
              {analytics.personnel.avgPerDay != null && (
                <MetricRow label="Avg / Day" value={analytics.personnel.avgPerDay} />
              )}
            </AnalyticsCard>
          </div>

          {/* Wildlife — full width only if there's data */}
          {(analytics.wildlife.sightingsLast30 > 0 || analytics.wildlife.strikesLast30 > 0) && (
            <AnalyticsCard title="Wildlife / BASH">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <MetricRow label="Sightings" value={analytics.wildlife.sightingsLast30} />
                <MetricRow label="Strikes" value={analytics.wildlife.strikesLast30} color={analytics.wildlife.strikesLast30 > 0 ? '#EF4444' : 'var(--color-text-1)'} />
              </div>
              {analytics.wildlife.topSpecies && (
                <div style={{ marginTop: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                  Most frequent: <span style={{ fontWeight: 600, color: 'var(--color-text-2)' }}>{analytics.wildlife.topSpecies}</span>
                </div>
              )}
            </AnalyticsCard>
          )}
        </div>
      )}
    </div>
  )
}

// ── Compact card component ──

function AnalyticsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div style={{
        fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function MetricRow({ label, value, color, subtle }: { label: string; value: string | number; color?: string; subtle?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: subtle ? '1px 0' : '2px 0',
    }}>
      <span style={{ fontSize: subtle ? 'var(--fs-2xs)' : 'var(--fs-sm)', color: subtle ? 'var(--color-text-4)' : 'var(--color-text-2)' }}>
        {label}
      </span>
      <span style={{
        fontSize: subtle ? 'var(--fs-xs)' : 'var(--fs-md)', fontWeight: 700,
        color: color || 'var(--color-text-1)',
      }}>
        {value}
      </span>
    </div>
  )
}
