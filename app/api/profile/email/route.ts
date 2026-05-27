import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/admin/role-checks'

/**
 * Self-service email change. Authenticated users only; they can only
 * change their own email. The change bypasses Supabase's default
 * double-confirmation flow (`email_confirm: true`) because that flow
 * sends an email to both old and new addresses for verification, and
 * those emails are unreliable on .mil tenants (Defender for Office
 * 365 quarantines them — same root cause as the signup-email
 * deliverability work earlier).
 *
 * The auth session continues uninterrupted on the new email. The
 * user uses the new address to sign in going forward.
 *
 * profiles.email is updated alongside auth.users.email so the two
 * stay in sync (there's no trigger keeping them aligned).
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
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim().replace(/^["']|["']$/g, '')

    const cookieStore = cookies()
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email } = body as { email?: string }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const trimmed = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (trimmed === (user.email || '').toLowerCase()) {
      return NextResponse.json({ error: 'New email matches current email' }, { status: 400 })
    }

    // Update auth.users via admin API — bypasses the double-confirmation
    // email flow that doesn't work on .mil. The user's session token is
    // tied to user.id (not email), so they stay signed in.
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      email: trimmed,
      email_confirm: true,
    })

    if (authError) {
      console.error('[profile/email] Auth update failed:', authError)
      // Surface the "address already taken" / similar Supabase errors as 4xx.
      const status = /already|exists|registered/i.test(authError.message) ? 409 : 400
      return NextResponse.json({ error: authError.message }, { status })
    }

    // Keep profiles.email in sync. If this fails the auth side already
    // changed, so log the divergence but don't unwind — the auth email
    // is the source of truth for sign-in.
    const { error: profileError } = await admin
      .from('profiles')
      .update({ email: trimmed })
      .eq('id', user.id)

    if (profileError) {
      console.error('[profile/email] profiles row out of sync:', profileError)
    }

    return NextResponse.json({ success: true, email: trimmed })
  } catch (err) {
    console.error('[profile/email] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
