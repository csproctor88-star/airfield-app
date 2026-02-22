'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileText, Download, Calendar, Loader2 } from 'lucide-react'
import { fetchDailyReportData, type DailyReportData } from '@/lib/reports/daily-ops-data'
import { generateDailyOpsPdf } from '@/lib/reports/daily-ops-pdf'
import { getInspectorName } from '@/lib/supabase/inspections'

type DateMode = 'single' | 'range'
type ViewState = 'picker' | 'loading' | 'preview'

const CHECK_TYPE_LABELS: Record<string, string> = {
  fod: 'FOD',
  rsc: 'RSC',
  rcr: 'RCR',
  bash: 'BASH',
  ife: 'In-Flight Emergency',
  ground_emergency: 'Ground Emergency',
  heavy_aircraft: 'Heavy Aircraft',
}

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  airfield: 'Airfield',
  lighting: 'Lighting',
  construction_meeting: 'Construction Meeting',
  joint_monthly: 'Joint Monthly',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function DailyOpsPage() {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [dateMode, setDateMode] = useState<DateMode>('single')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [viewState, setViewState] = useState<ViewState>('picker')
  const [data, setData] = useState<DailyReportData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)

  const handleGenerate = async () => {
    setViewState('loading')

    // Convert local dates to UTC boundaries
    const start = new Date(`${startDate}T00:00:00`)
    const end = dateMode === 'range'
      ? new Date(`${endDate}T23:59:59.999`)
      : new Date(`${startDate}T23:59:59.999`)
    const startUTC = start.toISOString()
    const endUTC = end.toISOString()

    const [reportData, inspector] = await Promise.all([
      fetchDailyReportData(startUTC, endUTC),
      getInspectorName(),
    ])

    setData(reportData)
    setGeneratorName(inspector.name || 'Unknown')
    setViewState('preview')
  }

  const handleExport = async () => {
    if (!data) return
    setExporting(true)

    const effectiveEnd = dateMode === 'range' ? endDate : startDate
    generateDailyOpsPdf(data, {
      startDate,
      endDate: effectiveEnd,
      isRange: dateMode === 'range',
      generatedBy: generatorName,
    })

    setExporting(false)
  }

  const dateLabel = dateMode === 'range' && startDate !== endDate
    ? `${formatDate(startDate)} — ${formatDate(endDate)}`
    : formatDate(startDate)

  // ── Picker View ──
  if (viewState === 'picker') {
    return (
      <div style={{ padding: 16, paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Daily Operations Summary</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Select a date to generate the report</div>
          </div>
        </div>

        {/* Date Mode Toggle */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155', marginBottom: 14 }}>
          {(['single', 'range'] as DateMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setDateMode(mode)}
              style={{
                flex: 1, padding: '10px 0', border: 'none',
                background: dateMode === mode ? '#0EA5E9' : 'transparent',
                color: dateMode === mode ? '#FFF' : '#94A3B8',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {mode === 'single' ? 'Single Date' : 'Date Range'}
            </button>
          ))}
        </div>

        {/* Date Inputs */}
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Calendar size={16} color="#0EA5E9" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>
              {dateMode === 'single' ? 'Date' : 'Start Date'}
            </span>
          </div>
          <input
            type="date"
            value={startDate}
            max={today}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (dateMode === 'single') setEndDate(e.target.value)
            }}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid #334155', background: '#0F172A', color: '#F1F5F9',
              fontSize: 14, fontFamily: 'inherit',
            }}
          />

          {dateMode === 'range' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 14 }}>
                <Calendar size={16} color="#0EA5E9" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>End Date</span>
              </div>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={today}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #334155', background: '#0F172A', color: '#F1F5F9',
                  fontSize: 14, fontFamily: 'inherit',
                }}
              />
            </>
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #0EA5E9, #22D3EE)',
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
          <button onClick={() => setViewState('picker')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Daily Operations Summary</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader2 size={32} color="#0EA5E9" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 12 }}>Fetching report data for {dateLabel}...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── Preview View ──
  if (!data) return null

  const sections = [
    {
      label: 'Inspections',
      count: data.inspections.length,
      detail: data.inspections.length > 0
        ? data.inspections.map((i) => INSPECTION_TYPE_LABELS[i.inspection_type] || i.inspection_type).join(', ')
        : 'No inspections recorded',
      color: '#34D399',
      hasFailures: data.inspections.some((i) => i.failed_count > 0),
    },
    {
      label: 'Checks Completed',
      count: data.checks.length,
      detail: data.checks.length > 0
        ? data.checks.map((c) => CHECK_TYPE_LABELS[c.check_type] || c.check_type).join(', ')
        : 'No checks recorded',
      color: '#0EA5E9',
    },
    {
      label: 'Status History',
      count: (() => {
        let count = 0
        for (const r of data.runwayChanges) {
          if (r.new_runway_status) count++
          if (r.old_active_runway !== r.new_active_runway) count++
          if (r.old_advisory_type !== r.new_advisory_type || r.old_advisory_text !== r.new_advisory_text) count++
        }
        count += data.inspections.filter((i) => i.bwc_value).length
        count += data.checks.filter((c) => c.check_type === 'rsc').length
        return count
      })(),
      detail: (() => {
        const parts: string[] = []
        const rwEntries = data.runwayChanges.filter((r) => r.new_runway_status)
        if (rwEntries.length > 0) parts.push(`${rwEntries.length} runway`)
        const rwChanges = data.runwayChanges.filter((r) => r.old_active_runway !== r.new_active_runway)
        if (rwChanges.length > 0) parts.push(`${rwChanges.length} active RWY`)
        const advChanges = data.runwayChanges.filter((r) => r.old_advisory_type !== r.new_advisory_type || r.old_advisory_text !== r.new_advisory_text)
        if (advChanges.length > 0) parts.push(`${advChanges.length} advisory`)
        const bwcEntries = data.inspections.filter((i) => i.bwc_value).length
        if (bwcEntries > 0) parts.push(`${bwcEntries} BWC`)
        const rscEntries = data.checks.filter((c) => c.check_type === 'rsc').length
        if (rscEntries > 0) parts.push(`${rscEntries} RSC`)
        return parts.length > 0 ? parts.join(', ') : 'No status changes'
      })(),
      color: '#A78BFA',
    },
    {
      label: 'New Discrepancies',
      count: data.newDiscrepancies.length,
      detail: data.newDiscrepancies.length > 0
        ? `${data.newDiscrepancies.length} reported`
        : 'No new discrepancies',
      color: '#EF4444',
    },
    {
      label: 'Discrepancy Updates',
      count: data.statusUpdates.length,
      detail: data.statusUpdates.length > 0
        ? (() => {
            const uniqueDiscs = new Set(data.statusUpdates.map((u) => u.discrepancy_id))
            return `${data.statusUpdates.length} update${data.statusUpdates.length !== 1 ? 's' : ''} across ${uniqueDiscs.size} discrepanc${uniqueDiscs.size !== 1 ? 'ies' : 'y'}`
          })()
        : 'No updates',
      color: '#F97316',
    },
    {
      label: 'Obstruction Evaluations',
      count: data.obstructionEvals.length,
      detail: data.obstructionEvals.length > 0
        ? (() => {
            const violations = data.obstructionEvals.filter((e) => e.has_violation).length
            return violations > 0
              ? `${data.obstructionEvals.length} evaluated, ${violations} violation${violations !== 1 ? 's' : ''}`
              : `${data.obstructionEvals.length} evaluated, all clear`
          })()
        : 'No evaluations recorded',
      color: '#FBBF24',
    },
  ]

  return (
    <div style={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setViewState('picker')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Daily Operations Summary</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{dateLabel}</div>
        </div>
      </div>

      {/* Report Icon */}
      <div className="card" style={{ textAlign: 'center', padding: '16px 20px', marginBottom: 12 }}>
        <FileText size={28} color="#0EA5E9" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Report Preview</div>
        <div style={{ fontSize: 11, color: '#64748B' }}>Generated by {generatorName}</div>
      </div>

      {/* Section Summary Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {sections.map((s) => (
          <div
            key={s.label}
            className="card"
            style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: `${s.color}14`, border: `1px solid ${s.color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: s.color,
            }}>
              {s.count}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>{s.detail}</div>
            </div>
          </div>
        ))}
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
