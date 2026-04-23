import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { getAdminClient } from '@/lib/admin/role-checks'
import { getPermissionsFor } from '@/lib/permissions'

// Generate / clear the kiosk_token for a base.
//
// POST   /api/admin/kiosk-token { baseId }   → rotates to a new 32-byte random token
// DELETE /api/admin/kiosk-token?baseId=…     → clears the token (disables the kiosk URL)
//
// Auth: caller must hold `base_setup:write` AND be a member of the target base.

function newToken(): string {
  // 24 bytes → 32-char base64url. Long enough that guessing is computationally
  // infeasible; short enough that the URL stays manageable.
  return randomBytes(24).toString('base64url')
}

async function authorize(request: Request, baseId: string) {
  const admin = getAdminClient()
  if (!admin) return { error: 'Service not configured', status: 500 as const }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { error: 'Service not configured', status: 500 as const }

  const cookieStore = cookies()
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const perms = await getPermissionsFor(supabase, user.id)
  if (!perms.has('base_setup:write')) {
    return { error: 'Forbidden — base_setup:write required', status: 403 as const }
  }

  // Verify the caller has access to this specific base (prevents an admin at
  // base A from rotating base B's token).
  const { data: membership } = await admin
    .from('base_members')
    .select('base_id')
    .eq('user_id', user.id)
    .eq('base_id', baseId)
    .maybeSingle()

  if (!membership) {
    // Sys admins can rotate any base's token.
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'sys_admin') {
      return { error: 'Forbidden — not a member of this base', status: 403 as const }
    }
  }

  return { admin, userId: user.id }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { baseId?: string }
  const baseId = body.baseId
  if (!baseId) {
    return NextResponse.json({ error: 'baseId is required' }, { status: 400 })
  }

  const auth = await authorize(request, baseId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const token = newToken()
  const { error } = await auth.admin
    .from('bases')
    .update({ kiosk_token: token } as never)
    .eq('id', baseId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ token })
}

export async function DELETE(request: Request) {
  const baseId = new URL(request.url).searchParams.get('baseId')
  if (!baseId) {
    return NextResponse.json({ error: 'baseId is required' }, { status: 400 })
  }

  const auth = await authorize(request, baseId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { error } = await auth.admin
    .from('bases')
    .update({ kiosk_token: null } as never)
    .eq('id', baseId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
