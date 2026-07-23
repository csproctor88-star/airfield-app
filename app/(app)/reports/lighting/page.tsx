'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Mail, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { fetchLightingReportData, type LightingReportData } from '@/lib/reports/lighting-report-data'
import { generateLightingReportPdf } from '@/lib/reports/lighting-report-pdf'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'
import { getLightingCompliance } from '@/lib/airport-mode'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { toast } from 'sonner'
import { formatZuluDateTime } from '@/lib/utils'
import { formatFeatureType } from '@/lib/supabase/infrastructure-features'
import { getAlertTier, ALERT_TIER_CONFIG, type SystemHealth } from '@/lib/outage-rules'

const TIER_ORDER: Record<string, number> = { black: 0, red: 1, yellow: 2, green: 3 }

export default function LightingReportPage() {
  const router = useRouter()
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()
  const lightingStandard = getLightingCompliance(currentInstallation).standard

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LightingReportData | null>(null)
  const [generatorName, setGeneratorName] = useState<string>('Unknown')
  const [exporting, setExporting] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

  // UI state
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set())
  const [selectedSystem, setSelectedSystem] = useState('__all')
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'inop'>('status')

  useEffect(() => {
    let cancelled = false
    async function generate() {
      const [reportData, inspector] = await Promise.all([
        fetchLightingReportData(installationId, lightingStandard),
        getInspectorName(),
      ])
      if (cancelled) return
      setData(reportData)
      setGeneratorName(inspector.name || 'Unknown')
      setLoading(false)
    }
    generate()
    return () => { cancelled = true }
  }, [installationId, lightingStandard])

  const toggleExpand = (systemId: string) => {
    setExpandedSystems(prev => {
      const next = new Set(prev)
      if (next.has(systemId)) next.delete(systemId)
      else next.add(systemId)
      return next
    })
  }

  // Sorted system healths
  const sortedSystems = useMemo(() => {
    if (!data) return []
    const systems = [...data.systemHealths]
    if (sortBy === 'status') {
      systems.sort((a, b) => {
        const ta = TIER_ORDER[getAlertTier(a)] ?? 9
        const tb = TIER_ORDER[getAlertTier(b)] ?? 9
        return ta - tb || a.systemName.localeCompare(b.systemName)
      })
    } else if (sortBy === 'inop') {
      systems.sort((a, b) => b.inoperativeFeatures - a.inoperativeFeatures)
    } else {
      systems.sort((a, b) => a.systemName.localeCompare(b.systemName))
    }
    return systems
  }, [data, sortBy])

  const pdfOpts = { generatedBy: generatorName, baseName: currentInstallation?.name, baseIcao: currentInstallation?.icao }

  // Filter data for export
  const buildFilteredData = (filter: 'all' | 'outages' | string): LightingReportData => {
    if (!data) return { totalFeatures: 0, totalInoperative: 0, systemHealths: [], featuresByType: {}, featuresByLayer: {}, recentOutageEvents: [] }

    if (filter === 'all') return data

    if (filter === 'outages') {
      const filtered = data.systemHealths.filter(h => h.inoperativeFeatures > 0)
      return { ...data, systemHealths: filtered }
    }

    // Single system
    const filtered = data.systemHealths.filter(h => h.systemId === filter)
    return { ...data, systemHealths: filtered }
  }

  const handleExportPdf = async (filter: 'all' | 'outages' | string = 'all') => {
    if (!data) return
    setExporting(true)
    const filtered = buildFilteredData(filter)
    const { doc, filename } = generateLightingReportPdf(filtered, pdfOpts)
    doc.save(filename)
    setExporting(false)
  }

  const handleEmailPdf = async (filter: 'all' | 'outages' | string = 'all') => {
    if (!data) return
    setExporting(true)
    const filtered = buildFilteredData(filter)
    const result = generateLightingReportPdf(filtered, pdfOpts)
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
          <Loader2 size={32} color="var(--color-status-pass)" style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginTop: 12 }}>Fetching lighting system data...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  if (!data) return null

  const inopPct = data.totalFeatures > 0
    ? ((data.totalInoperative / data.totalFeatures) * 100).toFixed(1)
    : '0.0'

  const outageCount = data.systemHealths.filter(h => h.inoperativeFeatures > 0).length
  const typeEntries = Object.entries(data.featuresByType).sort((a, b) => b[1].total - a[1].total)

  const sortBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    border: active ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
    background: active
      ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
      : 'var(--color-bg-inset)',
    color: active ? 'var(--color-cyan)' : 'var(--color-text-3)',
  })

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', color: 'var(--color-text-2)', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Airfield Lighting Report</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
            {currentInstallation?.name} ({currentInstallation?.icao}) — {formatZuluDateTime(new Date())}
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div className="card" style={{
          flex: 1, padding: '10px 14px', textAlign: 'center',
          borderTop: '3px solid var(--color-text-3)',
        }}>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>{data.totalFeatures}</div>
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>TOTAL</div>
        </div>
        <div className="card" style={{
          flex: 1, padding: '10px 14px', textAlign: 'center',
          borderTop: `3px solid ${data.totalInoperative > 0 ? 'var(--color-danger)' : 'var(--color-status-pass)'}`,
        }}>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: data.totalInoperative > 0 ? 'var(--color-danger)' : 'var(--color-status-pass)' }}>
            {data.totalInoperative}
          </div>
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>INOP ({inopPct}%)</div>
        </div>
        <div className="card" style={{
          flex: 1, padding: '10px 14px', textAlign: 'center',
          borderTop: `3px solid ${outageCount > 0 ? 'var(--color-orange)' : 'var(--color-status-pass)'}`,
        }}>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: outageCount > 0 ? 'var(--color-orange)' : 'var(--color-status-pass)' }}>
            {outageCount}
          </div>
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontWeight: 600 }}>SYSTEMS W/ OUTAGES</div>
        </div>
      </div>

      {/* System Health Table */}
      {sortedSystems.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)' }}>
              System Health ({sortedSystems.length})
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button style={sortBtnStyle(sortBy === 'status')} onClick={() => setSortBy('status')}>Status</button>
              <button style={sortBtnStyle(sortBy === 'name')} onClick={() => setSortBy('name')}>Name</button>
              <button style={sortBtnStyle(sortBy === 'inop')} onClick={() => setSortBy('inop')}>Inop</button>
            </div>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '24px 1fr 70px 50px 50px',
            padding: '6px 14px', fontSize: 'var(--fs-2xs)', fontWeight: 700,
            color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <span />
            <span>System</span>
            <span style={{ textAlign: 'center' }}>Tier</span>
            <span style={{ textAlign: 'center' }}>Inop</span>
            <span style={{ textAlign: 'center' }}>Total</span>
          </div>

          {/* System rows */}
          {sortedSystems.map(h => {
            const tier = getAlertTier(h)
            const config = ALERT_TIER_CONFIG[tier]
            const expanded = expandedSystems.has(h.systemId)
            const hasComponents = h.components && h.components.length > 0

            return (
              <div key={h.systemId}>
                <div
                  onClick={() => hasComponents && toggleExpand(h.systemId)}
                  style={{
                    display: 'grid', gridTemplateColumns: '24px 1fr 70px 50px 50px',
                    padding: '8px 14px', fontSize: 'var(--fs-sm)',
                    borderBottom: '1px solid var(--color-border)',
                    cursor: hasComponents ? 'pointer' : 'default',
                    background: expanded ? 'var(--color-bg-inset)' : 'transparent',
                  }}
                >
                  <span style={{ color: 'var(--color-text-3)', display: 'flex', alignItems: 'center' }}>
                    {hasComponents ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.systemName}
                  </span>
                  <span style={{
                    textAlign: 'center', fontWeight: 700, fontSize: 'var(--fs-xs)',
                    color: config.color,
                  }}>
                    {config.label}
                  </span>
                  <span style={{
                    textAlign: 'center', fontWeight: 700,
                    color: h.inoperativeFeatures > 0 ? 'var(--color-danger)' : 'var(--color-text-3)',
                  }}>
                    {h.inoperativeFeatures}
                  </span>
                  <span style={{ textAlign: 'center', color: 'var(--color-text-3)' }}>
                    {h.totalFeatures}
                  </span>
                </div>

                {/* Expanded component detail */}
                {expanded && h.components && h.components.length > 0 && (
                  <div style={{
                    padding: '4px 14px 8px 38px', borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-bg-inset)',
                  }}>
                    {h.components.map((c, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '3px 0', fontSize: 'var(--fs-xs)',
                        borderBottom: i < h.components.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}>
                        <span style={{ color: 'var(--color-text-2)' }}>{c.componentLabel}</span>
                        <span style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                          <span style={{
                            color: c.inoperativeCount > 0 ? 'var(--color-danger)' : 'var(--color-text-3)',
                            fontWeight: c.inoperativeCount > 0 ? 700 : 400,
                          }}>
                            {c.inoperativeCount}/{c.totalCount}
                          </span>
                          <span style={{
                            fontSize: 'var(--fs-2xs)', fontWeight: 600,
                            color: c.isExceeded ? 'var(--color-danger)' : c.isApproaching ? 'var(--color-warning)' : 'var(--color-status-pass)',
                          }}>
                            {c.isExceeded ? 'EXCEEDED' : c.isApproaching ? 'APPROACHING' : 'OK'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Features by Type — compact table */}
      {typeEntries.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)' }}>
              Features by Type
            </span>
          </div>
          {typeEntries.map(([type, counts], i) => (
            <div key={type} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 14px', fontSize: 'var(--fs-sm)',
              borderBottom: i < typeEntries.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <span style={{ color: 'var(--color-text-1)' }}>{formatFeatureType(type)}</span>
              <span style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                {counts.inop > 0 && (
                  <span style={{ color: 'var(--color-danger)', fontWeight: 700, fontSize: 'var(--fs-xs)' }}>
                    {counts.inop} inop
                  </span>
                )}
                <span style={{ color: 'var(--color-text-3)', minWidth: 30, textAlign: 'right' }}>{counts.total}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Export Section */}
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 10 }}>
          Export Reports
        </div>

        {/* Export All */}
        <ExportRow
          label="All Systems Status"
          desc={`${sortedSystems.length} systems, ${data.totalFeatures} features`}
          onPdf={() => handleExportPdf('all')}
          onEmail={() => handleEmailPdf('all')}
          exporting={exporting}
        />

        {/* Export Outages Only */}
        {outageCount > 0 && (
          <ExportRow
            label="Outages Only"
            desc={`${outageCount} system${outageCount !== 1 ? 's' : ''} with inoperative features`}
            color="var(--color-danger)"
            onPdf={() => handleExportPdf('outages')}
            onEmail={() => handleEmailPdf('outages')}
            exporting={exporting}
          />
        )}

        {/* Export by System */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 0', borderTop: '1px solid var(--color-border)',
        }}>
          <select
            value={selectedSystem}
            onChange={e => setSelectedSystem(e.target.value)}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 6,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
              color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
            }}
          >
            <option value="__all">Select a system...</option>
            {sortedSystems.map(h => (
              <option key={h.systemId} value={h.systemId}>{h.systemName}</option>
            ))}
          </select>
          <button
            onClick={() => selectedSystem !== '__all' && handleExportPdf(selectedSystem)}
            disabled={exporting || selectedSystem === '__all'}
            style={{
              padding: '7px 10px', borderRadius: 6, border: 'none',
              background: selectedSystem !== '__all'
                ? 'color-mix(in srgb, var(--color-purple) 12%, transparent)'
                : 'var(--color-bg-inset)',
              color: selectedSystem !== '__all' ? 'var(--color-purple)' : 'var(--color-text-4)',
              fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: selectedSystem !== '__all' ? 'pointer' : 'default',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => selectedSystem !== '__all' && handleEmailPdf(selectedSystem)}
            disabled={exporting || selectedSystem === '__all'}
            style={{
              padding: '7px 10px', borderRadius: 6, border: 'none',
              background: selectedSystem !== '__all'
                ? 'color-mix(in srgb, var(--color-purple) 12%, transparent)'
                : 'var(--color-bg-inset)',
              color: selectedSystem !== '__all' ? 'var(--color-purple)' : 'var(--color-text-4)',
              fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: selectedSystem !== '__all' ? 'pointer' : 'default',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Mail size={14} />
          </button>
        </div>
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

// ── Export row component ──

function ExportRow({ label, desc, color, onPdf, onEmail, exporting }: {
  label: string; desc: string; color?: string
  onPdf: () => void; onEmail: () => void; exporting: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--color-border)',
    }}>
      <div>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: color || 'var(--color-text-1)' }}>{label}</div>
        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={onPdf}
          disabled={exporting}
          style={{
            padding: '5px 10px', borderRadius: 6, border: 'none',
            background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
            color: 'var(--color-purple)',
            fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: exporting ? 'default' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Download size={12} /> PDF
        </button>
        <button
          onClick={onEmail}
          disabled={exporting}
          style={{
            padding: '5px 10px', borderRadius: 6, border: 'none',
            background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
            color: 'var(--color-purple)',
            fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: exporting ? 'default' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <Mail size={12} />
        </button>
      </div>
    </div>
  )
}
