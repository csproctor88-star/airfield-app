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
  const cookieStore = cookies()
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return { user }
}

/** GET — return the single airfield_status row */
export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const supabase = getAdmin()
  if (!supabase) return NextResponse.json({ error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })

  const { data, error } = await supabase
    .from('airfield_status')
    .select('*')
    .limit(1)
    .single()

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

  // Get the current row ID
  const { data: existing } = await supabase
    .from('airfield_status')
    .select('id, base_id, runway_status, active_runway, advisory_type, advisory_text, runway_statuses')
    .limit(1)
    .single()

  if (!existing) return NextResponse.json({ error: 'No airfield_status row' }, { status: 404 })

  // Confirm the caller actually has access to the base this row belongs to.
  if (existing.base_id) {
    const { data: hasBase } = await supabase.rpc('user_has_base_access', {
      p_user_id: auth.user.id,
      p_base_id: existing.base_id,
    })
    if (hasBase !== true) {
      return NextResponse.json({ error: 'You do not have access to this base.' }, { status: 403 })
    }
  }

  const { error } = await supabase
    .from('airfield_status')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit logging is handled by the database trigger (trg_log_airfield_status)

  return NextResponse.json({ ok: true })
}
