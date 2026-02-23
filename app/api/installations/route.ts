import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return null
  return createClient(url, key)
}

/** POST — create a new installation */
export async function POST(request: Request) {
  const supabase = getAdmin()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 500 },
    )
  }

  const body = await request.json()
  const { name, icao } = body as { name?: string; icao?: string }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Installation name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bases')
    .insert({
      name: name.trim(),
      icao: (icao || '').trim().toUpperCase(),
      unit: '',
      majcom: null,
      location: null,
      elevation_msl: null,
      timezone: 'America/New_York',
      ce_shops: [],
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create installation:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
