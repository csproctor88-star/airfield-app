'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Mail, Loader2 } from 'lucide-react'
import { fetchAgingDiscrepanciesData, type AgingDiscrepanciesData } from '@/lib/reports/aging-discrepancies-data'
import { generateAgingDiscrepanciesPdf } from '@/lib/reports/aging-discrepancies-pdf'
import { AgingReportView, filterAging } from '@/components/reports/aging-report-view'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import PdfExportDialog from '@/components/ui/pdf-template-selector'
import { toast } from 'sonner'
import { formatZuluDateTime } from '@/lib/utils'

export default function AgingDiscrepanciesPage() {
  const router = useRouter()
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AgingDiscrepanciesData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

  // Filters — null = show all
  const [activeTierLabel, setActiveTierLabel] = useState<string | null>(null)
  const [activeShop, setActiveShop] = useState<string | null>(null)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfDialogMode, setPdfDialogMode] = useState<'download' | 'email'>('download')

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
  }, [installationId])

  // Filtered view for export — same cross-filter the AgingReportView renders
  // (shared filterAging helper), so the PDF mirrors what's on screen.
  const filteredData = useMemo(
    () => (data ? filterAging(data, activeTierLabel, activeShop) : null),
    [data, activeTierLabel, activeShop],
  )

  const hasFilters = activeTierLabel !== null || activeShop !== null

  const makePdfOpts = (columns: string[]) => ({
    generatedBy: generatorName,
    baseName: currentInstallation?.name,
    baseIcao: currentInstallation?.icao,
    selectedColumns: columns,
  })

  const handleExport = () => {
    if (!filteredData) return
    setPdfDialogMode('download')
    setPdfDialogOpen(true)
  }

  const handleEmailPdf = () => {
    if (!filteredData) return
    setPdfDialogMode('email')
    setPdfDialogOpen(true)
  }

  const handlePdfDialogExport = async (columns: string[]) => {
    if (!filteredData) return
    setExporting(true)
    const result = generateAgingDiscrepanciesPdf(filteredData, makePdfOpts(columns))
    if (pdfDialogMode === 'download') {
      result.doc.save(result.filename)
      setPdfDialogOpen(false)
    } else {
      setEmailPdfData(result)
      setPdfDialogOpen(false)
      setEmailModalOpen(true)
    }
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

  // ── Loading View ──
  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Aging Discrepancies</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader2 size={32} color="var(--color-danger)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginTop: 12 }}>Analyzing aging discrepancies...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (!data || !filteredData) return null

  const { summary: filteredSummary } = filteredData

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Aging Discrepancies</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>As of {formatZuluDateTime(new Date())}</div>
        </div>
      </div>

      {/* Results — shared with the dashboard Aging widget; filter state controlled
          here so the PDF export mirrors the on-screen cross-filter. */}
      <div style={{ marginBottom: 14 }}>
        <AgingReportView
          data={data}
          activeTierLabel={activeTierLabel}
          activeShop={activeShop}
          onTierChange={setActiveTierLabel}
          onShopChange={setActiveShop}
        />
      </div>

      {/* Generated By */}
      <div style={{ textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Generated by {generatorName}
      </div>

      {/* Export Buttons — exports filtered view */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleExport}
          disabled={exporting || filteredSummary.total === 0}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 10,
            border: '1px solid color-mix(in srgb, var(--color-success) 40%, transparent)',
            background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
            color: 'var(--color-status-pass)', fontSize: 'var(--fs-xl)', fontWeight: 700,
            cursor: (exporting || filteredSummary.total === 0) ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: (exporting || filteredSummary.total === 0) ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Download size={18} />
          {exporting ? 'Generating PDF...' : hasFilters ? 'Export Filtered PDF' : 'Export PDF'}
        </button>
        <button
          onClick={handleEmailPdf}
          disabled={exporting || filteredSummary.total === 0}
          style={{
            padding: '14px 18px', borderRadius: 10,
            border: '1px solid color-mix(in srgb, var(--color-purple) 30%, transparent)',
            background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
            color: 'var(--color-purple)', fontSize: 'var(--fs-xl)', fontWeight: 700,
            cursor: (exporting || filteredSummary.total === 0) ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: (exporting || filteredSummary.total === 0) ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Mail size={18} />
        </button>
      </div>

      <PdfExportDialog
        open={pdfDialogOpen}
        mode={pdfDialogMode}
        onClose={() => setPdfDialogOpen(false)}
        onExport={handlePdfDialogExport}
        exporting={exporting}
        disabledColumns={['photos', 'comments']}
      />

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
