'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Download, Mail, Loader2 } from 'lucide-react'
import { fetchOpenDiscrepanciesData, formatDiscrepancyType, type OpenDiscrepanciesData } from '@/lib/reports/open-discrepancies-data'
import { generateOpenDiscrepanciesPdf } from '@/lib/reports/open-discrepancies-pdf'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { toast } from 'sonner'

export default function OpenDiscrepanciesPage() {
  const router = useRouter()
  const { installationId, currentInstallation } = useInstallation()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<OpenDiscrepanciesData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function generate() {
      const [reportData, inspector] = await Promise.all([
        fetchOpenDiscrepanciesData(true, installationId),
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

  const pdfOpts = { generatedBy: generatorName, baseName: currentInstallation?.name, baseIcao: currentInstallation?.icao }

  const handleExport = async () => {
    if (!data) return
    setExporting(true)
    const { doc, filename } = generateOpenDiscrepanciesPdf(data, pdfOpts)
    doc.save(filename)
    setExporting(false)
  }

  const handleEmailPdf = async () => {
    if (!data) return
    setExporting(true)
    const result = generateOpenDiscrepanciesPdf(data, pdfOpts)
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

  // ── Loading View ──
  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Discrepancy Report</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader2 size={32} color="var(--color-warning)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginTop: 12 }}>Fetching open discrepancy data...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── Preview View ──
  if (!data) return null

  const { summary } = data
  const areaEntries = Object.entries(summary.byArea).sort((a, b) => b[1] - a[1])
  const typeEntries = Object.entries(summary.byType).sort((a, b) => b[1] - a[1])

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Discrepancy Report</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>As of {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* Total Count */}
      <div className="card" style={{ textAlign: 'center', padding: '16px 20px', marginBottom: 12 }}>
        <AlertTriangle size={28} color="var(--color-warning)" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-1)' }}>{summary.total}</div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Open Discrepancies</div>
        {summary.agingOver30 > 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger)', marginTop: 4, fontWeight: 600 }}>
            {summary.agingOver30} open &gt; 30 days
          </div>
        )}
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4 }}>Generated by {generatorName}</div>
      </div>

      {/* By Area — KPI badges */}
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          By Area
        </div>
        <div className="badge-grid">
          {areaEntries.map(([area, count]) => (
            <div key={area} className="kpi-badge" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
              minWidth: 64,
            }}>
              <div className="kpi-value" style={{ color: 'var(--color-accent)' }}>{count}</div>
              <div className="kpi-label" style={{ color: 'var(--color-text-2)', marginTop: 2 }}>{area}</div>
            </div>
          ))}
        </div>
      </div>

      {/* By Type — KPI badges */}
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          By Type
        </div>
        <div className="badge-grid">
          {typeEntries.map(([type, count]) => (
            <div key={type} className="kpi-badge" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)',
              minWidth: 64,
            }}>
              <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{count}</div>
              <div className="kpi-label" style={{ color: 'var(--color-text-2)', marginTop: 2 }}>{formatDiscrepancyType(type)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 10,
            border: '1px solid rgba(34,197,94,0.4)',
            background: 'rgba(34,197,94,0.1)',
            color: '#22C55E', fontSize: 'var(--fs-xl)', fontWeight: 700,
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
            border: '1px solid #A78BFA33',
            background: '#A78BFA14',
            color: '#A78BFA', fontSize: 'var(--fs-xl)', fontWeight: 700,
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
      />
    </div>
  )
}
