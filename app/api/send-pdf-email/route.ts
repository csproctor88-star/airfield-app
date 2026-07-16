export const maxDuration = 30

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { checkRateLimits } from '@/lib/rate-limit'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function POST(request: Request) {
  try {
    // Authenticate caller via cookie
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
    if (!url || !key) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }
    const cookieStore = await cookies()
    const supabase = createServerClient(url, key, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Server not configured — RESEND_API_KEY missing' },
        { status: 500 },
      )
    }

    const body = await request.json()
    const { storagePath, pdfBase64, filename, to, subject } = body as {
      storagePath?: string
      pdfBase64?: string
      filename?: string
      to?: string
      subject?: string
    }

    if (!filename || !to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, to, subject' },
        { status: 400 },
      )
    }

    if (!storagePath && !pdfBase64) {
      return NextResponse.json(
        { error: 'Missing PDF data: provide storagePath or pdfBase64' },
        { status: 400 },
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // ABUSE CONTROL: this route sends an arbitrary attachment to an arbitrary
    // recipient from the verified info@glidepathops.com domain. Any
    // authenticated principal (including the shared kiosk / read_only account)
    // can reach it, and the base64 branch is the normal path for
    // client-generated report PDFs, so we can't gate it on a single
    // permission. Cap send rate per-user and per-recipient so it can't be
    // driven as a spam/phishing relay. Uses the service-role client because
    // check_rate_limit is not granted to anon; fails open if the key is absent
    // (documented tradeoff in lib/rate-limit.ts).
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
    const limiter = serviceKey ? createServiceClient(url, serviceKey) : supabase
    const withinLimits = await checkRateLimits(limiter, [
      { bucket: `pdf-email:user:${user.id}`, max: 30, windowSeconds: 300 },
      { bucket: `pdf-email:recipient:${to.toLowerCase()}`, max: 10, windowSeconds: 3600 },
    ])
    if (!withinLimits) {
      return NextResponse.json(
        { error: 'Too many report emails sent — please wait a moment and try again.' },
        { status: 429 },
      )
    }

    // Get PDF content — either from Supabase Storage or from base64 payload.
    //
    // SECURITY (H-1): the download uses the CALLER's RLS-scoped session
    // client (`supabase`), never the service-role key. Previously the
    // service-role download bypassed storage RLS, letting any authenticated
    // user exfiltrate another tenant's file by passing its storagePath and
    // an arbitrary recipient. With the caller's client, the download is
    // confined to what storage RLS permits for that user (base-scoped once
    // the photos bucket is private — migration 2026062015).
    const MAX_PDF_BYTES = 20 * 1024 * 1024 // 20 MB cap to bound abuse
    let pdfBuffer: Buffer
    if (storagePath) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('photos')
        .download(storagePath)
      if (downloadError || !fileData) {
        return NextResponse.json(
          { error: `Failed to download PDF: ${downloadError?.message || 'File not found'}` },
          { status: 404 },
        )
      }
      pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    } else {
      pdfBuffer = Buffer.from(pdfBase64!, 'base64')
    }

    if (pdfBuffer.length === 0 || pdfBuffer.length > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: 'PDF payload is empty or exceeds the 20 MB limit' },
        { status: 413 },
      )
    }

    const safeFilename = escapeHtml(filename)
    const { error } = await getResend().emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      to,
      subject,
      html: `<p>Please find the attached PDF report: <strong>${safeFilename}</strong></p><p style="color:#888;font-size:12px;">Sent from Glidepath Airfield Management</p>`,
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    })

    if (error) {
      console.error('[send-pdf-email] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-pdf-email] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
