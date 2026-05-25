'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, AlertCircle, FileDown, Mail } from 'lucide-react'
import type { QrcTemplate } from '@/lib/supabase/types'
import type { useMonthlyReviews } from '@/lib/qrc/use-monthly-reviews'
import { type MonthlyReviewState } from '@/lib/qrc/monthly-review-status'
import { MonthlyReviewModal } from '@/components/qrc/monthly-review-modal'
import { fetchAllReviewsForBase, fetchEligibleReviewers, type EligibleReviewer } from '@/lib/supabase/qrc-reviews'
import { generateQrcMonthlyReviewPdf } from '@/lib/qrc-monthly-review-pdf'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { usePermissions } from '@/lib/permissions'
import { PERM } from '@/lib/permissions'

interface Props {
  templates: QrcTemplate[]
  baseId: string | null
  baseName?: string | null
  baseIcao?: string | null
  airportType?: 'usaf' | 'faa_part139'
  /** "Rank Name" string — used as the generated-by line on the PDF cover page. */
  generatedByLabel?: string | null
  /** Lifted hook from the parent so badge count and tab body share state. */
  monthlyReviews: ReturnType<typeof useMonthlyReviews>
}

const SECTION_LABEL: Record<MonthlyReviewState, string> = {
  never: 'Due for Review',
  overdue: 'Due for Review',
  updated: 'Updated Since Review',
  current: 'Current',
}

const STATE_PILL: Record<MonthlyReviewState, { bg: string; border: string; color: string; label: string }> = {
  never:   { bg: 'color-mix(in srgb, var(--color-danger) 14%, var(--color-bg-surface))',  border: 'color-mix(in srgb, var(--color-danger) 35%, transparent)',  color: 'var(--color-danger)',  label: 'Never reviewed' },
  overdue: { bg: 'color-mix(in srgb, var(--color-danger) 14%, var(--color-bg-surface))',  border: 'color-mix(in srgb, var(--color-danger) 35%, transparent)',  color: 'var(--color-danger)',  label: 'Overdue' },
  updated: { bg: 'color-mix(in srgb, var(--color-amber) 14%, var(--color-bg-surface))',   border: 'color-mix(in srgb, var(--color-amber) 45%, transparent)',   color: 'var(--color-amber)',   label: 'Updated since' },
  current: { bg: 'color-mix(in srgb, var(--color-success) 14%, var(--color-bg-surface))', border: 'color-mix(in srgb, var(--color-success) 35%, transparent)', color: 'var(--color-success)', label: 'Current' },
}

function defaultMonth(): { month: number; year: number } {
  const d = new Date()
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() }
}

