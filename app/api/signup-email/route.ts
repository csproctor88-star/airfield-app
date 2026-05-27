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

    // Intentionally plain HTML — mirrors the deliverability-tested PPR
    // confirmation email pattern. Dark gradient designs, prominent CTA
    // buttons, "Verify Your Account" subject lines, and urgency
    // language ("expires in 24 hours") all match phishing classifier
    // patterns that Defender for Office 365 (used by most DoD tenants)
    // quarantines aggressively. The PPR confirmation reaches .mil
    // inboxes; this rewrite tries to inherit those properties.
    const html = `
      <p>Hello ${escapeHtml(fullName)},</p>
      <p>Thank you for signing up for Glidepath. To complete your sign-up, please confirm your email address by visiting the link below:</p>
      <p><a href="${escapeHtml(actionLink)}">${escapeHtml(actionLink)}</a></p>
      <p>Once your email is confirmed, your account will be reviewed by your installation's administrator. You will receive a separate email when your account has been approved.</p>
      ${BETA_FORM_URL ? `<p>If you are onboarding a new installation, please also complete the Beta Access Request Form so we can verify your information: <a href="${escapeHtml(BETA_FORM_URL)}">${escapeHtml(BETA_FORM_URL)}</a></p>` : ''}
      <p>Contact <a href="mailto:info@glidepathops.com">info@glidepathops.com</a> with any questions.</p>
      <p style="color:#888;font-size:12px;">This application is not endorsed by, affiliated with, or associated with the Department of Defense (DoD) or any branch of the U.S. Armed Forces.</p>
    `

    const text = [
      `Hello ${fullName},`,
      '',
      'Thank you for signing up for Glidepath. To complete your sign-up, please confirm your email address by visiting the link below:',
      '',
      actionLink,
      '',
      "Once your email is confirmed, your account will be reviewed by your installation's administrator. You will receive a separate email when your account has been approved.",
      '',
      BETA_FORM_URL ? `If you are onboarding a new installation, please also complete the Beta Access Request Form so we can verify your information: ${BETA_FORM_URL}` : '',
      BETA_FORM_URL ? '' : null,
      'Contact info@glidepathops.com with any questions.',
      '',
      'This application is not endorsed by, affiliated with, or associated with the Department of Defense (DoD) or any branch of the U.S. Armed Forces.',
    ].filter((line): line is string => line !== null).join('\n')

    const { error: sendError } = await resend.emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      replyTo: 'info@glidepathops.com',
      to: email,
      subject: 'Glidepath account confirmation',
      html,
      text,
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
