'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { fetchFeedback, fetchFeedbackStats, fetchFeedbackConfig, deleteFeedback, type CustomerFeedback, type FeedbackFormField } from '@/lib/supabase/feedback'
import { formatZuluDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import type jsPDF from 'jspdf'

const STAR = '\u2605'
const STAR_EMPTY = '\u2606'

export default function FeedbackPage() {
  const router = useRouter()
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()
  // View access = has feedback:view; delete gated separately.
  const canView = has(PERM.FEEDBACK_VIEW)
  const canDelete = has(PERM.FEEDBACK_DELETE)
  const [feedback, setFeedback] = useState<CustomerFeedback[]>([])
  const [stats, setStats] = useState<{ total: number; avgRating: number | null; ratingCounts: Record<number, number>; recentCount: number }>({ total: 0, avgRating: null, ratingCounts: {}, recentCount: 0 })
  const [fieldLabelMap, setFieldLabelMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | '30d' | '7d'>('30d')

  // Access control: only users with feedback:view see the dashboard.
  useEffect(() => {
    if (!permsLoaded) return
    if (!canView) router.replace('/')
  }, [permsLoaded, canView, router])

  // PDF export
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailPdfData, setEmailPdfData] = useState<{ doc: jsPDF; filename: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  async function preparePdf() {
    const { generateFeedbackPdf } = await import('@/lib/feedback-pdf')
    const windowLabel = filter === '7d' ? 'Last 7 days' : filter === '30d' ? 'Last 30 days' : 'All time'
    return generateFeedbackPdf({
      feedback,
      stats,
      windowLabel,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao || undefined,
      fieldLabelMap,
    })
  }

  async function handleExportPdf() {
    setGeneratingPdf(true)
    try {
      const { doc, filename } = await preparePdf()
      doc.save(filename)
      toast.success('PDF exported')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleEmailPdf() {
    setGeneratingPdf(true)
    try {
      const result = await preparePdf()
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleSendEmail(email: string) {
    if (!emailPdfData) return
    setSendingEmail(true)
    try {
      await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, 'Customer Feedback Report')
      toast.success(`Emailed to ${email}`)
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } catch (err) {
      console.error(err)
      toast.error('Email failed')
    } finally {
      setSendingEmail(false)
    }
  }

  const loadData = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 365
    const startDate = filter !== 'all' ? new Date(Date.now() - days * 86400000).toISOString() : undefined
    const [fb, st, cfg] = await Promise.all([
      fetchFeedback(installationId, { startDate }),
      fetchFeedbackStats(installationId, days),
      fetchFeedbackConfig(installationId),
    ])
    setFeedback(fb)
    setStats(st)
    const map: Record<string, string> = {}
    for (const f of (cfg?.fields ?? []) as FeedbackFormField[]) map[f.id] = f.label
    setFieldLabelMap(map)
    setLoading(false)
  }, [installationId, filter])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this feedback entry?')) return
    const ok = await deleteFeedback(id)
    if (ok) {
      setFeedback(prev => prev.filter(f => f.id !== id))
      toast.success('Feedback deleted')
    }
  }

  const renderStars = (n: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < n ? '#FBBF24' : '#334155', fontSize: 'var(--fs-lg)' }}>
        {i < n ? STAR : STAR_EMPTY}
      </span>
    ))
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, margin: 0 }}>Customer Feedback</h2>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
            {stats.total} total submissions
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['7d', '30d', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                border: filter === f ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
                background: filter === f ? 'rgba(34,211,238,0.1)' : 'var(--color-bg-surface)',
                color: filter === f ? 'var(--color-cyan)' : 'var(--color-text-2)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{f === 'all' ? 'All' : f === '30d' ? '30 Days' : '7 Days'}</button>
          ))}
          <button
            onClick={handleExportPdf}
            disabled={generatingPdf || feedback.length === 0}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
              color: 'var(--color-text-2)', fontFamily: 'inherit',
              cursor: generatingPdf || feedback.length === 0 ? 'not-allowed' : 'pointer',
              opacity: generatingPdf || feedback.length === 0 ? 0.6 : 1,
            }}
          >
            {generatingPdf ? 'Generating…' : 'Export PDF'}
          </button>
          <button
            onClick={handleEmailPdf}
            disabled={generatingPdf || feedback.length === 0}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
              color: 'var(--color-text-2)', fontFamily: 'inherit',
              cursor: generatingPdf || feedback.length === 0 ? 'not-allowed' : 'pointer',
              opacity: generatingPdf || feedback.length === 0 ? 0.6 : 1,
            }}
          >
            Email PDF
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats.total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
          <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submissions</div>
            <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: 'var(--color-cyan)' }}>{stats.recentCount}</div>
          </div>
          {stats.avgRating != null && (
            <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Rating</div>
              <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 800, color: '#FBBF24' }}>{stats.avgRating.toFixed(1)}</div>
              <div>{renderStars(Math.round(stats.avgRating))}</div>
            </div>
          )}
          {Object.keys(stats.ratingCounts).length > 0 && (
            <div className="card" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Distribution</div>
              {[5, 4, 3, 2, 1].map(n => {
                const count = stats.ratingCounts[n] || 0
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: '#FBBF24', width: 12 }}>{n}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--color-bg-inset)', borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#FBBF24', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', width: 20, textAlign: 'right' }}>{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Feedback list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-3)' }}>Loading feedback...</div>
      ) : feedback.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 'var(--fs-lg)', color: 'var(--color-text-3)', marginBottom: 4 }}>No feedback yet</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
            Configure and enable the feedback form in Base Setup, then share the QR code.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {feedback.map(fb => (
            <div key={fb.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    {fb.name && <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>{fb.name}</span>}
                    {fb.organization && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{fb.organization}</span>}
                    {fb.overall_rating && <span>{renderStars(fb.overall_rating)}</span>}
                  </div>
                  {fb.comments && (
                    <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-2)', lineHeight: 1.5, marginBottom: 4 }}>
                      {fb.comments}
                    </div>
                  )}
                  {/* Custom field responses */}
                  {Object.keys(fb.responses).length > 0 && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                      {Object.entries(fb.responses).map(([key, val]) => (
                        <span key={key} style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                          <strong>{fieldLabelMap[key] || key}:</strong> {String(val)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 6 }}>
                    {formatZuluDateTime(fb.submitted_at)}
                    {fb.email && <> &bull; {fb.email}</>}
                  </div>
                </div>
                {canDelete && (
                  <button onClick={() => handleDelete(fb.id)} style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)',
                    cursor: 'pointer', fontSize: 'var(--fs-2xl)', padding: 0, flexShrink: 0,
                  }}>&times;</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename || 'customer-feedback.pdf'}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}
