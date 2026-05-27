import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/admin/role-checks'

// Self-signup flow.
//
// Creates the auth.users row with email_confirm: true so the user is
// immediately confirmed at the auth layer. The handle_new_user() trigger
// inserts profiles with status='pending' + a base_members row, which
// gates sign-in via the login page's pending-status check until a base
// admin approves the account.
//
// No verification email is sent — admin approval is the verification
// step in this model. The verification email pattern previously used
// here had two problems:
//   1. It was useless after toggling off Supabase project-level
//      "Confirm email" — the link did nothing because the user was
//      already permitted to sign in (and got blocked by pending status
//      until admin approval anyway).
//   2. It was unreliable for .mil recipients regardless of content —
//      Defender quarantined it because the body contained an external
//      glidepathops.com link (Safe Links scoring).
//
// The user sees "Account created — pending approval" in the form's
// success state. The Approved / Request Info / Rejected emails fire
// when an admin acts in the /users modal.
export async function POST(request: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 500 },
      )
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

    // createUser with email_confirm: true bypasses the verification
    // flow entirely. The handle_new_user() trigger still fires on
    // INSERT, populating profiles with status='pending'.
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: fullName,
        rank: rank || undefined,
        role: role || 'read_only',
        primary_base_id: primaryBaseId,
      },
    })

    if (createError) {
      // Surface "address already taken" as 409 so the form can show a
      // useful message; everything else is 400.
      const status = /already|exists|registered/i.test(createError.message) ? 409 : 400
      return NextResponse.json({ error: createError.message }, { status })
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
