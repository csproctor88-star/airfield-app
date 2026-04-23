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
import { getSiteUrl } from '@/lib/site-url'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(request: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 500 },
      )
    }

    // Authenticate caller via cookie
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
    const { email, rank, firstName, lastName, role, installationId } = body as {
      email: string
      rank: string
      firstName: string
      lastName: string
      role: string
      installationId: string
    }

    // Validate required fields
    if (!email || !rank || !firstName || !lastName || !installationId) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Base admin restrictions
    if (!isSysAdmin(callerProfile.role)) {
      // Base admin can only invite with non-system-admin roles
      // They CAN invite airfield_manager and namo for their own base
      const adminRoles = ['sys_admin', 'base_admin']
      if (adminRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Base admins can only invite users with non-admin roles' },
          { status: 403 },
        )
      }
      // Base admin can only invite to their own base
      if (!canBaseAdminManageUser(callerProfile.primary_base_id, installationId)) {
        return NextResponse.json(
          { error: 'Base admins can only invite users to their own installation' },
          { status: 403 },
        )
      }
    }

    // generateLink with type:'invite' creates the user AND returns a magic
    // link without sending Supabase's default email. We then embed that link
    // in ONE branded Resend email — the user clicks it, verifies their email,
    // and lands on /setup-account in a single step.
    const siteUrl = getSiteUrl()
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const { data: inviteData, error: inviteError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: `${siteUrl}/auth/confirm?next=/setup-account`,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          name: fullName,
          rank: rank,
          role: role || 'read_only',
          primary_base_id: installationId,
        },
      },
    })

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 },
      )
    }

    const actionLink = inviteData?.properties?.action_link
    if (!actionLink) {
      return NextResponse.json(
        { error: 'Failed to generate invite link' },
        { status: 500 },
      )
    }

    // Send ONE branded invite email via Resend. The magic link handles email
    // verification + redirect to /setup-account on click — no separate
    // Supabase-default email.
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY missing — invite created but email not sent' },
        { status: 500 },
      )
    }

    try {
      const resend = new Resend(resendKey)
      await resend.emails.send({
        from: 'Glidepath <noreply@glidepathops.com>',
        replyTo: 'info@glidepathops.com',
        to: email,
        subject: 'You\'ve Been Invited to Glidepath',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1E293B;border-radius:12px;border:1px solid #334155;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0369A1,#22D3EE);padding:24px 32px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">GLIDEPATH</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF;">You're Invited</div>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#E2E8F0;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(fullName)}</strong>,</p>
          <p style="margin:0 0 16px;">You have been invited to join <strong>Glidepath</strong> — the airfield operations management platform.</p>
          <p style="margin:0 0 20px;">Click the button below to verify your email and set your password:</p>
          <div style="text-align:center;margin:0 0 20px;">
            <a href="${escapeHtml(actionLink)}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#0369A1,#22D3EE);color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;border-radius:8px;">Set Up Your Account</a>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:#94A3B8;">This link will expire in 24 hours.</p>
          <div style="font-size:13px;color:#94A3B8;border-top:1px solid #334155;padding-top:14px;margin-top:14px;">
            <strong>What is Glidepath?</strong>
            <ul style="margin:8px 0 0;padding-left:20px;">
              <li>Real-time airfield status and operations management</li>
              <li>Digital inspections, checks, and discrepancy tracking</li>
              <li>Works on any device — desktop, tablet, or mobile</li>
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
</html>`,
      })
    } catch (emailErr) {
      console.error('[admin/invite] Resend email failed:', emailErr)
      return NextResponse.json(
        { error: 'Invite created but email delivery failed. Contact the user manually.' },
        { status: 500 },
      )
    }

    // Create profile record
    if (inviteData?.user) {
      await admin.from('profiles').upsert({
        id: inviteData.user.id,
        email: email,
        name: `${firstName.trim()} ${lastName.trim()}`,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        rank: rank,
        role: role || 'read_only',
        primary_base_id: installationId,
        is_active: true,
        status: 'pending',
      })

      // Add base membership
      await admin.from('base_members').upsert(
        {
          base_id: installationId,
          user_id: inviteData.user.id,
          role: role || 'read_only',
        },
        { onConflict: 'base_id,user_id' },
      )
    }

    return NextResponse.json({
      success: true,
      userId: inviteData?.user?.id,
    })
  } catch (err) {
    console.error('[admin/invite] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
