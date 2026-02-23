import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return null
  return createClient(url, key)
}

/** POST — find or create an installation by name, optionally add user as member */
export async function POST(request: Request) {
  const supabase = getAdmin()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 500 },
    )
  }

  const body = await request.json()
  const { name, icao, userId } = body as { name?: string; icao?: string; userId?: string }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Installation name is required' }, { status: 400 })
  }

  const trimmedName = name.trim()
  const trimmedIcao = icao?.trim().toUpperCase() || null

  // Check if an installation with this name already exists
  const { data: existing } = await supabase
    .from('bases')
    .select('*')
    .ilike('name', trimmedName)
    .limit(1)
    .single()

  const installation = existing ?? await (async () => {
    const { data, error } = await supabase
      .from('bases')
      .insert({
        name: trimmedName,
        icao: trimmedIcao,
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
      return null
    }
    return data
  })()

  if (!installation) {
    return NextResponse.json({ error: 'Failed to create installation' }, { status: 500 })
  }

  // If userId provided, ensure user is a member of this installation
  if (userId) {
    await supabase
      .from('base_members')
      .upsert(
        { base_id: installation.id, user_id: userId, role: 'read_only' },
        { onConflict: 'base_id,user_id' },
      )

    // Also set as user's primary base
    await supabase
      .from('profiles')
      .update({ primary_base_id: installation.id })
      .eq('id', userId)
  }

  return NextResponse.json(installation)
}
