'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Download, Loader2 } from 'lucide-react'
import { fetchOpenDiscrepanciesData, type OpenDiscrepanciesData } from '@/lib/reports/open-discrepancies-data'
import { generateOpenDiscrepanciesPdf } from '@/lib/reports/open-discrepancies-pdf'
import { getInspectorName } from '@/lib/supabase/inspections'

type ViewState = 'options' | 'loading' | 'preview'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#FBBF24',
  low: '#22C55E',
}

export default function OpenDiscrepanciesPage() {
  const router = useRouter()

  const [includeNotes, setIncludeNotes] = useState(false)
  const [viewState, setViewState] = useState<ViewState>('options')
  const [data, setData] = useState<OpenDiscrepanciesData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)

  const handleGenerate = async () => {
    setViewState('loading')

    const [reportData, inspector] = await Promise.all([
      fetchOpenDiscrepanciesData(includeNotes),
      getInspectorName(),
    ])

    setData(reportData)
    setGeneratorName(inspector.name || 'Unknown')
    setViewState('preview')
  }

  const handleExport = async () => {
    if (!data) return
    setExporting(true)

    generateOpenDiscrepanciesPdf(data, {
      generatedBy: generatorName,
      includeNotes,
    })

    setExporting(false)
  }

  // ── Options View ──
  if (viewState === 'options') {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Open Discrepancies Report</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Point-in-time snapshot of all open discrepancies</div>
          </div>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
            As of: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>

          <div
            onClick={() => setIncludeNotes(!includeNotes)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', cursor: 'pointer',
            }}
          >
            <div style={{
              width: 38, height: 22, borderRadius: 11, position: 'relative',
              background: includeNotes ? '#0EA5E9' : '#334155',
              transition: 'background 0.2s',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: '#FFF', position: 'absolute', top: 2,
                left: includeNotes ? 18 : 2,
                transition: 'left 0.2s',
              }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>Include detailed notes history</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>Adds last 3 status updates per discrepancy to the PDF</div>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #FBBF24, #F97316)',
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
          <button onClick={() => setViewState('options')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Open Discrepancies Report</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader2 size={32} color="#FBBF24" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 12 }}>Fetching open discrepancy data...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── Preview View ──
  if (!data) return null

  const { summary } = data
  const severityOrder = ['critical', 'high', 'medium', 'low']
  const shopEntries = Object.entries(summary.byShop).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setViewState('options')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Open Discrepancies Report</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>As of {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* Total Count */}
      <div className="card" style={{ textAlign: 'center', padding: '16px 20px', marginBottom: 12 }}>
        <AlertTriangle size={28} color="#FBBF24" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 28, fontWeight: 800, color: '#F1F5F9' }}>{summary.total}</div>
        <div style={{ fontSize: 12, color: '#64748B' }}>Open Discrepancies</div>
        <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Generated by {generatorName}</div>
      </div>

      {/* Severity Breakdown */}
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          By Severity
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {severityOrder.map((sev) => (
            <div key={sev} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: SEVERITY_COLORS[sev] || '#94A3B8' }}>
                {summary.bySeverity[sev] || 0}
              </div>
              <div style={{ fontSize: 9, color: '#64748B', textTransform: 'capitalize' }}>{sev}</div>
            </div>
          ))}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#EF4444' }}>
              {summary.agingOver30}
            </div>
            <div style={{ fontSize: 9, color: '#64748B' }}>&gt;30 days</div>
          </div>
        </div>
      </div>

      {/* By Shop */}
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          By Shop
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {shopEntries.map(([shop, count]) => (
            <div key={shop} style={{
              padding: '4px 10px', borderRadius: 6,
              background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
              fontSize: 11, color: '#CBD5E1',
            }}>
              {shop} ({count})
            </div>
          ))}
        </div>
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
