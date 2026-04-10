import { NextResponse } from 'next/server'
import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const BETA_FORM_URL = process.env.GLIDEPATH_BETA_FORM_URL || ''

export async function POST(request: Request) {
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const { email, name } = await request.json()
    if (!email || !name) {
      return NextResponse.json({ error: 'email and name are required' }, { status: 400 })
    }

    const resend = getResend()

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1E293B;border-radius:12px;border:1px solid #334155;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0369A1,#22D3EE);padding:24px 32px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">GLIDEPATH</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF;">Account Created</div>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#E2E8F0;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 16px;">Thank you for creating a Glidepath account. Your account has been received and is <span style="color:#F59E0B;font-weight:700;">pending approval</span> by your installation's administrator.</p>
          ${BETA_FORM_URL ? `<div style="background:#0F172A;border:1px solid #22D3EE40;border-left:3px solid #22D3EE;border-radius:8px;padding:14px 18px;margin:0 0 16px;">
            <div style="color:#22D3EE;font-weight:600;font-size:12px;margin-bottom:6px;">IMPORTANT — COMPLETE THIS STEP</div>
            <div style="color:#E2E8F0;margin-bottom:10px;">If you are onboarding a new base, please complete the Beta Access Request Form so we can verify your information and expedite your approval:</div>
            <div style="text-align:center;">
              <a href="${escapeHtml(BETA_FORM_URL)}" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#0369A1,#22D3EE);color:#FFFFFF;font-weight:700;font-size:14px;text-decoration:none;border-radius:6px;">Complete Beta Access Form</a>
            </div>
          </div>` : ''}
          <div style="font-size:13px;color:#94A3B8;border-top:1px solid #334155;padding-top:14px;">
            <strong>What happens next?</strong>
            <ul style="margin:8px 0 0;padding-left:20px;">
              <li>Your installation's Airfield Manager will review your request</li>
              <li>You will receive an email once your account is approved</li>
              <li>If additional information is needed, you will be contacted</li>
            </ul>
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#64748B;">If you have questions, contact <a href="mailto:info@glidepathops.com" style="color:#22D3EE;text-decoration:none;">info@glidepathops.com</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #334155;text-align:center;">
          <div style="font-size:11px;color:#64748B;">Glidepath Airfield Operations Platform</div>
          <div style="font-size:11px;color:#475569;margin-top:4px;">Guiding You to Mission Success</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const { error: sendError } = await resend.emails.send({
      from: 'Glidepath <noreply@glidepathops.com>',
      replyTo: 'info@glidepathops.com',
      to: email,
      subject: 'Glidepath Account Created — Pending Approval',
      html,
    })

    if (sendError) {
      console.error('[signup-email] Send error:', sendError)
      // Don't fail the signup if email fails
      return NextResponse.json({ success: false, error: sendError.message })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[signup-email] Error:', err)
    return NextResponse.json({ success: false })
  }
}
