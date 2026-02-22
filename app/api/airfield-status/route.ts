import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return null
  return createClient(url, key)
}

/** GET — return the single airfield_status row */
export async function GET() {
  const supabase = getAdmin()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

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
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const updates = await request.json()

  // Get the current row ID
  const { data: existing } = await supabase
    .from('airfield_status')
    .select('id, runway_status, active_runway, advisory_type, advisory_text')
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

  // Log to runway_status_log
  try {
    await supabase.from('runway_status_log').insert({
      old_runway_status: existing.runway_status,
      new_runway_status: updates.runway_status ?? existing.runway_status,
      old_active_runway: existing.active_runway,
      new_active_runway: updates.active_runway ?? existing.active_runway,
      old_advisory_type: existing.advisory_type,
      new_advisory_type: updates.advisory_type !== undefined ? updates.advisory_type : existing.advisory_type,
      old_advisory_text: existing.advisory_text,
      new_advisory_text: updates.advisory_text !== undefined ? updates.advisory_text : existing.advisory_text,
      changed_by: updates.updated_by || null,
    })
  } catch {
    // Audit log failure is non-fatal
  }

  return NextResponse.json({ ok: true })
}