function defaultQuarter(): { quarter: 1 | 2 | 3 | 4; year: number } {
  const d = new Date()
  const q = (Math.floor(d.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4
  return { quarter: q, year: d.getUTCFullYear() }
}

export function ReviewsTab({ templates, baseId, baseName, baseIcao, airportType, generatedByLabel, monthlyReviews }: Props) {
  const { reviews, loaded, getStatus, markReviewed, interval } = monthlyReviews
  const { has } = usePermissions()
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)
  const [pickerMonth, setPickerMonth] = useState(defaultMonth)
  const [pickerQuarter, setPickerQuarter] = useState(defaultQuarter)
  const [generating, setGenerating] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  const activeTemplates = useMemo(
    () => templates.filter(t => t.is_active).sort((a, b) => a.qrc_number - b.qrc_number),
    [templates],
  )

  // Group templates by review state. "never" + "overdue" both render under
  // "Due for Review" — they're the same actionable bucket.
  const grouped = useMemo(() => {
    const buckets: Record<'due' | 'updated' | 'current', QrcTemplate[]> = {
      due: [], updated: [], current: [],
    }
    for (const tmpl of activeTemplates) {
      const status = getStatus(tmpl)
      if (status.state === 'never' || status.state === 'overdue') buckets.due.push(tmpl)
      else if (status.state === 'updated') buckets.updated.push(tmpl)
      else buckets.current.push(tmpl)
    }
    return buckets
  }, [activeTemplates, getStatus, reviews])  // reviews dep so groupings recompute on toggle

  const openTemplate = openTemplateId ? activeTemplates.find(t => t.id === openTemplateId) || null : null

  async function preparePdf() {
    if (!baseId) throw new Error('No base selected')
    const windowStart = interval === 'quarterly'
      ? new Date(Date.UTC(pickerQuarter.year, (pickerQuarter.quarter - 1) * 3, 1))
      : new Date(Date.UTC(pickerMonth.year, pickerMonth.month - 1, 1))
    const [allReviews, eligibleUsers] = await Promise.all([
      fetchAllReviewsForBase(baseId, windowStart),
      fetchEligibleReviewers(baseId),
    ])

    // Fold in any reviewer not already in the eligible list. Catches
    // legitimate reviews from users whose role isn't in REVIEWER_ROLES
    // (e.g., a contractor or safety user who happened to review). The
    // cached profile fields on the review row let us synthesize an
    // EligibleReviewer without an extra round-trip.
    const eligibleIds = new Set(eligibleUsers.map(u => u.user_id))
    const seen = new Set<string>()
    const extras: EligibleReviewer[] = []
    for (const r of allReviews) {
      if (eligibleIds.has(r.user_id) || seen.has(r.user_id)) continue
      seen.add(r.user_id)
      extras.push({
        user_id: r.user_id,
        name: r.reviewer_name ?? '(unknown)',
        rank: r.reviewer_rank,
        operating_initials: r.reviewer_initials,
        role: 'other',
      })
    }
    const roster = [...eligibleUsers, ...extras].sort((a, b) => a.name.localeCompare(b.name))

    return generateQrcMonthlyReviewPdf({
      baseName,
      baseIcao,
      airportType,
      interval,
      month: interval === 'monthly' ? pickerMonth.month : undefined,
      quarter: interval === 'quarterly' ? pickerQuarter.quarter : undefined,
      year: interval === 'monthly' ? pickerMonth.year : pickerQuarter.year,
      templates,
      eligibleUsers: roster,
      reviews: allReviews,
      generatedBy: generatedByLabel,
    })
  }

  async function handleDownload() {
    setGenerating(true)
    try {
      const { doc, filename } = await preparePdf()
      doc.save(filename)
    } catch (e) {
      console.error('PDF generation failed:', e)
      toast.error('PDF generation failed')
    }
    setGenerating(false)
  }

  async function handleEmail() {
    setGenerating(true)
    try {
      const result = await preparePdf()
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (e) {
      console.error('PDF generation failed:', e)
      toast.error('PDF generation failed')
    }
    setGenerating(false)
  }

  async function handleSendEmail(email: string) {
    if (!emailPdfData) return
    setSendingEmail(true)
    const subjectPeriod = interval === 'quarterly'
      ? `${pickerQuarter.year} Q${pickerQuarter.quarter}`
      : `${pickerMonth.year}-${String(pickerMonth.month).padStart(2, '0')}`
    const subjectLabel = interval === 'quarterly' ? 'Quarterly' : 'Monthly'
    const result = await sendPdfViaEmail(
      emailPdfData.doc,
      emailPdfData.filename,
      email,
      `AMOPS ${subjectLabel} QRC Review — ${subjectPeriod}`,
    )
    if (result.success) {
      toast.success('Email sent successfully')
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } else {
      toast.error(result.error || 'Failed to send email')
    }
    setSendingEmail(false)
  }

  if (!loaded) return <LoadingState />
  if (activeTemplates.length === 0) return <EmptyState message="No active QRC templates to review." />

  const canGenerateReport = has(PERM.QRC_EXECUTE)

  return (
    <>
      {/* Header utility cluster — month picker + report buttons */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14,
        flexWrap: 'wrap', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{interval === 'quarterly' ? 'Report Quarter:' : 'Report Month:'}</span>
          {interval === 'quarterly'
            ? <QuarterPicker value={pickerQuarter} onChange={setPickerQuarter} />
            : <MonthPicker value={pickerMonth} onChange={setPickerMonth} />}
        </div>
        {canGenerateReport && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleDownload}
              disabled={generating}
              style={{
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-cyan)',
                background: 'color-mix(in srgb, var(--color-cyan) 10%, transparent)',
                color: 'var(--color-cyan)', fontSize: 'var(--fs-sm)', fontWeight: 700,
                cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: generating ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <FileDown size={14} />
              {generating ? 'Generating…' : 'Generate Compliance Report'}
            </button>
            <button
              onClick={handleEmail}
              disabled={generating}
              title="Email Compliance Report"
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'transparent', color: 'var(--color-text-2)',
                cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: generating ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center',
              }}
            >
              <Mail size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Grouped sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {grouped.due.length > 0 && (
          <Section
            label={SECTION_LABEL.overdue}
            count={grouped.due.length}
            accent="var(--color-danger)"
          >
            {grouped.due.map(tmpl => (
              <ReviewRow
                key={tmpl.id}
                template={tmpl}
                state={getStatus(tmpl).state}
                onClick={() => setOpenTemplateId(tmpl.id)}
              />
            ))}
          </Section>
        )}
        {grouped.updated.length > 0 && (
          <Section
            label={SECTION_LABEL.updated}
            count={grouped.updated.length}
            accent="var(--color-amber)"
          >
            {grouped.updated.map(tmpl => (
              <ReviewRow
                key={tmpl.id}
                template={tmpl}
                state="updated"
                onClick={() => setOpenTemplateId(tmpl.id)}
              />
            ))}
          </Section>
        )}
        {grouped.current.length > 0 && (
          <Section
            label={SECTION_LABEL.current}
            count={grouped.current.length}
            accent="var(--color-success)"
          >
            {grouped.current.map(tmpl => (
              <ReviewRow
                key={tmpl.id}
                template={tmpl}
                state="current"
                onClick={() => setOpenTemplateId(tmpl.id)}
              />
            ))}
          </Section>
        )}
      </div>

      {/* Review modal */}
      {openTemplate && (
        <MonthlyReviewModal
          template={openTemplate}
          status={getStatus(openTemplate)}
          interval={interval}
          onClose={() => setOpenTemplateId(null)}
          onMarkReviewed={markReviewed}
        />
      )}

      {/* Email-PDF modal */}
      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function Section({
  label, count, accent, children,
}: { label: string; count: number; accent: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
        paddingBottom: 4, borderBottom: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
      }}>
        <span style={{
          fontSize: 'var(--fs-xs)', fontWeight: 700, color: accent,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>{label}</span>
        <span style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 800, color: accent,
          padding: '1px 7px', borderRadius: 10,
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`,
          minWidth: 20, textAlign: 'center',
        }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </section>
  )
}

function ReviewRow({
  template, state, onClick,
}: { template: QrcTemplate; state: MonthlyReviewState; onClick: () => void }) {
  const pill = STATE_PILL[state]
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${pill.color}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <span style={{
        fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--color-amber)',
        background: 'color-mix(in srgb, var(--color-amber) 14%, var(--color-bg-surface))',
        border: '1px solid color-mix(in srgb, var(--color-amber) 45%, transparent)',
        padding: '2px 8px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
      }}>QRC-{template.qrc_number}</span>
      <span style={{
        fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)',
        flex: 1, minWidth: 0,
      }}>{template.title}</span>
      <span style={{
        fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '3px 10px',
        borderRadius: 12, background: pill.bg, color: pill.color,
        border: `1px solid ${pill.border}`,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        {state === 'current' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
        {pill.label}
      </span>
    </button>
  )
}

function MonthPicker({
  value, onChange,
}: { value: { month: number; year: number }; onChange: (next: { month: number; year: number }) => void }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  // Year range: this year + 4 prior, in case operators backfill.
  const thisYear = new Date().getUTCFullYear()
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4]
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      <select
        value={value.month}
        onChange={e => onChange({ ...value, month: Number(e.target.value) })}
        className="input-dark"
        style={{ padding: '5px 8px', fontSize: 'var(--fs-sm)' }}
      >
        {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={value.year}
        onChange={e => onChange({ ...value, year: Number(e.target.value) })}
        className="input-dark"
        style={{ padding: '5px 8px', fontSize: 'var(--fs-sm)' }}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

function QuarterPicker({
  value, onChange,
}: {
  value: { quarter: 1 | 2 | 3 | 4; year: number }
  onChange: (next: { quarter: 1 | 2 | 3 | 4; year: number }) => void
}) {
  const thisYear = new Date().getUTCFullYear()
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4]
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      <select
        value={value.quarter}
        onChange={e => onChange({ ...value, quarter: Number(e.target.value) as 1 | 2 | 3 | 4 })}
        className="input-dark"
        style={{ padding: '5px 8px', fontSize: 'var(--fs-sm)' }}
      >
        <option value={1}>Q1 (Jan–Mar)</option>
        <option value={2}>Q2 (Apr–Jun)</option>
        <option value={3}>Q3 (Jul–Sep)</option>
        <option value={4}>Q4 (Oct–Dec)</option>
      </select>
      <select
        value={value.year}
        onChange={e => onChange({ ...value, year: Number(e.target.value) })}
        className="input-dark"
        style={{ padding: '5px 8px', fontSize: 'var(--fs-sm)' }}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

