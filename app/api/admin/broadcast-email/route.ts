import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { buildBroadcastEmail } from '@/lib/email/broadcast-template'
import { normalizeRecipients, chunk, type Recipient } from '@/lib/email/broadcast-recipients'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const CHUNK_SIZE = 100
const FROM = 'Glidepath <info@glidepathops.com>'
const REPLY_TO = 'info@glidepathops.com'

interface Body {
  mode: 'count' | 'test' | 'send'
  filters?: { baseIds?: string[]; roles?: string[] }
  subject?: string
  body?: string
}

function clean(v: string | undefined) {
  return v?.trim().replace(/^["']|["']$/g, '')
}

export async function POST(request: Request) {
  try {
    const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
    const anon = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    if (!url || !anon || !serviceKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(url, anon, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(url, serviceKey)

    const { data: caller } = await admin
      .from('profiles')
      .select('role, email, name')
      .eq('id', user.id)
      .single()

    if (!caller || caller.role !== 'sys_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { mode, filters, subject, body } = (await request.json()) as Body

    const resolveRecipients = async (): Promise<Recipient[]> => {
      let q = admin.from('profiles').select('email, name').eq('status', 'active')
      if (filters?.baseIds?.length) q = q.in('primary_base_id', filters.baseIds)
      if (filters?.roles?.length) q = q.in('role', filters.roles)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      return normalizeRecipients((data as Array<{ email: string | null; name: string | null }>) || [])
    }

    if (mode === 'count') {
      const recipients = await resolveRecipients()
      return NextResponse.json({ recipientCount: recipients.length })
    }

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }
    const resend = getResend()

    if (mode === 'test') {
      if (!caller.email) {
        return NextResponse.json({ error: 'Your account has no email on file' }, { status: 400 })
      }
      const built = buildBroadcastEmail({ recipientName: caller.name || caller.email, subject, bodyMarkdown: body })
      const { error } = await resend.emails.send({
        from: FROM, replyTo: REPLY_TO, to: caller.email,
        subject: `[TEST] ${built.subject}`, html: built.html, text: built.text,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (mode === 'send') {
      const recipients = await resolveRecipients()
      if (recipients.length === 0) {
        return NextResponse.json({ error: 'No recipients match the selected filters' }, { status: 400 })
      }
      let sent = 0
      let failed = 0
      for (const group of chunk(recipients, CHUNK_SIZE)) {
        const emails = group.map((r) => {
          const built = buildBroadcastEmail({ recipientName: r.name || r.email, subject, bodyMarkdown: body })
          return { from: FROM, replyTo: REPLY_TO, to: r.email, subject: built.subject, html: built.html, text: built.text }
        })
        const { error } = await resend.batch.send(emails)
        if (error) failed += group.length
        else sent += group.length
      }

      // Audit write is best-effort — a send already happened; never report the
      // whole broadcast as failed just because the audit row didn't persist.
      try {
        await admin.from('email_broadcasts').insert({
          sender_id: user.id, subject, body, filters: filters ?? {},
          recipient_count: recipients.length, sent_count: sent, failed_count: failed,
        })
      } catch (e) {
        console.error('[broadcast-email] audit insert failed:', e)
      }

      return NextResponse.json({ recipientCount: recipients.length, sent, failed })
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (err) {
    console.error('[broadcast-email] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected server error' }, { status: 500 })
  }
}
