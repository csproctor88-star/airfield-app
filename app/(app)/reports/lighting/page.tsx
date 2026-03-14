'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Lightbulb, Download, Mail, Loader2 } from 'lucide-react'
import { fetchLightingReportData, type LightingReportData } from '@/lib/reports/lighting-report-data'
import { generateLightingReportPdf } from '@/lib/reports/lighting-report-pdf'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { toast } from 'sonner'
import { formatZuluDateTime } from '@/lib/utils'
import { formatFeatureType } from '@/lib/supabase/infrastructure-features'
import { getAlertTier, ALERT_TIER_CONFIG } from '@/lib/outage-rules'

export default function LightingReportPage() {
  const router = useRouter()
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LightingReportData | null>(null)
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
        fetchLightingReportData(installationId),
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

  const pdfOpts = { generatedBy: generatorName, baseName: currentInstallation?.name, baseIcao: currentInstallation?.icao }

  const handleExport = async () => {
    if (!data) return
    setExporting(true)
    const { doc, filename } = generateLightingReportPdf(data, pdfOpts)
    doc.save(filename)
    setExporting(false)
  }

  const handleEmailPdf = async () => {
    if (!data) return
    setExporting(true)
    const result = generateLightingReportPdf(data, pdfOpts)
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
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Airfield Lighting Report</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader2 size={32} color="#22C55E" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginTop: 12 }}>Fetching lighting system data...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // ── Preview View ──
  if (!data) return null

  const inopPct = data.totalFeatures > 0
    ? ((data.totalInoperative / data.totalFeatures) * 100).toFixed(1)
    : '0.0'

  const typeEntries = Object.entries(data.featuresByType).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Airfield Lighting Report</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>As of {formatZuluDateTime(new Date())}</div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="card" style={{ textAlign: 'center', padding: '16px 20px', marginBottom: 12 }}>
        <Lightbulb size={28} color="#22C55E" style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-1)' }}>{data.totalFeatures}</div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>Total Features</div>
        {data.totalInoperative > 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger)', marginTop: 4, fontWeight: 600 }}>
            {data.totalInoperative} inoperative ({inopPct}%)
          </div>
        )}
        {data.totalInoperative === 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: '#22C55E', marginTop: 4, fontWeight: 600 }}>
            All features operational
          </div>
        )}
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4 }}>Generated by {generatorName}</div>
      </div>

      {/* System Health */}
      {data.systemHealths.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            System Health
          </div>
          <div className="badge-grid">
            {data.systemHealths.map((h) => {
              const tier = getAlertTier(h)
              const config = ALERT_TIER_CONFIG[tier]
              return (
                <div key={h.systemId} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: config.bg, border: `1px solid ${config.color}33`,
                  borderRadius: 8, padding: '8px 12px', minWidth: 64,
                }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: config.color }}>
                    {h.inoperativeFeatures}/{h.totalFeatures}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 2, fontWeight: 600, textAlign: 'center' }}>
                    {h.systemName}
                  </div>
                  <div style={{ fontSize: 10, color: config.color, fontWeight: 700, marginTop: 2 }}>
                    {config.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Features by Type */}
      {typeEntries.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Features by Type
          </div>
          <div className="badge-grid">
            {typeEntries.map(([type, counts]) => (
              <div key={type} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                background: counts.inop > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                border: `1px solid ${counts.inop > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
                borderRadius: 8, padding: '8px 12px', minWidth: 64,
              }}>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: counts.inop > 0 ? 'var(--color-danger)' : '#22C55E' }}>
                  {counts.inop > 0 ? `${counts.inop}/${counts.total}` : counts.total}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 2, fontWeight: 600, textAlign: 'center' }}>
                  {formatFeatureType(type)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}
