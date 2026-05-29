import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { getAdminClient } from '@/lib/admin/role-checks'

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

  // Permission gate — call the SECURITY DEFINER helper directly. Avoids
  // importing from lib/permissions.ts (which is marked 'use client' and
  // would throw in this server-only bundle).
  const { data: hasPerm, error: permErr } = await admin.rpc(
    'user_has_permission',
    { p_user_id: user.id, p_key: 'base_setup:write' },
  )
  if (permErr) {
    return { error: `Permission check failed: ${permErr.message}`, status: 500 as const }
  }
  if (!hasPerm) {
    return { error: 'Forbidden — base_setup:write required', status: 403 as const }
  }

  // Verify the caller has access to this specific base (prevents an admin at
  // base A from rotating base B's token). Sys admins skip this check.
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'sys_admin') {
    const { data: membership } = await admin
      .from('base_members')
      .select('base_id')
      .eq('user_id', user.id)
      .eq('base_id', baseId)
      .maybeSingle()

    if (!membership) {
      return { error: 'Forbidden — not a member of this base', status: 403 as const }
    }
  }

  return { admin, userId: user.id }
}

export async function POST(request: Request) {
  try {
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
    // Store the secret in the service-role-only table, and flip the non-secret
    // kiosk_enabled flag on bases (drives the UI's "active" state).
    const { error } = await auth.admin
      .from('base_kiosk_tokens')
      .upsert({ base_id: baseId, token, updated_at: new Date().toISOString() } as never, { onConflict: 'base_id' })

    if (error) {
      console.error('[kiosk-token] upsert failed:', error)
      const hint = /relation.*base_kiosk_tokens.*does not exist/i.test(error.message)
        ? 'Database migration 2026061601_kiosk_token_isolation not applied yet.'
        : error.message
      return NextResponse.json({ error: hint }, { status: 500 })
    }

    const { error: flagError } = await auth.admin
      .from('bases')
      .update({ kiosk_enabled: true } as never)
      .eq('id', baseId)
    if (flagError) {
      console.error('[kiosk-token] kiosk_enabled flag update failed:', flagError)
      // Token was stored; the flag is cosmetic, so don't fail the request.
    }

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[kiosk-token] POST error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const baseId = new URL(request.url).searchParams.get('baseId')
    if (!baseId) {
      return NextResponse.json({ error: 'baseId is required' }, { status: 400 })
    }

    const auth = await authorize(request, baseId)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { error } = await auth.admin
      .from('base_kiosk_tokens')
      .delete()
      .eq('base_id', baseId)

    if (error) {
      console.error('[kiosk-token] DELETE failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { error: flagError } = await auth.admin
      .from('bases')
      .update({ kiosk_enabled: false } as never)
      .eq('id', baseId)
    if (flagError) {
      console.error('[kiosk-token] kiosk_enabled flag clear failed:', flagError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[kiosk-token] DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
