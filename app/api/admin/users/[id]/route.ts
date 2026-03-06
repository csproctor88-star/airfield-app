import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  getAdminClient,
  isAdmin,
  isSysAdmin,
  canBaseAdminManageUser,
  sanitizeBaseAdminUpdate,
} from '@/lib/admin/role-checks'

/** PATCH — Update a user's profile */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
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

    const targetId = params.id

    // Fetch caller's profile
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, role, primary_base_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !isAdmin(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch target user's profile
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, primary_base_id')
      .eq('id', targetId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    let updates = body as Record<string, unknown>

    // Base admin restrictions
    if (!isSysAdmin(callerProfile.role)) {
      // Must be at same base
      if (!canBaseAdminManageUser(callerProfile.primary_base_id, targetProfile.primary_base_id)) {
        return NextResponse.json(
          { error: 'You can only manage users at your installation' },
          { status: 403 },
        )
      }
      // Strip restricted fields
      updates = sanitizeBaseAdminUpdate(updates)
    }

    // Sys admin specific: if promoting to admin role, caller must be sys_admin
    if (updates.role && ['sys_admin', 'base_admin', 'airfield_manager', 'namo'].includes(updates.role as string)) {
      if (!isSysAdmin(callerProfile.role)) {
        return NextResponse.json(
          { error: 'Only system admins can assign admin roles' },
          { status: 403 },
        )
      }
    }

    // Also update the 'name' field if first_name or last_name changed
    if (updates.first_name || updates.last_name) {
      // Fetch current values to merge
      const { data: current } = await admin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', targetId)
        .single()

      const newFirst = (updates.first_name as string) || current?.first_name || ''
      const newLast = (updates.last_name as string) || current?.last_name || ''
      updates.name = `${newFirst} ${newLast}`.trim()
    }

    // Apply update
    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', targetId)
      .select('*, bases(name, icao)')
      .single()

    if (updateError) {
      console.error('[admin/users/PATCH] Update error:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      )
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[admin/users/PATCH] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}

/** DELETE — Permanently delete a user account */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const admin = getAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
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

    const targetId = params.id

    // Fetch caller's profile — only sys_admin can delete
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !isSysAdmin(callerProfile.role)) {
      return NextResponse.json({ error: 'Only system admins can delete users' }, { status: 403 })
    }

    // Prevent self-deletion
    if (targetId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    // Unlink all foreign key references so historical data is preserved.
    // After running migration 2026022802, these columns allow NULL and have ON DELETE SET NULL,
    // so Postgres handles it automatically. These explicit updates are a safety net.
    const nullify = (table: string, column: string) =>
      admin.from(table).update({ [column]: null } as Record<string, unknown>).eq(column, targetId).then(() => {})

    await Promise.all([
      nullify('waivers', 'created_by'),
      nullify('waivers', 'updated_by'),
      nullify('inspections', 'inspector_id'),
      nullify('discrepancies', 'assigned_to'),
      nullify('discrepancies', 'reported_by'),
      nullify('photos', 'uploaded_by'),
      nullify('navaid_statuses', 'updated_by'),
      nullify('obstruction_evaluations', 'evaluated_by'),
      nullify('activity_log', 'user_id'),
      nullify('status_updates', 'updated_by'),
      nullify('waiver_reviews', 'reviewed_by'),
      nullify('runway_status_log', 'changed_by'),
      nullify('airfield_contractors', 'created_by'),
    ]).catch((err) => {
      console.warn('[admin/users/DELETE] Some FK nullify failed (run migration 2026022802):', err)
    })

    // Delete from base_members
    await admin.from('base_members').delete().eq('user_id', targetId)

    // Delete from user_regulation_pdfs (has ON DELETE CASCADE but be explicit)
    await admin.from('user_regulation_pdfs').delete().eq('user_id', targetId)

    // Delete from profiles table
    const { error: profileDeleteError } = await admin
      .from('profiles')
      .delete()
      .eq('id', targetId)

    if (profileDeleteError) {
      console.error('[admin/users/DELETE] Profile delete error:', profileDeleteError)
      return NextResponse.json({ error: profileDeleteError.message }, { status: 500 })
    }

    // Delete from Supabase auth
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetId)
    if (authDeleteError) {
      console.error('[admin/users/DELETE] Auth delete error:', authDeleteError)
      return NextResponse.json({ error: authDeleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users/DELETE] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
