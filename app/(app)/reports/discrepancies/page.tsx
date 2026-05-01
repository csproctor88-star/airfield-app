'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Mail, Loader2, Filter } from 'lucide-react'
import { fetchOpenDiscrepanciesData, formatDiscrepancyType, type OpenDiscrepanciesData, type DiscrepancyReportFilters } from '@/lib/reports/open-discrepancies-data'
import { generateOpenDiscrepanciesPdf } from '@/lib/reports/open-discrepancies-pdf'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import { DISCREPANCY_TYPES, CURRENT_STATUS_OPTIONS } from '@/lib/constants'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import PdfExportDialog from '@/components/ui/pdf-template-selector'
import { toast } from 'sonner'

export default function DiscrepancyReportPage() {
  const router = useRouter()
  const { installationId, currentInstallation, defaultPdfEmail, ceShops, areas } = useInstallation()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OpenDiscrepanciesData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('open')
  const [currentStatusFilter, setCurrentStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [shopFilter, setShopFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [pdfDialogMode, setPdfDialogMode] = useState<'download' | 'email'>('download')

  // Load generator name on mount
  useEffect(() => {
    getInspectorName().then(r => setGeneratorName(r.name || 'Unknown'))
  }, [])

  const filters: DiscrepancyReportFilters = useMemo(() => ({
    status: statusFilter,
    currentStatus: currentStatusFilter,
    type: typeFilter,
    shop: shopFilter,
    location: locationFilter,
  }), [statusFilter, currentStatusFilter, typeFilter, shopFilter, locationFilter])

  // Build a label describing the active filters
  const filterLabel = useMemo(() => {
    const parts: string[] = []
    if (statusFilter !== 'all') {
      parts.push(statusFilter === 'open' ? 'Open' : statusFilter === 'completed' ? 'Completed' : 'Cancelled')
    } else {
      parts.push('All')
    }
    if (currentStatusFilter !== 'all') {
      const opt = CURRENT_STATUS_OPTIONS.find(o => o.value === currentStatusFilter)
      parts.push(opt?.label || currentStatusFilter)
    }
    if (typeFilter !== 'all') {
      const t = DISCREPANCY_TYPES.find(d => d.value === typeFilter)
      parts.push(t?.label || typeFilter)
    }
    if (shopFilter !== 'all') parts.push(shopFilter)
    if (locationFilter !== 'all') parts.push(locationFilter)
    return parts.join(' / ')
  }, [statusFilter, currentStatusFilter, typeFilter, shopFilter, locationFilter])

  const hasActiveFilters = currentStatusFilter !== 'all' || typeFilter !== 'all' || shopFilter !== 'all' || locationFilter !== 'all' || statusFilter !== 'open'

  const clearFilters = () => {
    setStatusFilter('open')
    setCurrentStatusFilter('all')
    setTypeFilter('all')
    setShopFilter('all')
    setLocationFilter('all')
    setData(null)
  }

  // Generate report
  const generateReport = async () => {
    setLoading(true)
    const reportData = await fetchOpenDiscrepanciesData(true, installationId, filters)
    setData(reportData)
    setLoading(false)
  }

  const makePdfOpts = (columns: string[]) => ({
    generatedBy: generatorName,
    baseName: currentInstallation?.name,
    baseIcao: currentInstallation?.icao,
    selectedColumns: columns,
  })

  const handleExportPdf = () => {
    if (!data) return
    setPdfDialogMode('download')
    setPdfDialogOpen(true)
  }

  const handleEmailPdf = () => {
    if (!data) return
    setPdfDialogMode('email')
    setPdfDialogOpen(true)
  }

  const handlePdfDialogExport = async (columns: string[]) => {
    if (!data) return
    setExporting(true)
    const result = generateOpenDiscrepanciesPdf(data, makePdfOpts(columns))
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

  // Export all open (quick one-click — uses all columns for backward compat)
  const handleExportAllOpen = async () => {
    setExporting(true)
    const reportData = await fetchOpenDiscrepanciesData(true, installationId, { status: 'open' })
    const { doc, filename } = generateOpenDiscrepanciesPdf(reportData, makePdfOpts([]))
    doc.save(filename)
    setExporting(false)
  }

  // Summary lines from loaded data
  const summary = data?.summary

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-3)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block',
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Discrepancy Report</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
            {currentInstallation?.name} ({currentInstallation?.icao})
          </div>
        </div>
      </div>

      {/* Quick Export */}
      <button
        onClick={handleExportAllOpen}
        disabled={exporting}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 8, marginBottom: 14,
          border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
          background: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
          color: 'var(--color-status-pass)', fontSize: 'var(--fs-md)', fontWeight: 700,
          cursor: exporting ? 'default' : 'pointer', fontFamily: 'inherit',
          opacity: exporting ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <Download size={16} />
        {exporting ? 'Generating...' : 'Export All Open Discrepancies'}
      </button>

      {/* Filter Card */}
      <div className="card" style={{ padding: 14, marginBottom: 14, borderLeft: '3px solid var(--color-cyan)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={14} color="var(--color-text-3)" />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)' }}>Build Custom Report</span>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{
              background: 'none', border: 'none', color: 'var(--color-text-3)',
              fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
            }}>
              Reset
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* Status */}
          <div>
            <span style={labelStyle}>Status</span>
            <select style={selectStyle} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setData(null) }}>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Current Status */}
          <div>
            <span style={labelStyle}>Workflow Status</span>
            <select style={selectStyle} value={currentStatusFilter} onChange={e => { setCurrentStatusFilter(e.target.value); setData(null) }}>
              <option value="all">All</option>
              {CURRENT_STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <span style={labelStyle}>Type</span>
            <select style={selectStyle} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setData(null) }}>
              <option value="all">All Types</option>
              {DISCREPANCY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Shop */}
          <div>
            <span style={labelStyle}>Assigned Shop</span>
            <select style={selectStyle} value={shopFilter} onChange={e => { setShopFilter(e.target.value); setData(null) }}>
              <option value="all">All Shops</option>
              {ceShops.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div style={{ gridColumn: 'span 2' }}>
            <span style={labelStyle}>Location</span>
            <select style={selectStyle} value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setData(null) }}>
              <option value="all">All Locations</option>
              {areas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateReport}
          disabled={loading}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8, marginTop: 12,
            border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
            background: 'color-mix(in srgb, var(--color-cyan) 8%, transparent)',
            color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 700,
            cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Loading...' : 'Generate Report Preview'}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <Loader2 size={28} color="var(--color-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 8 }}>Fetching discrepancies...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {!loading && data && summary && (
        <>
          {/* Count + filter label */}
          <div className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>{summary.total}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>discrepancies</span>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              {filterLabel}
            </div>
            {summary.agingOver30 > 0 && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', fontWeight: 600, marginTop: 4 }}>
                {summary.agingOver30} open &gt; 30 days
              </div>
            )}
          </div>

          {/* Summary lines */}
          <div className="card" style={{ padding: 14, marginBottom: 10, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
            {Object.entries(summary.byArea).length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-3)', marginRight: 6 }}>By Area:</span>
                {Object.entries(summary.byArea).sort((a, b) => b[1] - a[1]).map(([area, count]) => `${area} (${count})`).join(', ')}
              </div>
            )}
            {Object.entries(summary.byType).length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-3)', marginRight: 6 }}>By Type:</span>
                {Object.entries(summary.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => `${formatDiscrepancyType(type)} (${count})`).join(', ')}
              </div>
            )}
            {Object.entries(summary.byShop).length > 0 && (
              <div>
                <span style={{ fontWeight: 700, color: 'var(--color-text-3)', marginRight: 6 }}>By Shop:</span>
                {Object.entries(summary.byShop).sort((a, b) => b[1] - a[1]).map(([shop, count]) => `${shop} (${count})`).join(', ')}
              </div>
            )}
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleExportPdf}
              disabled={exporting || summary.total === 0}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--color-purple) 30%, transparent)',
                background: 'color-mix(in srgb, var(--color-purple) 8%, transparent)',
                color: 'var(--color-purple)', fontSize: 'var(--fs-md)', fontWeight: 700,
                cursor: (exporting || summary.total === 0) ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: (exporting || summary.total === 0) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Download size={16} />
              {exporting ? 'Generating...' : 'Export PDF'}
            </button>
            <button
              onClick={handleEmailPdf}
              disabled={exporting || summary.total === 0}
              style={{
                padding: '12px 16px', borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--color-purple) 30%, transparent)',
                background: 'color-mix(in srgb, var(--color-purple) 8%, transparent)',
                color: 'var(--color-purple)', fontSize: 'var(--fs-md)', fontWeight: 700,
                cursor: (exporting || summary.total === 0) ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: (exporting || summary.total === 0) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Mail size={16} />
            </button>
          </div>
        </>
      )}

      <PdfExportDialog
        open={pdfDialogOpen}
        mode={pdfDialogMode}
        onClose={() => setPdfDialogOpen(false)}
        onExport={handlePdfDialogExport}
        exporting={exporting}
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
