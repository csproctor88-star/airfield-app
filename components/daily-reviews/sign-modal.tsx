'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchDailyReview,
  signDailyReview,
  computeEventsHash,
  canUserSignSlot,
  SLOT_LABELS,
  requiredSlotsForShifts,
  type DailyReviewRow,
  type DailyReviewSlot,
} from '@/lib/supabase/daily-reviews'
import { fetchDailyReportData } from '@/lib/reports/daily-ops-data'
import { generateDailyOpsPdf } from '@/lib/reports/daily-ops-pdf'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import type jsPDF from 'jspdf'

interface SignModalProps {
  open: boolean
  onClose: () => void
  baseId: string
  baseName: string
  baseIcao: string | null
  shiftCount: number
  reviewDate: string // YYYY-MM-DD
  userId: string
  userRole: string | null
  userName: string
  defaultPdfEmail: string | null
  onSigned: () => void
}

export default function DailyReviewSignModal({
  open, onClose, baseId, baseName, baseIcao, shiftCount, reviewDate,
  userId, userRole, userName, defaultPdfEmail, onSigned,
}: SignModalProps) {
  const [loading, setLoading] = useState(false)
  const [row, setRow] = useState<DailyReviewRow | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null)
  const [pdfFilename, setPdfFilename] = useState<string>('')
  const [eventsHash, setEventsHash] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<DailyReviewSlot | ''>('')
  const [notes, setNotes] = useState('')
  const [signing, setSigning] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailSending, setEmailSending] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        // Day window in UTC — use local midnight
        const start = new Date(`${reviewDate}T00:00:00`)
        const end = new Date(`${reviewDate}T23:59:59.999`)
        const [existing, data] = await Promise.all([
          fetchDailyReview(baseId, reviewDate),
          fetchDailyReportData(start.toISOString(), end.toISOString(), baseId),
        ])
        if (cancelled) return
        setRow(existing)

        const ids = [
          ...data.inspections.map((x) => x.id),
          ...data.checks.map((x) => x.id),
          ...data.newDiscrepancies.map((x) => x.id),
          ...data.statusUpdates.map((x) => x.id),
          ...data.obstructionEvals.map((x) => x.id),
          ...data.qrcExecutions.map((x) => x.id),
          ...data.outageEvents.map((x) => x.id),
          ...data.activityEntries.map((x) => x.id),
        ]
        const hash = await computeEventsHash(ids)
        setEventsHash(hash)

        const { doc, filename } = generateDailyOpsPdf(data, {
          startDate: reviewDate,
          endDate: reviewDate,
          isRange: false,
          generatedBy: userName,
          baseName,
          baseIcao,
        })
        const blob = doc.output('blob')
        const url = URL.createObjectURL(blob)
        setPdfDoc(doc)
        setPdfFilename(filename)
        setPdfUrl(url)

        // Pre-select first slot the user is eligible to sign and isn't already signed
        const required = requiredSlotsForShifts(shiftCount)
        const open = required.find((s) => canUserSignSlot(userRole, s) && !(existing as DailyReviewRow | null)?.[`${s}_signed_at` as keyof DailyReviewRow])
        if (open) setSelectedSlot(open)
      } catch (e) {
        console.error('sign-modal load:', e)
        toast.error('Failed to load daily review')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reviewDate, baseId])

  const handleSign = async () => {
    if (!selectedSlot) {
      toast.error('Select a slot to sign')
      return
    }
    setSigning(true)
    const { data, error } = await signDailyReview({
      baseId,
      date: reviewDate,
      slot: selectedSlot,
      userId,
      eventsHash,
      notes: notes.trim() || null,
      shiftCount,
    })
    setSigning(false)
    if (error || !data) {
      toast.error(error || 'Sign failed')
      return
    }
    setRow(data)
    setNotes('')
    toast.success(`Signed as ${SLOT_LABELS[selectedSlot]}`)
    onSigned()
    if (data.fully_certified_at) {
      setEmailOpen(true)
    }
  }

  const handleEmail = async (to: string) => {
    if (!pdfDoc) return
    setEmailSending(true)
    try {
      const subject = `Certified Daily Review — ${baseName}${baseIcao ? ` (${baseIcao})` : ''} — ${reviewDate}`
      const { success, error } = await sendPdfViaEmail(pdfDoc, pdfFilename, to, subject)
      if (success) {
        toast.success(`Emailed to ${to}`)
        setEmailOpen(false)
      } else {
        toast.error(error || 'Email failed')
      }
    } finally {
      setEmailSending(false)
    }
  }

  if (!open) return null

  const required = requiredSlotsForShifts(shiftCount)

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 'var(--z-modal)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--color-bg-surface-solid, #1a1a2e)',
        borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 1000, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--color-border-mid, #333)',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border-mid)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>Daily Review — {reviewDate}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{baseName}{baseIcao ? ` (${baseIcao})` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 0, overflow: 'hidden' }}>
          {/* PDF preview */}
          <div style={{ background: '#2a2a2a', borderRight: '1px solid var(--color-border-mid)' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)' }}>Loading review…</div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Daily Ops Preview" />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)' }}>No preview available</div>
            )}
          </div>

          {/* Sign panel */}
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Signatures</div>
              {required.map((slot) => {
                const signedAt = row?.[`${slot}_signed_at` as keyof DailyReviewRow] as string | null
                return (
                  <div key={slot} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
                    background: signedAt ? 'rgba(52,211,153,0.08)' : 'var(--color-bg-inset)',
                    border: `1px solid ${signedAt ? 'rgba(52,211,153,0.3)' : 'var(--color-border)'}`,
                  }}>
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 600 }}>{SLOT_LABELS[slot]}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: signedAt ? 'var(--color-success)' : 'var(--color-text-3)' }}>
                      {signedAt ? `✓ ${new Date(signedAt).toLocaleString()}` : 'Pending'}
                    </span>
                  </div>
                )
              })}
              {row?.fully_certified_at && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(52,211,153,0.12)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)', fontSize: 'var(--fs-sm)', fontWeight: 700, textAlign: 'center' }}>
                  FULLY CERTIFIED
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-mid)', paddingTop: 12 }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Sign as</div>
              <select
                className="input-dark"
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value as DailyReviewSlot | '')}
                disabled={loading || signing}
              >
                <option value="">— Select —</option>
                {required.filter((s) => canUserSignSlot(userRole, s)).map((s) => {
                  const already = !!(row?.[`${s}_signed_at` as keyof DailyReviewRow])
                  return <option key={s} value={s} disabled={already}>{SLOT_LABELS[s]}{already ? ' (signed)' : ''}</option>
                })}
              </select>
              <textarea
                className="input-dark"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ marginTop: 8, resize: 'vertical', minHeight: 60 }}
                disabled={signing}
              />
              <button
                onClick={handleSign}
                disabled={!selectedSlot || signing || loading}
                style={{
                  marginTop: 10, width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-cyan)', color: '#000', fontWeight: 800, border: 'none',
                  cursor: signing || loading || !selectedSlot ? 'not-allowed' : 'pointer',
                  opacity: signing || loading || !selectedSlot ? 0.5 : 1,
                }}
              >{signing ? 'Signing…' : 'Sign & Certify'}</button>

              {pdfDoc && (
                <button
                  onClick={() => setEmailOpen(true)}
                  style={{
                    marginTop: 8, width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-inset)', color: 'var(--color-text-1)',
                    border: '1px solid var(--color-border-mid)', cursor: 'pointer', fontSize: 'var(--fs-sm)',
                  }}
                >Email this review…</button>
              )}
            </div>

            <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
              Events hash: {eventsHash || '—'}
            </div>
          </div>
        </div>
      </div>

      <EmailPdfModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        onSend={handleEmail}
        sending={emailSending}
        filename={pdfFilename}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}
