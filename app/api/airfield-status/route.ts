import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) {
    console.error('[airfield-status] Missing env:', { hasUrl: !!url, hasKey: !!key })
    return null
  }
  return createClient(url, key)
}

async function requireAuth(): Promise<{ user: { id: string } } | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return { user }
}

/** GET — return the caller's airfield_status row.
 *
 * SECURITY (M-1): the read goes through the caller's RLS-scoped session
 * client, NOT the service-role client. Previously this used the service role
 * with `.limit(1).single()` and no base filter, so any authenticated user
 * received whichever base's status row sorted first — a cross-tenant leak.
 * RLS (airfield_status_select, base-scoped) now confines the result to bases
 * the caller actually belongs to.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('airfield_status')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** PATCH — update airfield_status fields */
export async function PATCH(request: Request) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = getAdmin()
  if (!supabase) return NextResponse.json({ error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })

  // AUTHORIZATION: this route writes with the service-role client, which bypasses
  // RLS — so the permission check the database would normally enforce must be done
  // explicitly here. Without it, any authenticated account (including read-only or
  // kiosk) could change the status board. Require the 'airfield_status:write'
  // permission, exactly as the RLS policy on the normal client path requires.
  const { data: canWrite } = await supabase.rpc('user_has_permission', {
    p_user_id: auth.user.id,
    p_key: 'airfield_status:write',
  })
  if (canWrite !== true) {
    return NextResponse.json({ error: 'You do not have permission to update airfield status.' }, { status: 403 })
  }

  const updates = await request.json()

  // Resolve the caller's base EXPLICITLY rather than selecting an arbitrary
  // airfield_status row (M-3 correctness landmine): with one row per base,
  // `.limit(1).single()` returned whichever row sorted first, so the caller could
  // neither reliably target their own base nor be safely denied. Prefer an explicit
  // base_id from the body; otherwise fall back to the caller's membership only when
  // it is unambiguous (exactly one base). base_id is never written (see WRITABLE).
  let targetBaseId: string | null =
    typeof updates?.base_id === 'string' && updates.base_id ? updates.base_id : null
  if (!targetBaseId) {
    const { data: memberships } = await supabase
      .from('base_members')
      .select('base_id')
      .eq('user_id', auth.user.id)
    const ids = (memberships ?? []).map((m) => m.base_id as string).filter(Boolean)
    if (ids.length === 1) targetBaseId = ids[0]
    else return NextResponse.json({ error: 'base_id required to disambiguate the target base' }, { status: 400 })
  }

  // Confirm the caller has access to the resolved base.
  const { data: hasBase } = await supabase.rpc('user_has_base_access', {
    p_user_id: auth.user.id,
    p_base_id: targetBaseId,
  })
  if (hasBase !== true) {
    return NextResponse.json({ error: 'You do not have access to this base.' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('airfield_status')
    .select('id')
    .eq('base_id', targetBaseId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'No airfield_status row for this base' }, { status: 404 })

  // SECURITY (L-17): never spread the raw body into the UPDATE. Pick only
  // the columns this route is allowed to change, so a crafted request can't
  // smuggle id / base_id / audit columns into the write.
  const WRITABLE = ['runway_status', 'active_runway', 'advisory_type', 'advisory_text', 'runway_statuses'] as const
  const safeUpdates: Record<string, unknown> = {}
  for (const col of WRITABLE) {
    if (col in updates) safeUpdates[col] = updates[col]
  }

  const { error } = await supabase
    .from('airfield_status')
    .update({
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit logging is handled by the database trigger (trg_log_airfield_status)

  return NextResponse.json({ ok: true })
}
