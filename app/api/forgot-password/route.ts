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

    // Plain, deliverability-tested template (mirrors the invite / approval
    // emails): no gradient wrapper, no styled CTA button, no logo. A password
    // reset must carry the reset URL, but it is rendered as plain text — NOT
    // an <a href> anchor — so the message is free of https:// linked content
    // that Defender for Office 365 / Safe Links quarantines or rewrites on
    // .mil tenants. The user copies the URL into their browser. Only the
    // mailto: contact is a live link (mailto passes those filters). info@
    // sender to match the other transactional emails.
    const resend = new Resend(resendKey)
    const html = `
      <p>Hello,</p>
      <p>A password reset was requested for the Glidepath account associated with <strong>${escapeHtml(email)}</strong>. Copy the address below into your browser to set a new password:</p>
      <p>${escapeHtml(resetUrl)}</p>
      <p>This link expires in 24 hours. If you didn't request this, you can ignore this email — your password will not change.</p>
      <p>Questions? Contact <a href="mailto:info@glidepathops.com">info@glidepathops.com</a>.</p>
    `
    const text = [
      'Hello,',
      '',
      `A password reset was requested for the Glidepath account associated with ${email}. Copy the address below into your browser to set a new password:`,
      '',
      resetUrl,
      '',
      "This link expires in 24 hours. If you didn't request this, you can ignore this email — your password will not change.",
      '',
      'Questions? Contact info@glidepathops.com.',
    ].join('\n')
    const { error: sendError } = await resend.emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      replyTo: 'info@glidepathops.com',
      to: email,
      subject: 'Glidepath — Password Reset',
      html,
      text,
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
