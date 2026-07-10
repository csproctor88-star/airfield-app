import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import {
  getAdminClient,
  isAdmin,
  isSysAdmin,
  canBaseAdminManageUser,
} from '@/lib/admin/role-checks'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Same per-account, high-entropy temp password the invite flow uses
// (app/api/admin/invite/route.ts). ~16 chars, URL-safe, with a fixed suffix
// so it always clears any min-length / character-class policy.
function generateTempPassword(): string {
  return randomBytes(12).toString('base64url') + 'A9!'
}

/**
 * Admin-initiated password reset.
 *
 * Deliverability rewrite: this route used to email a branded dark card with a
 * gradient "Reset Password" CTA button deep-linking to glidepathops.com.
 * Defender for Office 365 quarantines styled deep-link emails on .mil tenants,
 * so the reset link never reached the user. We now reset the password
 * server-side to a per-account temp value and email it as plain text (no
 * links, no styling) — identical to the invite flow. The user signs in with
 * the temp password and must_change_password=true forces them through
 * /setup-account to choose a new one.
 */
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
    const cookieStore = await cookies()
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

    // Authorization is keyed on userId, and the address we email the temp
    // password to is derived from that same user via the auth admin API —
    // never taken from the request body. Trusting a client-supplied email
    // would let a base admin authorize against a userId they manage while
    // passing an arbitrary address, leaking a working credential offsite.
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

    // Reset the password to a per-account temp value and force a change on
    // next sign-in. No recovery link is minted — the temp password travels in
    // a plain email that survives .mil mail filtering.
    const tempPassword = generateTempPassword()
    const { error: pwError } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    })
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 400 })
    }

    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId)
    if (profileUpdateError) {
      // The password is already reset; the gate flag is best-effort. Log it
      // but don't fail the reset — worst case the user isn't forced to
      // /setup-account and just keeps the temp password until they change it
      // in Settings.
      console.error('[admin/reset-password] must_change_password update failed:', profileUpdateError)
    }

    // Email the temp password. Plain HTML + text, no links, info@ sender —
    // mirrors the invite email. Non-fatal: the password is already reset, so
    // we report emailSent/emailError back and the admin UI relays the temp
    // password manually if the send failed (or was quarantined).
    const userName = targetProfile?.name || targetEmail
    let emailSent = false
    let emailError: string | null = null
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      emailError = 'Email service is not configured (RESEND_API_KEY missing).'
    } else {
      const html = `
        <p>Hello ${escapeHtml(userName)},</p>
        <p>Your Glidepath password was reset by your installation's administrator. Use the temporary password below to sign in.</p>
        <p><strong>Sign-in email:</strong> ${escapeHtml(targetEmail)}<br>
        <strong>Temporary password:</strong> <code>${escapeHtml(tempPassword)}</code></p>
        <p>On your next sign-in you'll be prompted to choose a new password. Sign in at the Glidepath URL provided by your administrator.</p>
        <p>If you didn't expect this, contact your installation's Airfield Manager or <a href="mailto:info@glidepathops.com">info@glidepathops.com</a>.</p>
      `
      const text = [
        `Hello ${userName},`,
        '',
        "Your Glidepath password was reset by your installation's administrator. Use the temporary password below to sign in.",
        '',
        `Sign-in email: ${targetEmail}`,
        `Temporary password: ${tempPassword}`,
        '',
        "On your next sign-in you'll be prompted to choose a new password. Sign in at the Glidepath URL provided by your administrator.",
        '',
        "If you didn't expect this, contact your installation's Airfield Manager or info@glidepathops.com.",
      ].join('\n')

      try {
        const resend = new Resend(resendKey)
        const { error: sendError } = await resend.emails.send({
          from: 'Glidepath <info@glidepathops.com>',
          replyTo: 'info@glidepathops.com',
          to: targetEmail,
          subject: 'Glidepath — Password Reset',
          html,
          text,
        })
        if (sendError) {
          emailError = sendError.message || 'The email service rejected the message.'
          console.error('[admin/reset-password] Resend error:', sendError)
        } else {
          emailSent = true
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'Email send failed.'
        console.error('[admin/reset-password] Email send threw:', e)
      }
    }

    return NextResponse.json({ success: true, tempPassword, emailSent, emailError })
  } catch (err) {
    console.error('[admin/reset-password] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
