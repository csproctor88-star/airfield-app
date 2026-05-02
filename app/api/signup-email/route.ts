import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAdminClient } from '@/lib/admin/role-checks'
import { getSiteUrl } from '@/lib/site-url'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const BETA_FORM_URL = process.env.GLIDEPATH_BETA_FORM_URL || ''

// Self-signup flow.
//
// `generateLink({type:'signup'})` creates the auth.users row (firing the
// handle_new_user() trigger that upserts profiles with status='pending'
// and adds a base_members row) AND returns a hashed_token we embed in a
// single branded Resend email, so the user:
//   1. Receives one email (no more double-email confusion).
//   2. Clicks a working button that verifies their email and lands on
//      /login?signup_verified=1, where the login page shows the pending
//      approval message.
// Bypassing client-side auth.signUp() also removes our dependency on
// Supabase's rate-limited default SMTP for this flow.
//
// We deliberately do NOT use `properties.action_link` — see the comment
// in app/api/admin/invite/route.ts. PKCE flow + server-generated link =
// missing code_verifier = failed exchange. The direct verify-OTP URL
// pattern below avoids the issue.
export async function POST(request: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 500 },
      )
    }

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const body = await request.json()
    const {
      email,
      password,
      firstName,
      lastName,
      rank,
      role,
      primaryBaseId,
    } = body as {
      email: string
      password: string
      firstName: string
      lastName: string
      rank?: string
      role: string
      primaryBaseId: string
    }

    if (!email || !password || !firstName || !lastName || !primaryBaseId) {
      return NextResponse.json(
        { error: 'email, password, firstName, lastName, and primaryBaseId are required' },
        { status: 400 },
      )
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const siteUrl = getSiteUrl()

    // Create the user + get a magic confirmation link. No Supabase email is
    // sent — the returned action_link is what we embed in our Resend message.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${siteUrl}/auth/confirm?next=/login?signup_verified=1`,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          name: fullName,
          rank: rank || undefined,
          role: role || 'read_only',
          primary_base_id: primaryBaseId,
        },
      },
    })

    const hashedToken = linkData?.properties?.hashed_token
    const verificationType = linkData?.properties?.verification_type
    if (linkError || !hashedToken || !verificationType) {
      return NextResponse.json(
        { error: linkError?.message || 'Failed to create signup link' },
        { status: 400 },
      )
    }

    const actionLink = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(verificationType)}&next=${encodeURIComponent('/login?signup_verified=1')}`

    const resend = new Resend(resendKey)
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1E293B;border-radius:12px;border:1px solid #334155;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0369A1,#22D3EE);padding:24px 32px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">GLIDEPATH</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF;">Verify Your Email</div>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#E2E8F0;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
          <p style="margin:0 0 16px;">Thank you for signing up for <strong>Glidepath</strong>. Click the button below to verify your email address:</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="${escapeHtml(actionLink)}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#0369A1,#22D3EE);color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;border-radius:8px;">Verify Email</a>
          </div>
          <p style="margin:0 0 16px;font-size:14px;color:#E2E8F0;">After verification, your account will be <span style="color:#F59E0B;font-weight:700;">pending approval</span> by your installation's administrator. You'll receive a separate email once you're approved.</p>
          ${BETA_FORM_URL ? `<div style="background:#0F172A;border:1px solid #22D3EE40;border-left:3px solid #22D3EE;border-radius:8px;padding:14px 18px;margin:0 0 16px;">
            <div style="color:#22D3EE;font-weight:600;font-size:12px;margin-bottom:6px;">IMPORTANT — COMPLETE THIS STEP</div>
            <div style="color:#E2E8F0;margin-bottom:10px;">If you are onboarding a new base, please complete the Beta Access Request Form so we can verify your information and expedite your approval:</div>
            <div style="text-align:center;">
              <a href="${escapeHtml(BETA_FORM_URL)}" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#0369A1,#22D3EE);color:#FFFFFF;font-weight:700;font-size:14px;text-decoration:none;border-radius:6px;">Complete Beta Access Form</a>
            </div>
          </div>` : ''}
          <p style="margin:0 0 8px;font-size:13px;color:#94A3B8;">This verification link will expire in 24 hours.</p>
          <div style="font-size:13px;color:#94A3B8;border-top:1px solid #334155;padding-top:14px;margin-top:14px;">
            <strong>What happens next?</strong>
            <ul style="margin:8px 0 0;padding-left:20px;">
              <li>Verify your email with the button above</li>
              <li>Your installation's Airfield Manager will review your request</li>
              <li>You'll receive an email once your account is approved</li>
            </ul>
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#64748B;">Questions? Reply to this email or contact <a href="mailto:info@glidepathops.com" style="color:#22D3EE;text-decoration:none;">info@glidepathops.com</a></p>
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
</html>`

    const { error: sendError } = await resend.emails.send({
      from: 'Glidepath <noreply@glidepathops.com>',
      replyTo: 'info@glidepathops.com',
      to: email,
      subject: 'Verify Your Glidepath Account',
      html,
    })

    if (sendError) {
      console.error('[signup-email] Resend error:', sendError)
      return NextResponse.json(
        { error: 'Account created but verification email failed to send. Contact support.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[signup-email] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
