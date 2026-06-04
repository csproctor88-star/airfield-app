/**
 * Daily annual-review digest for AEP §139.325(d) and WHMP §139.337(c).
 *
 * Triggered by Vercel cron (vercel.json) at 13:30 UTC. For each
 * civilian base, computes the next-review-due date for the active
 * AEP plan and the active WHMP assessment. If either review crosses
 * inside the 60-day amber window or has gone overdue, sends a
 * single per-base digest email to the base's default_pdf_email,
 * then inserts an annual_review_digest_log row to dedup re-runs.
 *
 * Same recipe as /api/training-expiry-digest — Bearer CRON_SECRET
 * auth, service-role Supabase client, Resend transactional send,
 * Glidepath sender. Cron schedule offset to 13:30 so the two
 * digests don't collide.
 *
 * Behavior matches the in-app review-status math:
 *  - AEP anchor: last_reviewed_at ?? effective_date; due = anchor + 1 year
 *  - WHMP anchor: last_reviewed_at ?? performed_at; due = anchor + 1 year
 *  - Status amber when daysOut <= 60 (warning window)
 *  - Status overdue when daysOut < 0
 */

export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import {
  nextAnnualReviewDate,
  classifyAnnualReview,
  REVIEW_WARNING_WINDOW_DAYS,
  type AnnualReviewStatus,
} from '@/lib/annual-review-due'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

type BaseRow = {
  id: string
  name: string
  icao: string | null
  default_pdf_email: string | null
}

type AepRow = {
  base_id: string
  effective_date: string
  last_reviewed_at: string | null
}

type WhmpRow = {
  base_id: string
  performed_at: string
  last_reviewed_at: string | null
}

// Vercel cron invokes the path with GET; POST is kept for manual testing.
export async function GET(request: Request) { return handler(request) }
export async function POST(request: Request) { return handler(request) }

async function handler(request: Request) {
  // Auth: require CRON_SECRET. Vercel cron sets Authorization automatically.
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[annual-review-digest] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY missing' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey)
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  // 1. All civilian bases (the only ones with AEP / WHMP).
  const { data: basesData, error: basesErr } = await supabase
    .from('bases')
    .select('id, name, icao, default_pdf_email')
    .eq('airport_type', 'faa_part139')
  if (basesErr) {
    console.error('[annual-review-digest] base fetch error', basesErr)
    return NextResponse.json({ error: basesErr.message }, { status: 500 })
  }
  const bases = (basesData ?? []) as BaseRow[]
  const baseById = new Map(bases.map((b) => [b.id, b]))

  // 2. Active AEP plans (replaced_by_id IS NULL) per base.
  const { data: aepData, error: aepErr } = await supabase
    .from('aep_plans')
    .select('base_id, effective_date, last_reviewed_at')
    .is('replaced_by_id', null)
  if (aepErr) {
    console.error('[annual-review-digest] AEP fetch error', aepErr)
    return NextResponse.json({ error: aepErr.message }, { status: 500 })
  }
  const aepByBase = new Map<string, AepRow>()
  for (const row of (aepData ?? []) as AepRow[]) {
    if (baseById.has(row.base_id)) aepByBase.set(row.base_id, row)
  }

  // 3. Active WHMP assessments (replaced_by_id IS NULL) per base.
  const { data: whmpData, error: whmpErr } = await supabase
    .from('wildlife_hazard_assessments')
    .select('base_id, performed_at, last_reviewed_at')
    .is('replaced_by_id', null)
  if (whmpErr) {
    console.error('[annual-review-digest] WHMP fetch error', whmpErr)
    return NextResponse.json({ error: whmpErr.message }, { status: 500 })
  }
  const whmpByBase = new Map<string, WhmpRow>()
  for (const row of (whmpData ?? []) as WhmpRow[]) {
    if (baseById.has(row.base_id)) whmpByBase.set(row.base_id, row)
  }

  // 4. For each base, classify both reviews and decide whether to fire.
  let basesProcessed = 0
  let emailsSent = 0
  const errors: { base_id: string; error: string }[] = []

  for (const base of bases) {
    basesProcessed++

    const aep = aepByBase.get(base.id) ?? null
    const whmp = whmpByBase.get(base.id) ?? null

    const aepDue = aep ? nextAnnualReviewDate(aep.last_reviewed_at ?? aep.effective_date) : null
    const whmpDue = whmp ? nextAnnualReviewDate(whmp.last_reviewed_at ?? whmp.performed_at) : null

    const aepClass = classifyAnnualReview(aepDue, now)
    const whmpClass = classifyAnnualReview(whmpDue, now)

    const reasons: string[] = []
    if (aepClass.status === 'overdue' || aepClass.status === 'amber') reasons.push('aep')
    if (whmpClass.status === 'overdue' || whmpClass.status === 'amber') reasons.push('whmp')

    // Nothing to nag about — skip.
    if (reasons.length === 0) continue

    if (!base.default_pdf_email) {
      errors.push({ base_id: base.id, error: 'No default_pdf_email on base — set under base setup' })
      continue
    }

    // Dedup first; if conflict, skip the send entirely (already sent today).
    const { error: dedupErr } = await supabase
      .from('annual_review_digest_log')
      .insert({
        base_id: base.id,
        send_date: today,
        aep_due_date: aepDue ? aepDue.toISOString().slice(0, 10) : null,
        whmp_due_date: whmpDue ? whmpDue.toISOString().slice(0, 10) : null,
        reasons,
        recipient: base.default_pdf_email,
      })
    if (dedupErr) {
      if (dedupErr.code === '23505') continue
      errors.push({ base_id: base.id, error: dedupErr.message })
      continue
    }

    const subject = buildSubject(base, reasons, aepClass, whmpClass)
    const html = buildHtml(base, aepDue, aepClass, whmpDue, whmpClass)

    const { error: sendErr } = await getResend().emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      to: base.default_pdf_email,
      subject,
      html,
    })
    if (sendErr) {
      // Roll back the dedup row so a re-run can retry.
      await supabase.from('annual_review_digest_log').delete()
        .eq('base_id', base.id).eq('send_date', today)
      errors.push({ base_id: base.id, error: sendErr.message })
      continue
    }
    emailsSent++
  }

  return NextResponse.json({
    ok: true,
    bases_processed: basesProcessed,
    emails_sent: emailsSent,
    errors,
  })
}

