/**
 * Daily training-expiry digest.
 *
 * Triggered by Vercel cron (configured in vercel.json) at 13:00 UTC.
 * For each civilian base, finds users with ≥1 training_records row
 * where expires_at falls inside the 30-day warning window AND no later
 * record on the same topic has superseded it. Sends a digest email
 * (one per affected user) to the base's training admin recipient, then
 * inserts a training_digest_log row to dedup against repeat-runs on
 * the same day.
 *
 * Auth: Bearer CRON_SECRET in the Authorization header. Vercel cron
 * sets this automatically; manual invocations need it set.
 *
 * Service-role Supabase client so the route can scan every base
 * regardless of caller identity (no cookie auth here — there's no
 * user behind a cron).
 */

export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

type ExpiringRow = {
  base_id: string
  base_name: string
  base_icao: string | null
  base_recipient: string | null
  user_id: string
  user_name: string
  user_email: string | null
  topic_code: string
  topic_title: string
  expires_at: string
  days_remaining: number
}

// Vercel cron invokes the path with GET; POST is kept for manual testing.
export async function GET(request: Request) { return handler(request) }
export async function POST(request: Request) { return handler(request) }

async function handler(request: Request) {
  // Auth: require CRON_SECRET. Vercel cron sets Authorization automatically.
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[training-expiry-digest] CRON_SECRET not configured')
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

  const today = new Date().toISOString().slice(0, 10)
  const todayPlus30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

  // Find expiring records, joined with topics + bases + profiles.
  // Filter: airport_type = 'faa_part139' AND expires_at BETWEEN today AND today+30.
  // Then drop any record that has been superseded by a later record
  // for the same (user, topic_code) — that's the "no later renewal"
  // requirement. Done in-memory after the fetch to keep the SQL simple.
  const { data: expiringRaw, error: fetchErr } = await supabase
    .from('training_records')
    .select(`
      id,
      base_id,
      user_id,
      topic_id,
      completed_at,
      expires_at,
      training_topics ( code, title ),
      bases!inner ( name, icao, airport_type, default_pdf_email ),
      profiles!training_records_user_id_fkey ( name, email )
    `)
    .gte('expires_at', today)
    .lte('expires_at', todayPlus30)
    .eq('bases.airport_type', 'faa_part139')

  if (fetchErr) {
    console.error('[training-expiry-digest] fetch error', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  type RawRow = {
    id: string
    base_id: string
    user_id: string
    topic_id: string
    completed_at: string
    expires_at: string
    training_topics: { code: string; title: string } | null
    bases: { name: string; icao: string | null; airport_type: string; default_pdf_email: string | null } | null
    profiles: { name: string; email: string | null } | null
  }
  const rawRows = (expiringRaw ?? []) as unknown as RawRow[]

  // For each (user, topic_code) keep the latest record only; that's
  // the record whose status drives the badge. If that record's
  // expires_at is inside our window, it's a candidate for the digest.
  const allRecords = await supabase
    .from('training_records')
    .select('id, user_id, topic_id, completed_at, training_topics ( code )')
  if (allRecords.error) {
    console.error('[training-expiry-digest] all-records fetch error', allRecords.error)
    return NextResponse.json({ error: allRecords.error.message }, { status: 500 })
  }
  type AllRow = { id: string; user_id: string; topic_id: string; completed_at: string; training_topics: { code: string } | null }
  const allRows = ((allRecords.data ?? []) as unknown as AllRow[])
  const latestByUserCode = new Map<string, string>()  // key → record_id
  for (const r of allRows) {
    const code = r.training_topics?.code
    if (!code) continue
    const key = `${r.user_id}::${code}`
    const prior = latestByUserCode.get(key)
    if (!prior) { latestByUserCode.set(key, r.id); continue }
    const priorRow = allRows.find(x => x.id === prior)
    if (priorRow && r.completed_at > priorRow.completed_at) {
      latestByUserCode.set(key, r.id)
    }
  }

  const candidates: ExpiringRow[] = []
  for (const r of rawRows) {
    const code = r.training_topics?.code
    if (!code) continue
    const key = `${r.user_id}::${code}`
    if (latestByUserCode.get(key) !== r.id) continue  // superseded
    const expDate = new Date(r.expires_at)
    const daysRemaining = Math.max(0, Math.floor((expDate.getTime() - Date.now()) / 86_400_000))
    candidates.push({
      base_id: r.base_id,
      base_name: r.bases?.name ?? 'Unknown base',
      base_icao: r.bases?.icao ?? null,
      base_recipient: r.bases?.default_pdf_email ?? null,
      user_id: r.user_id,
      user_name: r.profiles?.name ?? 'Unknown user',
      user_email: r.profiles?.email ?? null,
      topic_code: code,
      topic_title: r.training_topics?.title ?? code,
      expires_at: r.expires_at,
      days_remaining: daysRemaining,
    })
  }

  // Group by (base, user)
  const groups = new Map<string, ExpiringRow[]>()
  for (const c of candidates) {
    const k = `${c.base_id}::${c.user_id}`
    const arr = groups.get(k) ?? []
    arr.push(c)
    groups.set(k, arr)
  }

  let basesProcessed = new Set<string>()
  let emailsSent = 0
  const errors: { key: string; error: string }[] = []

  for (const [key, group] of Array.from(groups.entries())) {
    const [baseId, userId] = key.split('::')
    const first = group[0]
    basesProcessed.add(baseId)

    if (!first.base_recipient) {
      errors.push({ key, error: 'No default_pdf_email on base — set under base setup' })
      continue
    }

    // Dedup insert first — if conflict, skip the send entirely
    const { error: dedupErr } = await supabase
      .from('training_digest_log')
      .insert({
        base_id: baseId,
        user_id: userId,
        send_date: today,
        topic_codes: group.map(r => r.topic_code),
        recipient: first.base_recipient,
      })
    if (dedupErr) {
      // Unique violation → already sent today; skip without erroring.
      if (dedupErr.code === '23505') continue
      errors.push({ key, error: dedupErr.message })
      continue
    }

    // Build email
    const subject = `Training expiring soon — ${first.user_name} (${group.length} topic${group.length === 1 ? '' : 's'})`
    const rows = group.sort((a, b) => a.days_remaining - b.days_remaining)
      .map(r => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${escapeHtml(r.topic_code)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${escapeHtml(r.topic_title)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:${r.days_remaining < 7 ? '#b91c1c' : r.days_remaining < 14 ? '#b45309' : '#15803d'}">${r.days_remaining}d</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${r.expires_at}</td></tr>`).join('')
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;color:#0f172a"><h2 style="margin:0 0 8px 0;font-size:18px">§139.303 Training expiring — ${escapeHtml(first.user_name)}</h2><div style="color:#475569;font-size:14px;margin-bottom:14px">${escapeHtml(first.base_name)}${first.base_icao ? ` (${escapeHtml(first.base_icao)})` : ''}</div><p style="font-size:14px;margin:0 0 10px 0">${group.length} required §139.303 training topic${group.length === 1 ? '' : 's'} expire within the next 30 days for this user. Coordinate renewal before each expiry to maintain Part 139 compliance.</p><table style="border-collapse:collapse;width:100%;font-size:14px;border:1px solid #e5e7eb"><thead><tr style="background:#f1f5f9"><th style="text-align:left;padding:8px 10px;font-size:12px;color:#475569">Topic</th><th style="text-align:left;padding:8px 10px;font-size:12px;color:#475569">Title</th><th style="text-align:right;padding:8px 10px;font-size:12px;color:#475569">Remaining</th><th style="text-align:left;padding:8px 10px;font-size:12px;color:#475569">Expires</th></tr></thead><tbody>${rows}</tbody></table><p style="color:#94a3b8;font-size:12px;margin-top:14px">Sent by Glidepath — daily 13:00 UTC. Open the Training module to log renewals.</p></div>`

    const { error: sendErr } = await getResend().emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      to: first.base_recipient,
      subject,
      html,
    })
    if (sendErr) {
      // Roll back the dedup row so a re-run can retry the send
      await supabase.from('training_digest_log').delete()
        .eq('base_id', baseId).eq('user_id', userId).eq('send_date', today)
      errors.push({ key, error: sendErr.message })
      continue
    }
    emailsSent++
  }

  return NextResponse.json({
    ok: true,
    bases_processed: basesProcessed.size,
    candidates: candidates.length,
    groups: groups.size,
    emails_sent: emailsSent,
    errors,
  })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
