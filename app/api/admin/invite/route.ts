import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import {
  getAdminClient,
  isSysAdmin,
  isAdmin,
  canBaseAdminManageUser,
} from '@/lib/admin/role-checks'
import { toTitleCaseName } from '@/lib/utils'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Initial temp password assigned by admin invites. The new user is
// forced through /setup-account on first sign-in to pick their own.
// Operator-chosen sentinel (not a security boundary — admin approval
// + must_change_password gate are what actually protect access).
const TEMP_PASSWORD = 'glidepathpassword'

/**
 * Admin invite flow.
 *
 * Creates the auth.users row directly with email_confirm: true and
 * a fixed temp password ('glidepathpassword'). The handle_new_user()
 * trigger fires on INSERT and creates the profile row with status=
 * 'pending'. We then UPDATE the profile to set status='active' (the
 * admin already approved by inviting them) and must_change_password=
 * true (gates first-time access at /setup-account).
 *
 * Sends a plain-text-style HTML email with the temp password in the
 * body. NO deep link to glidepathops.com — Defender for Office 365
 * quarantines those on .mil tenants. The user signs in normally with
 * the temp password and the login page redirects them to
 * /setup-account when it detects must_change_password=true.
 */
export async function POST(request: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 500 },
      )
    }

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

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, role, primary_base_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !isAdmin(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, rank, firstName, lastName, unit, officeSymbol, civilianAirport, role, installationId } = body as {
      email: string
      rank: string
      firstName: string
      lastName: string
      unit?: string
      officeSymbol?: string
      civilianAirport?: boolean
      role: string
      installationId: string
    }

    if (!email || !rank || !firstName || !lastName || !installationId) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (!civilianAirport && (!unit?.trim() || !officeSymbol?.trim())) {
      return NextResponse.json(
        { error: 'Unit and Office Symbol are required at military airfields' },
        { status: 400 },
      )
    }

    if (!isSysAdmin(callerProfile.role)) {
      const adminRoles = ['sys_admin', 'base_admin']
      if (adminRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Base admins can only invite users with non-admin roles' },
          { status: 403 },
        )
      }
      if (!canBaseAdminManageUser(callerProfile.primary_base_id, installationId)) {
        return NextResponse.json(
          { error: 'Base admins can only invite users to their own installation' },
          { status: 403 },
        )
      }
    }

    const normFirst = toTitleCaseName(firstName)
    const normLast = toTitleCaseName(lastName)
    const fullName = `${normFirst} ${normLast}`

    // Create the user with the temp password and email confirmed.
    // user_metadata flows into raw_user_meta_data which handle_new_user()
    // reads to populate the profile row.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: normFirst,
        last_name: normLast,
        name: fullName,
        rank: rank,
        unit: unit?.trim() || undefined,
        office_symbol: officeSymbol?.trim() || undefined,
        role: role || 'read_only',
        primary_base_id: installationId,
      },
    })

    if (createError || !created?.user) {
      const status = /already|exists|registered/i.test(createError?.message || '') ? 409 : 400
      return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status })
    }

    // Admin invite = admin pre-approval. Flip status from the trigger's
    // default 'pending' to 'active' and set the must_change_password
    // gate so the login flow forces them through /setup-account.
    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ status: 'active', must_change_password: true })
      .eq('id', created.user.id)

    if (profileUpdateError) {
      console.error('[admin/invite] Profile update failed:', profileUpdateError)
      // Don't roll back — the user is created and can still be activated
      // manually via /users. Surface the issue but return success.
    }

    // Best-effort email. Plain HTML, no deep links, info@ sender,
    // text/plain alternative. Mirrors the deliverability-tested PPR
    // confirmation pattern. The temp password is in the body — these
    // emails go to .mil + commercial recipients alike; admin-created
    // credentials in a transactional email to the rightful owner is
    // the same risk profile as a password reset email.
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const html = `
        <p>Hello ${escapeHtml(fullName)},</p>
        <p>You've been invited to Glidepath by your installation's administrator. Your account is ready.</p>
        <p><strong>Sign-in email:</strong> ${escapeHtml(email)}<br>
        <strong>Temporary password:</strong> <code>${escapeHtml(TEMP_PASSWORD)}</code></p>
        <p>On your first sign-in you'll be prompted to choose a new password. Sign in at the Glidepath URL provided by your administrator.</p>
        <p>If you have questions, contact your installation's Airfield Manager or <a href="mailto:info@glidepathops.com">info@glidepathops.com</a>.</p>
      `
      const text = [
        `Hello ${fullName},`,
        '',
        "You've been invited to Glidepath by your installation's administrator. Your account is ready.",
        '',
        `Sign-in email: ${email}`,
        `Temporary password: ${TEMP_PASSWORD}`,
        '',
        "On your first sign-in you'll be prompted to choose a new password. Sign in at the Glidepath URL provided by your administrator.",
        '',
        "If you have questions, contact your installation's Airfield Manager or info@glidepathops.com.",
      ].join('\n')

      try {
        const resend = new Resend(resendKey)
        const { error: sendError } = await resend.emails.send({
          from: 'Glidepath <info@glidepathops.com>',
          replyTo: 'info@glidepathops.com',
          to: email,
          subject: "You've been invited to Glidepath",
          html,
          text,
        })
        if (sendError) {
          console.error('[admin/invite] Resend error:', sendError)
        }
      } catch (e) {
        console.error('[admin/invite] Email send threw:', e)
      }
    }

    return NextResponse.json({
      success: true,
      userId: created.user.id,
      tempPassword: TEMP_PASSWORD,
    })
  } catch (err) {
    console.error('[admin/invite] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
