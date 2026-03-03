import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Server not configured — RESEND_API_KEY missing' },
        { status: 500 },
      )
    }

    const body = await request.json()
    const { pdfBase64, filename, to, subject } = body as {
      pdfBase64?: string
      filename?: string
      to?: string
      subject?: string
    }

    if (!pdfBase64 || !filename || !to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: pdfBase64, filename, to, subject' },
        { status: 400 },
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const { error } = await resend.emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      to,
      subject,
      html: `<p>Please find the attached PDF report: <strong>${filename}</strong></p><p style="color:#888;font-size:12px;">Sent from Glidepath Airfield Management</p>`,
      attachments: [
        {
          filename,
          content: Buffer.from(pdfBase64, 'base64'),
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
