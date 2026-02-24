'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Download, Loader2 } from 'lucide-react'
import { fetchDiscrepancyTrendsData, type DiscrepancyTrendsData, type TrendPeriod } from '@/lib/reports/discrepancy-trends-data'
import { generateDiscrepancyTrendsPdf } from '@/lib/reports/discrepancy-trends-pdf'
import { formatDiscrepancyType } from '@/lib/reports/open-discrepancies-data'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'

type ViewState = 'picker' | 'loading' | 'preview'

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
]

export default function DiscrepancyTrendsPage() {
  const router = useRouter()
  const { installationId, currentInstallation } = useInstallation()

  const [period, setPeriod] = useState<TrendPeriod>('30d')
  const [viewState, setViewState] = useState<ViewState>('picker')
  const [data, setData] = useState<DiscrepancyTrendsData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)

  const handleGenerate = async () => {
    setViewState('loading')

    const [reportData, inspector] = await Promise.all([
      fetchDiscrepancyTrendsData(period, installationId),
      getInspectorName(),
    ])

    setData(reportData)
    setGeneratorName(inspector.name || 'Unknown')
    setViewState('preview')
  }

  const handleExport = async () => {
    if (!data) return
    setExporting(true)
    generateDiscrepancyTrendsPdf(data, { generatedBy: generatorName, baseName: currentInstallation?.name, baseIcao: currentInstallation?.icao })
    setExporting(false)
  }

  // ── Picker View ──
  if (viewState === 'picker') {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Discrepancy Trends</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Select a time period</div>
          </div>
        </div>

        {/* Period Selector */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-text-4)', marginBottom: 14 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                flex: 1, padding: '10px 0', border: 'none',
                background: period === p.value ? '#8B5CF6' : 'transparent',
                color: period === p.value ? '#FFF' : 'var(--color-text-2)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
            color: '#FFF', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Generate Report
        </button>
      </div>
    )
  }

  // ── Loading View ──
  if (viewState === 'loading') {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setViewState('picker')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Discrepancy Trends</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader2 size={32} color="#8B5CF6" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 12 }}>Analyzing discrepancy trends...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── Preview View ──
  if (!data) return null

  const { summary, buckets } = data

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setViewState('picker')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Discrepancy Trends</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{data.periodLabel}</div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#EF4444' }}>{summary.totalOpened}</div>
          <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600 }}>Opened</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#22C55E' }}>{summary.totalClosed}</div>
          <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600 }}>Closed</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: summary.net > 0 ? '#EF4444' : summary.net < 0 ? '#22C55E' : '#94A3B8' }}>
            {summary.net >= 0 ? '+' : ''}{summary.net}
          </div>
          <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600 }}>Net</div>
        </div>
        {summary.avgDaysToClose !== null && (
          <div className="card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-purple)' }}>{summary.avgDaysToClose}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600 }}>Avg Days</div>
          </div>
        )}
      </div>

      {/* Trend Bars */}
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Opened vs Closed
        </div>
        {buckets.map((b) => {
          const maxVal = Math.max(...buckets.map((bb) => Math.max(bb.opened, bb.closed)), 1)
          return (
            <div key={b.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-2)' }}>{b.label}</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-3)' }}>
                  <span style={{ color: '#EF4444' }}>{b.opened}</span>
                  {' / '}
                  <span style={{ color: '#22C55E' }}>{b.closed}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3, height: 6 }}>
                <div style={{
                  width: `${(b.opened / maxVal) * 100}%`,
                  background: '#EF4444', borderRadius: 3, minWidth: b.opened > 0 ? 4 : 0,
                }} />
                <div style={{
                  width: `${(b.closed / maxVal) * 100}%`,
                  background: '#22C55E', borderRadius: 3, minWidth: b.closed > 0 ? 4 : 0,
                }} />
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#EF4444' }} />
            <span style={{ fontSize: 9, color: 'var(--color-text-3)' }}>Opened</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#22C55E' }} />
            <span style={{ fontSize: 9, color: 'var(--color-text-3)' }}>Closed</span>
          </div>
        </div>
      </div>

      {/* Top Areas */}
      {summary.topAreas.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Top Areas
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {summary.topAreas.map((a) => (
              <div key={a.area} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
                minWidth: 64,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-purple)' }}>{a.count}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{a.area}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Types */}
      {summary.topTypes.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Top Types
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {summary.topTypes.map((t) => (
              <div key={t.type} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
                minWidth: 64,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-purple)' }}>{t.count}</div>
                <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{formatDiscrepancyType(t.type)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated By */}
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-3)', marginBottom: 12 }}>
        Generated by {generatorName}
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          width: '100%', padding: '14px 0', borderRadius: 10,
          border: '1px solid rgba(34,197,94,0.4)',
          background: 'rgba(34,197,94,0.1)',
          color: '#22C55E', fontSize: 15, fontWeight: 700,
          cursor: exporting ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: exporting ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <Download size={18} />
        {exporting ? 'Generating PDF...' : 'Export PDF'}
      </button>
    </div>
  )
}
