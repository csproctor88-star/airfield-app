import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Branded email wrapper ──

function brandedEmail(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0B1120;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0B1120;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1E293B;border-radius:12px;border:1px solid #334155;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0369A1,#22D3EE);padding:24px 32px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">GLIDEPATH</div>
          <div style="font-size:22px;font-weight:800;color:#FFFFFF;">${escapeHtml(title)}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 32px;color:#E2E8F0;font-size:15px;line-height:1.6;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #334155;text-align:center;">
          <div style="font-size:11px;color:#64748B;">Glidepath Airfield Operations Platform</div>
          <div style="font-size:11px;color:#475569;margin-top:4px;">Guiding You to Mission Success</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Template builders ──

function approvedEmail(userName: string, loginUrl: string, customMessage?: string): string {
  return brandedEmail('Account Approved', `
    <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(userName)}</strong>,</p>
    <p style="margin:0 0 16px;">Your Glidepath account has been <span style="color:#22C55E;font-weight:700;">approved</span> and is ready to use.</p>
    ${customMessage ? `<div style="background:#0F172A;border:1px solid #334155;border-radius:8px;padding:14px 18px;margin:0 0 16px;">
      <div style="font-size:12px;font-weight:600;color:#94A3B8;margin-bottom:4px;">Message from your administrator:</div>
      <div style="color:#E2E8F0;">${escapeHtml(customMessage)}</div>
    </div>` : ''}
    <p style="margin:0 0 20px;">You can log in now and start using the platform:</p>
    <div style="text-align:center;margin:0 0 20px;">
      <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#0369A1,#22D3EE);color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;border-radius:8px;">Log In to Glidepath</a>
    </div>
    <div style="font-size:13px;color:#94A3B8;border-top:1px solid #334155;padding-top:14px;">
      <strong>Getting Started:</strong>
      <ul style="margin:8px 0 0;padding-left:20px;">
        <li>Complete your profile in Settings</li>
        <li>Review the Training module for a walkthrough of all features</li>
        <li>Contact your Airfield Manager if you have questions</li>
      </ul>
    </div>
  `)
}

function infoNeededEmail(userName: string, customMessage: string, loginUrl: string): string {
  return brandedEmail('Additional Information Needed', `
    <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(userName)}</strong>,</p>
    <p style="margin:0 0 16px;">Thank you for your interest in Glidepath. Before we can approve your account, we need some additional information:</p>
    <div style="background:#0F172A;border:1px solid #F59E0B40;border-left:3px solid #F59E0B;border-radius:8px;padding:14px 18px;margin:0 0 16px;">
      <div style="color:#FCD34D;font-weight:600;font-size:12px;margin-bottom:4px;">ACTION REQUIRED</div>
      <div style="color:#E2E8F0;">${escapeHtml(customMessage)}</div>
    </div>
    <p style="margin:0 0 16px;">Please respond to this email or contact your installation's Airfield Manager with the requested information.</p>
    <p style="margin:0;font-size:13px;color:#94A3B8;">Once we receive the necessary information, your account will be reviewed for approval.</p>
  `)
}

function rejectedEmail(userName: string, reason?: string): string {
  return brandedEmail('Account Request Update', `
    <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(userName)}</strong>,</p>
    <p style="margin:0 0 16px;">Thank you for your interest in Glidepath. After reviewing your account request, we are unable to approve access at this time.</p>
    ${reason ? `<div style="background:#0F172A;border:1px solid #EF444440;border-left:3px solid #EF4444;border-radius:8px;padding:14px 18px;margin:0 0 16px;">
      <div style="font-size:12px;font-weight:600;color:#FCA5A5;margin-bottom:4px;">Reason:</div>
      <div style="color:#E2E8F0;">${escapeHtml(reason)}</div>
    </div>` : ''}
    <p style="margin:0 0 16px;">If you believe this was in error or your circumstances have changed, please contact your installation's Airfield Manager to discuss access.</p>
    <p style="margin:0;font-size:13px;color:#94A3B8;">We appreciate your understanding.</p>
  `)
}

function pendingApprovalEmail(userName: string, formUrl?: string): string {
  return brandedEmail('Account Created — Pending Approval', `
    <p style="margin:0 0 16px;">Hello <strong>${escapeHtml(userName)}</strong>,</p>
    <p style="margin:0 0 16px;">Thank you for creating a Glidepath account. Your account has been received and is <span style="color:#F59E0B;font-weight:700;">pending approval</span> by your installation's administrator.</p>
    ${formUrl ? `<div style="background:#0F172A;border:1px solid #22D3EE40;border-left:3px solid #22D3EE;border-radius:8px;padding:14px 18px;margin:0 0 16px;">
      <div style="color:#22D3EE;font-weight:600;font-size:12px;margin-bottom:6px;">IMPORTANT — COMPLETE THIS STEP</div>
      <div style="color:#E2E8F0;margin-bottom:10px;">If you are onboarding a new base, please complete the Beta Access Request Form so we can verify your information and expedite your approval:</div>
      <div style="text-align:center;">
        <a href="${escapeHtml(formUrl)}" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#0369A1,#22D3EE);color:#FFFFFF;font-weight:700;font-size:14px;text-decoration:none;border-radius:6px;">Complete Beta Access Form</a>
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
  `)
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

    const cookieStore = cookies()
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
      .select('role')
      .eq('id', user.id)
      .single()

    const adminRoles = ['sys_admin', 'base_admin', 'airfield_manager', 'namo']
    if (!callerProfile || !adminRoles.includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { template, toEmail, toName, customMessage, userId } = body as {
      template: 'approved' | 'info_needed' | 'rejected'
      toEmail: string
      toName: string
      customMessage?: string
      userId?: string
    }

    if (!template || !toEmail || !toName) {
      return NextResponse.json({ error: 'template, toEmail, and toName are required' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://glidepathops.com'
    const loginUrl = `${siteUrl}/login`
    const resend = getResend()

    let html: string
    let subject: string

    switch (template) {
      case 'approved':
        html = approvedEmail(toName, loginUrl, customMessage)
        subject = 'Your Glidepath Account Has Been Approved'
        // Activate the user's profile
        if (userId) {
          await admin.from('profiles').update({ status: 'active', is_active: true }).eq('id', userId)
        }
        break
      case 'info_needed':
        if (!customMessage) {
          return NextResponse.json({ error: 'customMessage is required for info_needed template' }, { status: 400 })
        }
        html = infoNeededEmail(toName, customMessage, loginUrl)
        subject = 'Glidepath Account — Additional Information Needed'
        break
      case 'rejected':
        html = rejectedEmail(toName, customMessage)
        subject = 'Glidepath Account Request Update'
        // Deactivate the user's profile
        if (userId) {
          await admin.from('profiles').update({ status: 'rejected', is_active: false }).eq('id', userId)
        }
        break
      default:
        return NextResponse.json({ error: 'Invalid template' }, { status: 400 })
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Glidepath <noreply@glidepathops.com>',
      replyTo: 'info@glidepathops.com',
      to: toEmail,
      subject,
      html,
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
