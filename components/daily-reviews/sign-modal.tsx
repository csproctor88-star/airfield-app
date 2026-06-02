'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchDailyReview,
  fetchDailyReviewSigners,
  computeEventsHash,
  canUserSignSlot,
  currentAmslSlot,
  formatSigner,
  getSlotLabel,
  requiredSlotsForShifts,
  getReviewWindowUtc,
  type DailyReviewRow,
  type DailyReviewSlot,
  type SignerInfo,
} from '@/lib/supabase/daily-reviews'
import { useInstallation } from '@/lib/installation-context'
import { getWriteQueue } from '@/lib/sync/write-queue'
import type { DailyReviewSignPayload, DailyReviewSignResult } from '@/lib/sync/handlers'
import { ConflictError } from '@/lib/sync/types'
import { fetchDailyReportData, type DailyReportData } from '@/lib/reports/daily-ops-data'
import { generateDailyOpsPdf, type DailyReviewSignoff } from '@/lib/reports/daily-ops-pdf'
import { formatZuluDateTime } from '@/lib/utils'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { usePermissions } from '@/lib/permissions'
import { isMobileDevice } from '@/lib/device'
import type jsPDF from 'jspdf'
import { Check, X } from 'lucide-react'

interface SignModalProps {
  open: boolean
  onClose: () => void
  baseId: string
  baseName: string
  baseIcao: string | null
  shiftCount: number
  reviewDate: string // YYYY-MM-DD
  /** Base timezone + reset time so the day window matches shift-checklist/
   *  inspection local-time behavior instead of UTC midnight. */
  timezone?: string | null
  resetTime?: string | null
  userId: string
  userName: string
  defaultPdfEmail: string | null
  onSigned: () => void
}

