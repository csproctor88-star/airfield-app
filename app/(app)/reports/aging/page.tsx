'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Mail, Loader2 } from 'lucide-react'
import { fetchAgingDiscrepanciesData, type AgingDiscrepanciesData, type AgingTier } from '@/lib/reports/aging-discrepancies-data'
import { generateAgingDiscrepanciesPdf } from '@/lib/reports/aging-discrepancies-pdf'
import { getInspectorName } from '@/lib/supabase/inspections'
import { useInstallation } from '@/lib/installation-context'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
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

  // Build filtered data for display and export
  const filteredData = useMemo((): AgingDiscrepanciesData | null => {
    if (!data) return null

    const filteredTiers: AgingTier[] = data.tiers.map(tier => {
      // If a tier filter is active and this isn't it, empty the discrepancies
      if (activeTierLabel && tier.label !== activeTierLabel) {
        return { ...tier, discrepancies: [] }
      }
      // If a shop filter is active, filter discrepancies within the tier
      if (activeShop) {
        return {
          ...tier,
          discrepancies: tier.discrepancies.filter(d =>
            activeShop === '__unassigned' ? !d.assigned_shop : d.assigned_shop === activeShop
          ),
        }
      }
      return tier
    })

    const allFiltered = filteredTiers.flatMap(t => t.discrepancies)
    const total = allFiltered.length

    // Recompute summary for filtered set
    const shopCounts: Record<string, number> = {}
    let totalDays = 0
    let oldest: { display_id: string; title: string; days_open: number } | null = null

    for (const d of allFiltered) {
      const shop = d.assigned_shop || 'Unassigned'
      shopCounts[shop] = (shopCounts[shop] || 0) + 1
      totalDays += d.days_open
      if (!oldest || d.days_open > oldest.days_open) {
        oldest = { display_id: d.display_id, title: d.title, days_open: d.days_open }
      }
    }

    const byShop = Object.entries(shopCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([shop, count]) => ({ shop, count }))

    return {
      tiers: filteredTiers,
      summary: {
        total,
        byShop,
        avgDaysOpen: total > 0 ? Math.round(totalDays / total) : null,
        oldest,
      },
    }
  }, [data, activeTierLabel, activeShop])

  const hasFilters = activeTierLabel !== null || activeShop !== null

  const filterLabel = useMemo(() => {
    const parts: string[] = []
    if (activeTierLabel) parts.push(activeTierLabel)
    if (activeShop) parts.push(activeShop === '__unassigned' ? 'Unassigned' : activeShop)
    return parts.length > 0 ? parts.join(' / ') : 'All Open Discrepancies'
  }, [activeTierLabel, activeShop])

  const pdfOpts = { generatedBy: generatorName, baseName: currentInstallation?.name, baseIcao: currentInstallation?.icao }

  const handleExport = async () => {
    if (!filteredData) return
    setExporting(true)
    const { doc, filename } = generateAgingDiscrepanciesPdf(filteredData, pdfOpts)
    doc.save(filename)
    setExporting(false)
  }

  const handleEmailPdf = async () => {
    if (!filteredData) return
    setExporting(true)
    const result = generateAgingDiscrepanciesPdf(filteredData, pdfOpts)
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

  const { tiers: allTiers, summary: fullSummary } = data
  const { tiers: visibleTiers, summary: filteredSummary } = filteredData
  const activeTiersWithItems = visibleTiers.filter(t => t.discrepancies.length > 0)

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
        {hasFilters && (
          <button onClick={() => { setActiveTierLabel(null); setActiveShop(null) }} style={{
            background: 'none', border: '1px solid var(--color-border)', borderRadius: 6,
            padding: '4px 10px', color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
          <div className="kpi-value" style={{ color: 'var(--color-text-1)' }}>{filteredSummary.total}</div>
          <div className="kpi-label">{hasFilters ? 'Filtered' : 'Total Open'}</div>
        </div>
        {filteredSummary.avgDaysOpen !== null && (
          <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
            <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{filteredSummary.avgDaysOpen}</div>
            <div className="kpi-label">Avg Days</div>
          </div>
        )}
        {filteredSummary.oldest && (
          <div className="kpi-badge" style={{ flex: '1 1 0', maxWidth: 200 }}>
            <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{filteredSummary.oldest.days_open}</div>
            <div className="kpi-label">Oldest</div>
          </div>
        )}
      </div>

      {/* Aging Tier Badges — clickable */}
      <div className="card" style={{ padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          By Aging Tier {activeTierLabel && <span style={{ color: 'var(--color-cyan)', fontWeight: 400 }}>— click to clear</span>}
        </div>
        <div className="badge-grid">
          {allTiers.map((tier) => {
            const isActive = activeTierLabel === tier.label
            const count = tier.discrepancies.length
            return (
              <div
                key={tier.label}
                onClick={() => setActiveTierLabel(isActive ? null : tier.label)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                  background: isActive ? `${tier.color}28` : `${tier.color}14`,
                  border: isActive ? `2px solid ${tier.color}` : `1px solid ${tier.color}33`,
                  minWidth: 64, opacity: count === 0 ? 0.4 : 1,
                  transition: 'border 0.15s, background 0.15s',
                }}
              >
                <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: tier.color }}>{count}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-2)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{tier.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By Shop — clickable */}
      {fullSummary.byShop.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            By Shop {activeShop && <span style={{ color: 'var(--color-cyan)', fontWeight: 400 }}>— click to clear</span>}
          </div>
          <div className="badge-grid">
            {fullSummary.byShop.map((s) => {
              const isActive = activeShop === s.shop
              return (
                <div
                  key={s.shop}
                  onClick={() => setActiveShop(isActive ? null : s.shop)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                    background: isActive ? 'rgba(56,189,248,0.15)' : 'var(--color-border)',
                    border: isActive ? '2px solid var(--color-accent)' : '1px solid rgba(56,189,248,0.15)',
                    minWidth: 64, transition: 'border 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 800, color: 'var(--color-accent)' }}>{s.count}</div>
                  <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-2)', fontWeight: 600, textAlign: 'center', marginTop: 2 }}>{s.shop}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter indicator */}
      {hasFilters && (
        <div style={{
          fontSize: 'var(--fs-xs)', color: 'var(--color-cyan)', fontWeight: 600,
          marginBottom: 8, padding: '4px 0',
        }}>
          Showing: {filterLabel} ({filteredSummary.total} discrepancies)
        </div>
      )}

      {/* Item List per visible tier */}
      {activeTiersWithItems.map((tier) => (
        <div key={tier.label} className="card" style={{ padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, color: tier.color }}>
            {tier.label} ({tier.discrepancies.length})
          </div>
          {tier.discrepancies.map((d) => (
            <div
              key={d.id}
              onClick={() => router.push(`/discrepancies/${d.id}`)}
              style={{
                padding: '6px 0',
                borderBottom: '1px solid rgba(148,163,184,0.1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-cyan)' }}>
                  {d.display_id} — {d.title}
                </div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
                  {d.location_text} · {d.assigned_shop || 'Unassigned'}
                </div>
              </div>
              <div style={{
                fontSize: 'var(--fs-base)', fontWeight: 800, color: tier.color,
                minWidth: 40, textAlign: 'right',
              }}>
                {d.days_open}d
              </div>
            </div>
          ))}
        </div>
      ))}

      {filteredSummary.total === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
          No discrepancies match the selected filters
        </div>
      )}

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
            border: '1px solid rgba(34,197,94,0.4)',
            background: 'rgba(34,197,94,0.1)',
            color: '#22C55E', fontSize: 'var(--fs-xl)', fontWeight: 700,
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
            border: '1px solid #A78BFA33',
            background: '#A78BFA14',
            color: '#A78BFA', fontSize: 'var(--fs-xl)', fontWeight: 700,
            cursor: (exporting || filteredSummary.total === 0) ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: (exporting || filteredSummary.total === 0) ? 0.5 : 1,
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
