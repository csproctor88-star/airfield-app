'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ACSI_STATUS_CONFIG, ACSI_CHECKLIST_SECTIONS } from '@/lib/constants'
import { DEMO_ACSI_INSPECTIONS } from '@/lib/demo-data'
import { createClient } from '@/lib/supabase/client'
import { fetchAcsiInspection, deleteAcsiInspection } from '@/lib/supabase/acsi-inspections'
import { useInstallation } from '@/lib/installation-context'
import { toast } from 'sonner'
import type { AcsiInspection, AcsiStatus, AcsiItem } from '@/lib/supabase/types'
import { ArrowLeft, ChevronDown, ChevronRight, Trash2, Edit, FileText, Table } from 'lucide-react'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'

export default function AcsiDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { userRole, currentInstallation, installationId, defaultPdfEmail } = useInstallation()
  const isAdmin = userRole === 'base_admin' || userRole === 'sys_admin'
  const canEdit = isAdmin || userRole === 'airfield_manager'

  const [inspection, setInspection] = useState<AcsiInspection | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [actionLoading, setActionLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }
    const data = await fetchAcsiInspection(params.id as string)
    setInspection(data)
    setLoading(false)
  }, [params.id])

  useEffect(() => { loadData() }, [loadData])

  const insp = usingDemo
    ? (DEMO_ACSI_INSPECTIONS.find(d => d.id === params.id) as AcsiInspection | undefined) || null
    : inspection

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)' }}>Loading...</div>
  }
  if (!insp) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)' }}>ACSI inspection not found.</div>
  }

  const statusCfg = ACSI_STATUS_CONFIG[insp.status as AcsiStatus] || ACSI_STATUS_CONFIG.draft
  const total = insp.passed_count + insp.failed_count + insp.na_count
  const pct = insp.total_items > 0 ? Math.round((total / insp.total_items) * 100) : 0

  // Group items by section
  const itemsBySection: Record<string, AcsiItem[]> = {}
  for (const item of (insp.items || [])) {
    const key = item.section_id || 'unknown'
    if (!itemsBySection[key]) itemsBySection[key] = []
    itemsBySection[key].push(item)
  }

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleDelete = async () => {
    if (!confirm('Delete this ACSI inspection? This cannot be undone.')) return
    setActionLoading(true)
    const { error } = await deleteAcsiInspection(insp.id)
    setActionLoading(false)
    if (error) {
      toast.error(`Delete failed: ${error}`)
    } else {
      toast.success('ACSI inspection deleted')
      router.push('/acsi')
    }
  }

  const acsiPdfOpts = { baseName: currentInstallation?.name, baseIcao: currentInstallation?.icao, baseId: installationId }

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const { generateAcsiPdf } = await import('@/lib/acsi-pdf')
      const { doc, filename } = await generateAcsiPdf(insp, acsiPdfOpts)
      doc.save(filename)
      toast.success('PDF exported')
    } catch (err) {
      toast.error('PDF export failed')
      console.error(err)
    }
    setExporting(false)
  }

  const handleEmailPdf = async () => {
    setExporting(true)
    try {
      const { generateAcsiPdf } = await import('@/lib/acsi-pdf')
      const result = await generateAcsiPdf(insp, acsiPdfOpts)
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (err) {
      toast.error('PDF generation failed')
      console.error(err)
    }
    setExporting(false)
  }

  const handleSendEmail = async (email: string) => {
    if (!emailPdfData) return
    setSendingEmail(true)
    const result = await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, `ACSI Report: ${emailPdfData.filename.replace(/_/g, ' ').replace('.pdf', '')}`)
    if (result.success) {
      toast.success('Email sent successfully')
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } else {
      toast.error(result.error || 'Failed to send email')
    }
    setSendingEmail(false)
  }

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const { generateAcsiExcel } = await import('@/lib/acsi-excel')
      await generateAcsiExcel(insp)
      toast.success('Excel exported')
    } catch (err) {
      toast.error('Excel export failed')
      console.error(err)
    }
    setExporting(false)
  }

  const responseBadge = (response: string | null) => {
    if (response === 'pass') return <span style={{ color: '#10B981', fontWeight: 600 }}>Y</span>
    if (response === 'fail') return <span style={{ color: '#EF4444', fontWeight: 600 }}>N</span>
    if (response === 'na') return <span style={{ color: '#6B7280', fontWeight: 600 }}>N/A</span>
    return <span style={{ color: 'var(--color-text-3)' }}>—</span>
  }

  const isFiled = insp.status === 'completed' || insp.status === 'staffed'

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Back + Header */}
      <Link href="/acsi" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)',
        marginBottom: 16,
      }}>
        <ArrowLeft size={14} /> Back to ACSI List
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
              {insp.display_id}
            </h1>
            <Badge label={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} />
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 4 }}>
            {insp.airfield_name} — {insp.fiscal_year} — {insp.inspection_date}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isFiled && (
            <>
              <button
                onClick={handleExportPdf}
                disabled={exporting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 6, border: '1px solid var(--color-border)',
                  background: 'transparent', color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-sm)', fontWeight: 500, cursor: 'pointer',
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <FileText size={14} /> Export PDF
              </button>
              <button
                onClick={handleEmailPdf}
                disabled={exporting}
                style={{
                  padding: '12px 16px', borderRadius: 10, textAlign: 'center',
                  background: '#A78BFA14', border: '1px solid #A78BFA33',
                  color: '#A78BFA', fontSize: 'var(--fs-md)', fontWeight: 700,
                  fontFamily: 'inherit', cursor: exporting ? 'default' : 'pointer',
                  opacity: exporting ? 0.7 : 1,
                }}
                title="Email PDF"
              >
                ✉
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 6, border: '1px solid var(--color-border)',
                  background: 'transparent', color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-sm)', fontWeight: 500, cursor: 'pointer',
                  opacity: exporting ? 0.5 : 1,
                }}
              >
                <Table size={14} /> Export Excel
              </button>
            </>
          )}
          {canEdit && (
            <Link href={`/acsi/new?resume=${insp.id}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 6, border: '1px solid var(--color-accent)',
              background: 'transparent', color: 'var(--color-accent)', textDecoration: 'none',
              fontSize: 'var(--fs-sm)', fontWeight: 600,
            }}>
              <Edit size={14} /> Edit Form
            </Link>
          )}
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 6, border: '1px solid #EF4444',
                background: 'transparent', color: '#EF4444',
                fontSize: 'var(--fs-sm)', fontWeight: 500, cursor: 'pointer',
                opacity: actionLoading ? 0.5 : 1,
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Items', value: insp.total_items, color: 'var(--color-text-1)' },
          { label: 'Passed', value: insp.passed_count, color: '#10B981' },
          { label: 'Failed', value: insp.failed_count, color: '#EF4444' },
          { label: 'N/A', value: insp.na_count, color: '#6B7280' },
          { label: 'Completion', value: `${pct}%`, color: 'var(--color-accent)' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '12px 20px', borderRadius: 8, border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)', textAlign: 'center', minWidth: 90,
          }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Checklist Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {ACSI_CHECKLIST_SECTIONS.map(section => {
          const sectionItems = itemsBySection[section.id] || []
          const expanded = expandedSections[section.id] || false
          const passCount = sectionItems.filter(i => i.response === 'pass').length
          const failCount = sectionItems.filter(i => i.response === 'fail').length
          const naCount = sectionItems.filter(i => i.response === 'na').length
          const answered = passCount + failCount + naCount
          const allDone = answered === sectionItems.length && sectionItems.length > 0

          return (
            <div key={section.id} style={{
              border: '1px solid var(--color-border)', borderRadius: 8,
              overflow: 'hidden', background: 'var(--color-bg-surface)',
            }}>
              <button
                onClick={() => toggleSection(section.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '12px 16px',
                  background: allDone ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
                  cursor: 'pointer', textAlign: 'left', color: 'var(--color-text-1)',
                }}
              >
                {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 'var(--fs-base)',
                    color: allDone ? '#10B981' : 'var(--color-text-1)',
                  }}>
                    Section {section.number} — {section.title}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-xs)' }}>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>{passCount} Y</span>
                  <span style={{ color: '#EF4444', fontWeight: 600 }}>{failCount} N</span>
                  <span style={{ color: '#6B7280', fontWeight: 600 }}>{naCount} NA</span>
                  <span style={{ color: 'var(--color-text-3)', fontWeight: 600 }}>({answered}/{sectionItems.length})</span>
                </div>
              </button>

              {expanded && sectionItems.length > 0 && (
                <div style={{ padding: '8px 16px 12px' }}>
                  {sectionItems.map((item, idx) => (
                    <div key={item.id}>
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '10px 8px',
                        borderRadius: 6,
                        background: item.response === 'fail'
                          ? 'rgba(239, 68, 68, 0.06)'
                          : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ minWidth: 48, fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-3)' }}>
                          {item.item_number}
                        </div>
                        <div style={{ flex: 1, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', lineHeight: 1.5 }}>
                          {item.question}
                        </div>
                        <div style={{ minWidth: 36, textAlign: 'center' }}>
                          {responseBadge(item.response)}
                        </div>
                      </div>

                      {/* Discrepancy details for failed items */}
                      {item.response === 'fail' && (() => {
                        const discs = item.discrepancies?.length
                          ? item.discrepancies
                          : item.discrepancy ? [item.discrepancy] : []
                        if (discs.length === 0) return null
                        return discs.map((disc, di) => (
                          <div key={di} style={{
                            margin: '4px 0 8px 54px', padding: '8px 12px',
                            background: 'rgba(239, 68, 68, 0.04)',
                            border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 6,
                            fontSize: 'var(--fs-sm)',
                          }}>
                            {discs.length > 1 && (
                              <div style={{ fontWeight: 700, color: '#EF4444', fontSize: 'var(--fs-xs)', marginBottom: 4 }}>
                                Discrepancy {di + 1} of {discs.length}
                              </div>
                            )}
                            {disc.comment && <div style={{ marginBottom: 4 }}><strong>Comment:</strong> {disc.comment}</div>}
                            {disc.work_order && <div><strong>WO#:</strong> {disc.work_order}</div>}
                            {disc.project_number && <div><strong>Project#:</strong> {disc.project_number}</div>}
                            {disc.estimated_cost && <div><strong>Est. Cost:</strong> {disc.estimated_cost}</div>}
                            {disc.estimated_completion && <div><strong>ECD:</strong> {disc.estimated_completion}</div>}
                            {disc.areas && disc.areas.length > 0 && (
                              <div><strong>Areas:</strong> {disc.areas.join(', ')}</div>
                            )}
                            {/* Show pins on first discrepancy (shared) */}
                            {di === 0 && disc.pins && disc.pins.length > 0 ? (
                              <div style={{ marginTop: 2 }}>
                                <strong>Locations:</strong>{' '}
                                {disc.pins.map((p: { lat: number; lng: number }, pi: number) => (
                                  <span key={pi}>
                                    {pi > 0 && ' | '}
                                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                                  </span>
                                ))}
                              </div>
                            ) : di === 0 && disc.latitude != null && disc.longitude != null ? (
                              <div style={{ marginTop: 2 }}>
                                <strong>Location:</strong> {disc.latitude.toFixed(5)}, {disc.longitude.toFixed(5)}
                              </div>
                            ) : null}
                          </div>
                        ))
                      })()}
                    </div>
                  ))}
                </div>
              )}

              {expanded && sectionItems.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
                  No items recorded for this section
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Inspection Team */}
      {insp.inspection_team && insp.inspection_team.length > 0 && (
        <div style={{
          marginBottom: 20, border: '1px solid var(--color-border)', borderRadius: 8,
          padding: 16, background: 'var(--color-bg-surface)',
        }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, marginBottom: 10, color: 'var(--color-text-1)' }}>
            Inspection Team
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {insp.inspection_team.map((m, i) => (
              <div key={i} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                <strong>{m.title || m.role}:</strong> {m.rank} {m.name || '(not assigned)'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Management Certification */}
      {insp.risk_cert_signatures && insp.risk_cert_signatures.length > 0 && (
        <div style={{
          marginBottom: 20, border: '1px solid var(--color-border)', borderRadius: 8,
          padding: 16, background: 'var(--color-bg-surface)',
        }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, marginBottom: 10, color: 'var(--color-text-1)' }}>
            Risk Management Certification
          </div>
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
          }}>
            Reviewed By
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {insp.risk_cert_signatures.map((sig, i) => (
              <div key={i} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                <strong>{sig.label || `Reviewer ${i + 1}`}:</strong> {sig.organization ? `${sig.organization} — ` : ''}{sig.rank} {sig.name} {sig.title ? `— ${sig.title}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {insp.notes && (
        <div style={{
          border: '1px solid var(--color-border)', borderRadius: 8,
          padding: 16, background: 'var(--color-bg-surface)',
        }}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, marginBottom: 8, color: 'var(--color-text-1)' }}>Notes</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {insp.notes}
          </div>
        </div>
      )}

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
