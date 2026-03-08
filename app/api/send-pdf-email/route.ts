export const maxDuration = 30

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(request: Request) {
  try {
    // Authenticate caller via cookie
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
    if (!url || !key) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }
    const cookieStore = cookies()
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

    // Get PDF content — either from Supabase Storage or from base64 payload
    let pdfBuffer: Buffer
    if (storagePath) {
      // Use service role key to bypass RLS, or fall back to anon key
      const storageClient = serviceKey
        ? createClient(url, serviceKey)
        : supabase
      const { data: fileData, error: downloadError } = await storageClient.storage
        .from('photos')
        .download(storagePath)
      if (downloadError || !fileData) {
        return NextResponse.json(
          { error: `Failed to download PDF: ${downloadError?.message || 'File not found'}` },
          { status: 500 },
        )
      }
      pdfBuffer = Buffer.from(await fileData.arrayBuffer())
    } else {
      pdfBuffer = Buffer.from(pdfBase64!, 'base64')
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
