'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Download, Loader2 } from 'lucide-react'
import { fetchAgingDiscrepanciesData, type AgingDiscrepanciesData } from '@/lib/reports/aging-discrepancies-data'
import { generateAgingDiscrepanciesPdf } from '@/lib/reports/aging-discrepancies-pdf'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  no: 'None',
}

export default function AgingDiscrepanciesPage() {
  const router = useRouter()
  const { installationId } = useInstallation()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AgingDiscrepanciesData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function generate() {
      const [reportData, inspector] = await Promise.all([
        fetchAgingDiscrepanciesData(installationId),
        getInspectorName(),
      ])
      if (cancelled) return
      setData(reportData)
      setGeneratorName(inspector.name || 'Unknown')
      setLoading(false)
    }
    generate()
    return () => { cancelled = true }
  }, [])

  const handleExport = async () => {
    if (!data) return
    setExporting(true)
    generateAgingDiscrepanciesPdf(data, { generatedBy: generatorName })
    setExporting(false)
  }

  // ── Loading View ──
  if (loading) {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Aging Discrepancies</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader2 size={32} color="var(--color-danger)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 12 }}>Analyzing aging discrepancies...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── Preview View ──
  if (!data) return null

  const { tiers, summary } = data
  const activeTiers = tiers.filter((t) => t.discrepancies.length > 0)
  const sevEntries = Object.entries(summary.bySeverity).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Aging Discrepancies</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>As of {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-1)' }}>{summary.total}</div>
          <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600 }}>Total Open</div>
        </div>
        {summary.avgDaysOpen !== null && (
          <div className="card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-warning)' }}>{summary.avgDaysOpen}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600 }}>Avg Days</div>
          </div>
        )}
        {summary.oldest && (
          <div className="card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-danger)' }}>{summary.oldest.days_open}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600 }}>Oldest</div>
          </div>
        )}
      </div>

      {/* Aging Tier Badges */}
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          By Aging Tier
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tiers.map((tier) => (
            <div key={tier.label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '8px 14px', borderRadius: 10,
              background: `${tier.color}14`, border: `1px solid ${tier.color}33`,
              minWidth: 64, opacity: tier.discrepancies.length === 0 ? 0.4 : 1,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: tier.color }}>{tier.discrepancies.length}</div>
              <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{tier.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* By Severity */}
      {sevEntries.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            By Severity
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sevEntries.map(([sev, count]) => {
              const sevColor = sev === 'critical' ? '#DC2626' : sev === 'high' ? '#EF4444' : sev === 'medium' ? '#FBBF24' : '#22C55E'
              return (
                <div key={sev} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '8px 14px', borderRadius: 10,
                  background: `${sevColor}14`, border: `1px solid ${sevColor}33`,
                  minWidth: 64,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: sevColor }}>{count}</div>
                  <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{SEVERITY_LABELS[sev] || sev}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* By Shop */}
      {summary.byShop.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            By Shop
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {summary.byShop.map((s) => (
              <div key={s.shop} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 14px', borderRadius: 10,
                background: 'var(--color-border)', border: '1px solid rgba(56,189,248,0.15)',
                minWidth: 64,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent)' }}>{s.count}</div>
                <div style={{ fontSize: 9, color: 'var(--color-text-2)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{s.shop}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item List per active tier */}
      {activeTiers.map((tier) => (
        <div key={tier.label} className="card" style={{ padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, color: tier.color }}>
            {tier.label} ({tier.discrepancies.length})
          </div>
          {tier.discrepancies.map((d) => (
            <div key={d.id} style={{
              padding: '6px 0',
              borderBottom: '1px solid rgba(148,163,184,0.1)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-1)' }}>
                  {d.display_id} — {d.title}
                </div>
                <div style={{ fontSize: 9, color: 'var(--color-text-3)' }}>
                  {d.location_text} · {d.assigned_shop || 'Unassigned'}
                </div>
              </div>
              <div style={{
                fontSize: 12, fontWeight: 800, color: tier.color,
                minWidth: 40, textAlign: 'right',
              }}>
                {d.days_open}d
              </div>
            </div>
          ))}
        </div>
      ))}

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
