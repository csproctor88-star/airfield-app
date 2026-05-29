import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import {
  getAdminClient,
  isAdmin,
  isSysAdmin,
  canBaseAdminManageUser,
} from '@/lib/admin/role-checks'
import { getSiteUrl } from '@/lib/site-url'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(request: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 },
      )
    }

    // Authenticate caller
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/^["']|["']$/g, '')
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim().replace(/^["']|["']$/g, '')
    const cookieStore = cookies()
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch caller's profile
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, role, primary_base_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !isAdmin(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body as { userId?: string }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Authorization is keyed on userId, and the address we send the reset link
    // to is derived from that same user via the auth admin API — never taken
    // from the request body. Trusting a client-supplied email would let a base
    // admin authorize against a userId they manage while passing an arbitrary
    // email, triggering a branded reset email to any address.
    const { data: targetAuth, error: targetAuthError } = await admin.auth.admin.getUserById(userId)
    const targetEmail = targetAuth?.user?.email
    if (targetAuthError || !targetEmail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Target profile drives the base-access check and the email greeting.
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('primary_base_id, name')
      .eq('id', userId)
      .single()

    // If base admin, verify target user is at their base
    if (!isSysAdmin(callerProfile.role)) {
      if (!canBaseAdminManageUser(callerProfile.primary_base_id, targetProfile?.primary_base_id ?? null)) {
        return NextResponse.json(
          { error: 'You can only reset passwords for users at your installation' },
          { status: 403 },
        )
      }
    }

    // Generate password reset link
    const siteUrl = getSiteUrl()
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: targetEmail,
      options: { redirectTo: `${siteUrl}/auth/confirm?next=/reset-password` },
    })

    if (linkError) {
      // Fallback to default Supabase email if generateLink fails
      const { error: resetError } = await admin.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
      })
      if (resetError) return NextResponse.json({ error: resetError.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    // Name for the email greeting (profile fetched above)
    const userName = targetProfile?.name || targetEmail
    // Build a direct verify-OTP URL pointing at our /auth/confirm route
    // (NOT properties.action_link). The hosted Supabase verify URL fails
    // for server-generated links under PKCE — see comment in
    // app/api/admin/invite/route.ts.
    const hashedToken = linkData?.properties?.hashed_token
    const verificationType = linkData?.properties?.verification_type
    const resetUrl = (hashedToken && verificationType)
      ? `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(verificationType)}&next=${encodeURIComponent('/reset-password')}`
      : `${siteUrl}/reset-password`

    // Send branded email via Resend
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        await resend.emails.send({
          from: 'Glidepath <noreply@glidepathops.com>',
          replyTo: 'info@glidepathops.com',
          to: targetEmail,
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
          <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(userName)}</strong>,</p>
          <p style="margin:0 0 16px;">A password reset has been requested for your Glidepath account. Click the button below to set a new password:</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#0369A1,#22D3EE);color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;border-radius:8px;">Reset Password</a>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:#94A3B8;">This link will expire in 24 hours. If you did not request this reset, you can safely ignore this email.</p>
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
        return NextResponse.json({ success: true })
      } catch (emailErr) {
        console.warn('[admin/reset-password] Branded email failed:', emailErr)
      }
    }

    // Fallback: use Supabase default email
    await admin.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reset-password] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
