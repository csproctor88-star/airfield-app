import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { canBaseAdminManageUser } from '@/lib/admin/role-checks'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Template builders ──
//
// Plain HTML, no external HTTP links, no styled CTA buttons, no
// gradient wrappers. Mirrors the deliverability-tested PPR
// confirmation pattern — those reach .mil inboxes; the prior
// brandedEmail wrapper (dark gradient + CTA button + glidepathops.com
// deep links) was being quarantined by Defender for Office 365.
//
// See memory feedback_mil_email_deliverability for the diagnostic
// trail. Until glidepathops.com is on the recipient tenant's
// Safe Links allowlist, no external HTTP links in transactional
// email bodies.

function approvedEmail(userName: string, customMessage?: string): { html: string; text: string } {
  const html = `
    <p>Hello ${escapeHtml(userName)},</p>
    <p>Your Glidepath account has been approved and is ready to use.</p>
    ${customMessage ? `
    <p><strong>Message from your administrator:</strong><br>${escapeHtml(customMessage)}</p>
    ` : ''}
    <p>Sign in to Glidepath as usual to start using the platform. If you've forgotten your password, you can reset it from the login page.</p>
    <p>If you have questions, contact your installation's Airfield Manager or <a href="mailto:info@glidepathops.com">info@glidepathops.com</a>.</p>
  `
  const text = [
    `Hello ${userName},`,
    '',
    'Your Glidepath account has been approved and is ready to use.',
    customMessage ? `\nMessage from your administrator: ${customMessage}\n` : '',
    "Sign in to Glidepath as usual to start using the platform. If you've forgotten your password, you can reset it from the login page.",
    '',
    "If you have questions, contact your installation's Airfield Manager or info@glidepathops.com.",
  ].filter((line) => line !== '').join('\n')
  return { html, text }
}

function infoNeededEmail(userName: string, customMessage: string): { html: string; text: string } {
  const html = `
    <p>Hello ${escapeHtml(userName)},</p>
    <p>Thank you for your interest in Glidepath. Before we can approve your account, we need some additional information:</p>
    <p><strong>${escapeHtml(customMessage)}</strong></p>
    <p>Please respond to this email or contact your installation's Airfield Manager with the requested information. Once we receive what's needed, your account will be reviewed for approval.</p>
  `
  const text = [
    `Hello ${userName},`,
    '',
    'Thank you for your interest in Glidepath. Before we can approve your account, we need some additional information:',
    '',
    customMessage,
    '',
    "Please respond to this email or contact your installation's Airfield Manager with the requested information. Once we receive what's needed, your account will be reviewed for approval.",
  ].join('\n')
  return { html, text }
}

function rejectedEmail(userName: string, reason?: string): { html: string; text: string } {
  const html = `
    <p>Hello ${escapeHtml(userName)},</p>
    <p>Thank you for your interest in Glidepath. After reviewing your account request, we are unable to approve access at this time.</p>
    ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
    <p>If you believe this was in error or your circumstances have changed, please contact your installation's Airfield Manager to discuss access.</p>
  `
  const text = [
    `Hello ${userName},`,
    '',
    'Thank you for your interest in Glidepath. After reviewing your account request, we are unable to approve access at this time.',
    reason ? `\nReason: ${reason}\n` : '',
    "If you believe this was in error or your circumstances have changed, please contact your installation's Airfield Manager to discuss access.",
  ].filter((line) => line !== '').join('\n')
  return { html, text }
}

// ── API Route ──

export async function POST(request: Request) {
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    // Authenticate caller
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
    if (!url || !key) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(url, key, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify caller is admin
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
    if (!serviceKey) {
      return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })
    }
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(url, serviceKey)
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, primary_base_id')
      .eq('id', user.id)
      .single()

    const adminRoles = ['sys_admin', 'base_admin', 'airfield_manager', 'namo']
    if (!callerProfile || !adminRoles.includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { template, customMessage, userId } = body as {
      template: 'approved' | 'info_needed' | 'rejected'
      customMessage?: string
      userId?: string
    }

    if (!template || !userId) {
      return NextResponse.json({ error: 'template and userId are required' }, { status: 400 })
    }

    // SECURITY (H-2): the target is identified ONLY by userId; the recipient
    // address and name are derived from the target's profile — never from the
    // request body (which previously let an admin email an arbitrary address
    // and activate/deactivate an out-of-scope account). Base admins are also
    // confined to their own installation.
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('email, name, primary_base_id')
      .eq('id', userId)
      .single()

    if (!targetProfile || !targetProfile.email) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    if (
      callerProfile.role !== 'sys_admin' &&
      !canBaseAdminManageUser(callerProfile.primary_base_id, targetProfile.primary_base_id)
    ) {
      return NextResponse.json(
        { error: 'You can only manage users at your own installation.' },
        { status: 403 },
      )
    }

    const toEmail = targetProfile.email
    const toName = targetProfile.name || targetProfile.email

    const resend = getResend()

    let html: string
    let text: string
    let subject: string

    switch (template) {
      case 'approved': {
        const built = approvedEmail(toName, customMessage)
        html = built.html
        text = built.text
        subject = 'Your Glidepath Account Has Been Approved'
        // Activate the user's profile
        if (userId) {
          await admin.from('profiles').update({ status: 'active', is_active: true }).eq('id', userId)
        }
        break
      }
      case 'info_needed': {
        if (!customMessage) {
          return NextResponse.json({ error: 'customMessage is required for info_needed template' }, { status: 400 })
        }
        const built = infoNeededEmail(toName, customMessage)
        html = built.html
        text = built.text
        subject = 'Glidepath Account — Additional Information Needed'
        break
      }
      case 'rejected': {
        const built = rejectedEmail(toName, customMessage)
        html = built.html
        text = built.text
        subject = 'Glidepath Account Request Update'
        // Deactivate the user's profile
        if (userId) {
          await admin.from('profiles').update({ status: 'rejected', is_active: false }).eq('id', userId)
        }
        break
      }
      default:
        return NextResponse.json({ error: 'Invalid template' }, { status: 400 })
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      replyTo: 'info@glidepathops.com',
      to: toEmail,
      subject,
      html,
      text,
    })

    if (sendError) {
      return NextResponse.json({ error: sendError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[user-emails] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