function buildSubject(
  base: BaseRow,
  reasons: string[],
  aepClass: { status: AnnualReviewStatus; daysOut: number | null },
  whmpClass: { status: AnnualReviewStatus; daysOut: number | null },
): string {
  const icao = base.icao ? ` (${base.icao})` : ''
  const overdue = (reasons.includes('aep') && aepClass.status === 'overdue')
                || (reasons.includes('whmp') && whmpClass.status === 'overdue')
  const prefix = overdue ? 'Overdue' : 'Due soon'
  const mods = reasons.map((r) => r === 'aep' ? 'AEP' : 'WHMP').join(' + ')
  return `${prefix}: ${mods} annual review — ${base.name}${icao}`
}

function statusColor(status: AnnualReviewStatus): string {
  switch (status) {
    case 'overdue': return '#b91c1c'
    case 'amber':   return '#b45309'
    case 'current': return '#15803d'
    case 'never':   return '#475569'
  }
}

function statusLabel(status: AnnualReviewStatus, daysOut: number | null): string {
  if (status === 'never') return 'No record on file'
  if (status === 'overdue') return `Overdue by ${Math.abs(daysOut ?? 0)}d`
  if (status === 'amber') return `${daysOut ?? 0}d remaining`
  return 'Current'
}

function buildHtml(
  base: BaseRow,
  aepDue: Date | null,
  aepClass: { status: AnnualReviewStatus; daysOut: number | null },
  whmpDue: Date | null,
  whmpClass: { status: AnnualReviewStatus; daysOut: number | null },
): string {
  const icao = base.icao ? ` (${escapeHtml(base.icao)})` : ''
  const row = (label: string, citation: string, due: Date | null, cls: { status: AnnualReviewStatus; daysOut: number | null }) => {
    if (cls.status === 'current') return ''
    const dueStr = due ? due.toISOString().slice(0, 10) : '—'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;color:#475569">${escapeHtml(citation)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${dueStr}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${statusColor(cls.status)}">${escapeHtml(statusLabel(cls.status, cls.daysOut))}</td>
    </tr>`
  }

  const aepRow = row('AEP', '14 CFR §139.325(d)', aepDue, aepClass)
  const whmpRow = row('WHMP', '14 CFR §139.337(c)', whmpDue, whmpClass)

  return `<div style="font-family:Arial,sans-serif;max-width:620px;color:#0f172a">
    <h2 style="margin:0 0 8px 0;font-size:18px">Annual review${aepRow && whmpRow ? 's' : ''} due — ${escapeHtml(base.name)}${icao}</h2>
    <p style="font-size:14px;margin:0 0 14px 0;color:#475569">One or more annual reviews are inside the ${REVIEW_WARNING_WINDOW_DAYS}-day warning window or already overdue. Coordinate the next review with the Accountable Executive and record the result in Glidepath to clear this nag.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;border:1px solid #e5e7eb">
      <thead><tr style="background:#f1f5f9">
        <th style="text-align:left;padding:8px 12px;font-size:12px;color:#475569">Module</th>
        <th style="text-align:left;padding:8px 12px;font-size:12px;color:#475569">Reg</th>
        <th style="text-align:left;padding:8px 12px;font-size:12px;color:#475569">Next due</th>
        <th style="text-align:left;padding:8px 12px;font-size:12px;color:#475569">Status</th>
      </tr></thead>
      <tbody>${aepRow}${whmpRow}</tbody>
    </table>
    <p style="color:#94a3b8;font-size:12px;margin-top:14px">Sent by Glidepath — daily 13:30 UTC. Open /aep or /wildlife/whmp and use "Record annual review" to clear.</p>
  </div>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