export default function DailyReviewSignModal({
  open, onClose, baseId, baseName, baseIcao, shiftCount, reviewDate,
  timezone, resetTime, userId, userName, defaultPdfEmail, onSigned,
}: SignModalProps) {
  const { has } = usePermissions()
  const { currentInstallation } = useInstallation()
  const labelFor = (slot: DailyReviewSlot) => getSlotLabel(slot, currentInstallation)
  const [loading, setLoading] = useState(false)
  const [row, setRow] = useState<DailyReviewRow | null>(null)
  const [signers, setSigners] = useState<Partial<Record<DailyReviewSlot, SignerInfo>>>({})
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null)
  const [pdfFilename, setPdfFilename] = useState<string>('')
  const [eventsHash, setEventsHash] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<DailyReviewSlot | ''>('')
  const [notes, setNotes] = useState('')
  const [signing, setSigning] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  // Layout (isMobile) is viewport-width based, but the PDF-preview decision is
  // device based: iOS/iPadOS WebKit renders only the first page of a PDF in an
  // <iframe> (regardless of width — iPads are >768px), so those devices fall
  // back to the "open in the native viewer" link. See lib/device.ts.
  const [pdfInlineUnsupported, setPdfInlineUnsupported] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    setPdfInlineUnsupported(isMobileDevice())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const [reportData, setReportData] = useState<DailyReportData | null>(null)

  const buildReviewSignoff = (r: DailyReviewRow | null, signerMap: Partial<Record<DailyReviewSlot, SignerInfo>>): DailyReviewSignoff | null => {
    if (!r) return null
    const required = requiredSlotsForShifts(shiftCount)
    const slots = required.map((slot) => {
      const signedAt = r[`${slot}_signed_at` as keyof DailyReviewRow] as string | null
      const notes = r[`${slot}_notes` as keyof DailyReviewRow] as string | null
      const signer = signerMap[slot]
      const signerStr = signer ? formatSigner(signer) : null
      return { label: labelFor(slot), signer: signerStr, signedAt, notes }
    })
    return { slots, fullyCertifiedAt: r.fully_certified_at }
  }

  const regeneratePdf = (
    data: DailyReportData,
    currentRow: DailyReviewRow | null,
    currentSigners: Partial<Record<DailyReviewSlot, SignerInfo>>,
  ) => {
    const { doc, filename } = generateDailyOpsPdf(data, {
      startDate: reviewDate,
      endDate: reviewDate,
      isRange: false,
      generatedBy: userName,
      baseName,
      baseIcao,
      review: buildReviewSignoff(currentRow, currentSigners),
    })
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    setPdfDoc(doc)
    setPdfFilename(filename)
    setPdfUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url })
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        // Day window matches the base's local reset time (e.g. 0600L), not
        // Zulu midnight — parity with shift-checklist / inspection behavior.
        const { startIso, endIso } = getReviewWindowUtc(reviewDate, timezone, resetTime)
        const [existing, data] = await Promise.all([
          fetchDailyReview(baseId, reviewDate),
          fetchDailyReportData(startIso, endIso, baseId),
        ])
        if (cancelled) return
        setRow(existing)
        setReportData(data)

        const signerMap = existing ? await fetchDailyReviewSigners(existing) : {}
        if (cancelled) return
        setSigners(signerMap)

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

        regeneratePdf(data, existing, signerMap)

        // Preselect the AMSL slot matching the base's current local time if the
        // user can sign it and it's unsigned; otherwise fall back to the first
        // eligible unsigned slot (NAMO/AFM will usually be reviewing after-hours).
        const required = requiredSlotsForShifts(shiftCount)
        const isOpen = (s: DailyReviewSlot) =>
          canUserSignSlot(has, s)
          && !(existing as DailyReviewRow | null)?.[`${s}_signed_at` as keyof DailyReviewRow]
        const currentShift = currentAmslSlot(timezone, shiftCount)
        const openSlot = (isOpen(currentShift) ? currentShift : undefined) ?? required.find(isOpen)
        if (openSlot) setSelectedSlot(openSlot)
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
    const payload: DailyReviewSignPayload = {
      baseId,
      date: reviewDate,
      slot: selectedSlot,
      userId,
      eventsHash,
      notes: notes.trim() || null,
      shiftCount,
    }
    let data: DailyReviewSignResult = null
    try {
      const result = await getWriteQueue().enqueueOrExecute<
        DailyReviewSignPayload,
        DailyReviewSignResult
      >('daily_review_sign', payload, {
        baseId,
        userId,
      })
      setSigning(false)
      if (result.status === 'queued') {
        setNotes('')
        toast.success(
          `${labelFor(selectedSlot)} sign queued — will commit when the network returns.`,
          { duration: 6000 },
        )
        onSigned()
        return
      }
      data = result.data
    } catch (err) {
      setSigning(false)
      if (err instanceof ConflictError) {
        toast.error(err.message, { duration: 8000 })
        return
      }
      toast.error(`Sign failed: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    if (!data) {
      toast.error('Sign failed')
      return
    }
    setRow(data)
    setNotes('')
    toast.success(`Signed as ${labelFor(selectedSlot)}`)
    onSigned()

    // Refresh signer profiles and regenerate the preview PDF
    const signerMap = await fetchDailyReviewSigners(data)
    setSigners(signerMap)
    if (reportData) regeneratePdf(reportData, data, signerMap)

    if (data.fully_certified_at) {
      setEmailOpen(true)
    }
  }

  const handleDownload = () => {
    if (!pdfDoc) return
    pdfDoc.save(pdfFilename)
  }

  const handleEmail = async (to: string) => {
    if (!pdfDoc) return
    setEmailSending(true)
    try {
      const subject = `Reviewed Daily Operations — ${baseName}${baseIcao ? ` (${baseIcao})` : ''} — ${reviewDate}`
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
  const canDownload = !!pdfDoc && !!row?.fully_certified_at

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 'var(--z-modal)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--color-bg-surface-solid)',
        borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 1000, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--color-border-mid)',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border-mid)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>Daily Review — {reviewDate}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{baseName}{baseIcao ? ` (${baseIcao})` : ''}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 320px',
          gridTemplateRows: isMobile ? 'auto 1fr' : '1fr',
          gap: 0,
          overflow: 'hidden',
        }}>
          {/* PDF preview */}
          <div style={{
            background: 'var(--color-bg-elevated)',
            borderRight: isMobile ? 'none' : '1px solid var(--color-border-mid)',
            borderBottom: isMobile ? '1px solid var(--color-border-mid)' : 'none',
            minHeight: isMobile ? 'auto' : undefined,
          }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)' }}>Loading review…</div>
            ) : pdfUrl ? (
              pdfInlineUnsupported ? (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                    PDF preview isn&apos;t supported inline on this device. Open it in a new tab to review before signing.
                  </div>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block', textAlign: 'center', padding: '10px 12px',
                      borderRadius: 'var(--radius-md)', background: 'var(--color-cyan)',
                      color: 'var(--color-cyan-btn-text)', fontWeight: 700, textDecoration: 'none',
                    }}
                  >Open Daily Ops PDF</a>
                </div>
              ) : (
                <iframe src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Daily Ops Preview" />
              )
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
                const signer = signers[slot]
                const signerLabel = signer ? formatSigner(signer) : null
                return (
                  <div key={slot} style={{
                    padding: '6px 8px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
                    background: signedAt
                      ? 'color-mix(in srgb, var(--color-success) 8%, transparent)'
                      : 'var(--color-bg-inset)',
                    border: `1px solid ${signedAt
                      ? 'color-mix(in srgb, var(--color-success) 30%, transparent)'
                      : 'var(--color-border)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 600 }}>{labelFor(slot)}</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: signedAt ? 'var(--color-success)' : 'var(--color-text-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {signedAt ? <><Check size={11} strokeWidth={3} /> Signed</> : 'Pending'}
                      </span>
                    </div>
                    {signedAt && (
                      <div style={{ marginTop: 2, fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', lineHeight: 1.3 }}>
                        <div>{signerLabel || 'Unknown'}</div>
                        <div style={{ color: 'var(--color-text-3)', fontFamily: 'monospace' }}>{formatZuluDateTime(signedAt)}</div>
                      </div>
                    )}
                  </div>
                )
              })}
              {row?.fully_certified_at && (
                <div style={{
                  marginTop: 8, padding: '8px 10px',
                  background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                  border: '1px solid var(--color-success)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-success)',
                  fontSize: 'var(--fs-sm)', fontWeight: 700, textAlign: 'center',
                }}>
                  FULLY REVIEWED
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
                {required.filter((s) => canUserSignSlot(has, s)).map((s) => {
                  const already = !!(row?.[`${s}_signed_at` as keyof DailyReviewRow])
                  return <option key={s} value={s} disabled={already}>{labelFor(s)}{already ? ' (signed)' : ''}</option>
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
                  background: 'var(--color-cyan)', color: 'var(--color-cyan-btn-text)', fontWeight: 800, border: 'none',
                  cursor: signing || loading || !selectedSlot ? 'not-allowed' : 'pointer',
                  opacity: signing || loading || !selectedSlot ? 0.5 : 1,
                }}
              >{signing ? 'Signing…' : 'Sign Review'}</button>

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

              {canDownload && (
                <button
                  onClick={handleDownload}
                  style={{
                    marginTop: 8, width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                    color: 'var(--color-success)',
                    border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
                    cursor: 'pointer',
                    fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'inherit',
                  }}
                >Download Reviewed PDF</button>
              )}
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

