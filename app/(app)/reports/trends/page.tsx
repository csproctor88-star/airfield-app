'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Download, Mail, Loader2 } from 'lucide-react'
import { fetchDiscrepancyTrendsData, type DiscrepancyTrendsData, type TrendPeriod } from '@/lib/reports/discrepancy-trends-data'
import { generateDiscrepancyTrendsPdf } from '@/lib/reports/discrepancy-trends-pdf'
import { TrendsReportView } from '@/components/reports/trends-report-view'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { toast } from 'sonner'

type ViewState = 'picker' | 'loading' | 'preview'

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
]

export default function DiscrepancyTrendsPage() {
  const router = useRouter()
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()

  const [period, setPeriod] = useState<TrendPeriod>('30d')
  const [viewState, setViewState] = useState<ViewState>('picker')
  const [data, setData] = useState<DiscrepancyTrendsData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

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

  const pdfOpts = { generatedBy: generatorName, baseName: currentInstallation?.name, baseIcao: currentInstallation?.icao }

  const handleExport = async () => {
    if (!data) return
    setExporting(true)
    const { doc, filename } = generateDiscrepancyTrendsPdf(data, pdfOpts)
    doc.save(filename)
    setExporting(false)
  }

  const handleEmailPdf = async () => {
    if (!data) return
    setExporting(true)
    const result = generateDiscrepancyTrendsPdf(data, pdfOpts)
    setEmailPdfData(result)
    setEmailModalOpen(true)
    setExporting(false)
  }

  const handleSendEmail = async (email: string) => {
    if (!emailPdfData) return
    setSendingEmail(true)
    const result = await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, `Report: ${emailPdfData.filename.replace(/_/g, ' ').replace('.pdf', '')}`)
    if (result.success) {
      toast.success('Email sent successfully')
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } else {
      toast.error(result.error || 'Failed to send email')
    }
    setSendingEmail(false)
  }

  // ── Picker View ──
  if (viewState === 'picker') {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Discrepancy Trends</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>Select a time period</div>
          </div>
        </div>

        {/* Period Selector — outlined-pill cluster */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {PERIODS.map((p) => {
            const selected = period === p.value
            return (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
                  border: selected ? '1px solid var(--color-purple)' : '1px solid var(--color-border)',
                  background: selected
                    ? 'color-mix(in srgb, var(--color-purple) 14%, var(--color-bg-surface))'
                    : 'var(--color-bg-inset)',
                  color: selected ? 'var(--color-purple)' : 'var(--color-text-2)',
                  fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <button
          onClick={handleGenerate}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
            background: 'var(--color-purple)',
            color: '#fff', fontSize: 'var(--fs-xl)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => setViewState('picker')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Discrepancy Trends</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader2 size={32} color="var(--color-purple)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginTop: 12 }}>Analyzing discrepancy trends...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── Preview View ──
  if (!data) return null

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setViewState('picker')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Discrepancy Trends</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{data.periodLabel}</div>
        </div>
      </div>

      {/* Results — shared with the dashboard Trends widget */}
      <div style={{ marginBottom: 14 }}>
        <TrendsReportView data={data} />
      </div>

      {/* Generated By */}
      <div style={{ textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Generated by {generatorName}
      </div>

      {/* Export Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 10,
            border: '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)',
            background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
            color: 'var(--color-status-pass)', fontSize: 'var(--fs-xl)', fontWeight: 700,
            cursor: exporting ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: exporting ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Download size={18} />
          {exporting ? 'Generating PDF...' : 'Export PDF'}
        </button>
        <button
          onClick={handleEmailPdf}
          disabled={exporting}
          style={{
            padding: '14px 18px', borderRadius: 10,
            border: '1px solid color-mix(in srgb, var(--color-purple) 30%, transparent)',
            background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
            color: 'var(--color-purple)', fontSize: 'var(--fs-xl)', fontWeight: 700,
            cursor: exporting ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: exporting ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Mail size={18} />
        </button>
      </div>

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}
