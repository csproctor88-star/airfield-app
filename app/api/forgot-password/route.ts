import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAdminClient } from '@/lib/admin/role-checks'
import { getSiteUrl } from '@/lib/site-url'
import { checkRateLimits, getClientIp } from '@/lib/rate-limit'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Self-service password reset (the "Forgot Password?" link on /login).
//
// We mint the recovery link via the admin API (`generateLink`) instead of
// `resetPasswordForEmail` so the actual email is sent through Resend with
// our branded template — same flow as `app/api/admin/reset-password`,
// without the admin auth requirement. The browser-side
// `supabase.auth.resetPasswordForEmail` would otherwise fall through to
// Supabase's default SMTP, producing an unbranded "noreply@mail.app.
// supabase.io" message.
//
// Enumeration-safe: any failure (user not found, link generation error,
// email-send error) is logged server-side but the response is always 200.
// This matches the prior client-side behavior — a stranger probing the
// endpoint cannot tell whether a given email is registered.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { email?: string } | null
    const email = body?.email?.trim()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const admin = getAdminClient()
    if (!admin) {
      console.error('[forgot-password] Admin client unavailable — SUPABASE_SERVICE_ROLE_KEY missing')
      // Don't leak server-config details to the caller; degrade silently.
      return NextResponse.json({ success: true })
    }

    // Throttle abuse: this endpoint mints recovery emails with no auth. A 429
    // here leaks nothing about whether the email is registered (it's about
    // request volume), so it stays enumeration-safe.
    const ip = getClientIp(request)
    const allowed = await checkRateLimits(admin, [
      { bucket: `forgot-password:email:${email.toLowerCase()}`, max: 3, windowSeconds: 900 },
      { bucket: `forgot-password:ip:${ip}`, max: 20, windowSeconds: 3600 },
    ])
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const siteUrl = getSiteUrl()
    const redirectTo = `${siteUrl}/auth/confirm?next=/reset-password`

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    const hashedToken = linkData?.properties?.hashed_token
    const verificationType = linkData?.properties?.verification_type
    if (linkError || !hashedToken || !verificationType) {
      // Most commonly: the email isn't a registered user. Stay quiet.
      console.warn('[forgot-password] generateLink failed:', linkError?.message)
      return NextResponse.json({ success: true })
    }

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      console.error('[forgot-password] RESEND_API_KEY missing — cannot send branded email')
      return NextResponse.json({ success: true })
    }

    // Build a direct verify-OTP URL pointing at our /auth/confirm route
    // (NOT properties.action_link). The hosted Supabase verify URL fails
    // for server-generated links under PKCE — see comment in
    // app/api/admin/invite/route.ts.
    const resetUrl = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(verificationType)}&next=${encodeURIComponent('/reset-password')}`

    const resend = new Resend(resendKey)
    const { error: sendError } = await resend.emails.send({
      from: 'Glidepath <noreply@glidepathops.com>',
      replyTo: 'info@glidepathops.com',
      to: email,
      subject: 'Glidepath — Password Reset',
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1E293B;border-radius:12px;border:1px solid #334155;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0369A1,#22D3EE);padding:24px 32px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">GLIDEPATH</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF;">Password Reset</div>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#E2E8F0;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">A password reset has been requested for the Glidepath account associated with <strong>${escapeHtml(email)}</strong>. Click the button below to set a new password:</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#0369A1,#22D3EE);color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;border-radius:8px;">Reset Password</a>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:#94A3B8;">This link will expire in 24 hours. If you did not request this reset, you can safely ignore this email — your password will not change.</p>
          <p style="margin:0;font-size:13px;color:#64748B;">Questions? Reply to this email or contact <a href="mailto:info@glidepathops.com" style="color:#22D3EE;text-decoration:none;">info@glidepathops.com</a></p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #334155;text-align:center;">
          <div style="font-size:11px;color:#64748B;">Glidepath Airfield Operations Platform</div>
          <div style="font-size:11px;color:#475569;margin-top:4px;">Guiding You to Mission Success</div>
          <div style="font-size:9px;color:#334155;margin-top:8px;line-height:1.4;">This application is not endorsed by, affiliated with, or associated with the Department of Defense (DoD) or any branch of the U.S. Armed Forces. The views and content herein do not reflect the official policy or position of the DoD.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })

    if (sendError) {
      console.error('[forgot-password] Resend error:', sendError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[forgot-password] Error:', err)
    // Even on unexpected failure, don't leak details. The user can retry.
    return NextResponse.json({ success: true })
  }
}
