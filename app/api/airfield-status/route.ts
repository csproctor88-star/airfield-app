import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) {
    console.error('[airfield-status] Missing env:', { hasUrl: !!url, hasKey: !!key })
    return null
  }
  return createClient(url, key)
}

/** GET — return the single airfield_status row */
export async function GET() {
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
  const supabase = getAdmin()
  if (!supabase) return NextResponse.json({ error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })

  const updates = await request.json()

  // Get the current row ID
  const { data: existing } = await supabase
    .from('airfield_status')
    .select('id, runway_status, active_runway, advisory_type, advisory_text, runway_statuses')
    .limit(1)
    .single()

  if (!existing) return NextResponse.json({ error: 'No airfield_status row' }, { status: 404 })

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
