import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  getAdminClient,
  isAdmin,
  isSysAdmin,
  canBaseAdminManageUser,
} from '@/lib/admin/role-checks'

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
    const { email, userId } = body as { email: string; userId: string }

    if (!email || !userId) {
      return NextResponse.json({ error: 'email and userId are required' }, { status: 400 })
    }

    // If base admin, verify target user is at their base
    if (!isSysAdmin(callerProfile.role)) {
      const { data: targetProfile } = await admin
        .from('profiles')
        .select('primary_base_id')
        .eq('id', userId)
        .single()

      if (!canBaseAdminManageUser(callerProfile.primary_base_id, targetProfile?.primary_base_id ?? null)) {
        return NextResponse.json(
          { error: 'You can only reset passwords for users at your installation' },
          { status: 403 },
        )
      }
    }

    // Send password reset email
    const { error: resetError } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin') || ''}/auth/confirm?next=/reset-password`,
    })

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reset-password] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
