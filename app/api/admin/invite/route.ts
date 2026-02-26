import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  getAdminClient,
  isSysAdmin,
  isAdmin,
  canBaseAdminManageUser,
} from '@/lib/admin/role-checks'

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
      // Base admin can only invite with role 'user' (or equivalent non-admin roles)
      const adminRoles = ['sys_admin', 'base_admin', 'airfield_manager', 'namo']
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

    // Invite user via Supabase auth admin
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin') || ''
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${siteUrl}/auth/confirm?next=/setup-account`,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`,
          rank: rank,
          role: role || 'read_only',
          primary_base_id: installationId,
        },
      },
    )

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 },
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
