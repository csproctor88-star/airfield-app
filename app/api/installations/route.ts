import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** POST — find or create an installation by name, optionally add user as member */
export async function POST(request: Request) {
  try {
    const supabase = getAdmin()
    if (!supabase) {
      console.error('[installations] SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not configured')
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

    // Check if an installation already exists by name OR ICAO code
    const { data: byName, error: lookupError } = await supabase
      .from('bases')
      .select('*')
      .ilike('name', trimmedName)
      .limit(1)
      .maybeSingle()

    if (lookupError) {
      console.error('[installations] Lookup failed:', lookupError.message, lookupError.code)
    }

    let installation = byName

    // Fallback: match by ICAO code to prevent duplicates with different names
    if (!installation && trimmedIcao) {
      const { data: byIcao } = await supabase
        .from('bases')
        .select('*')
        .ilike('icao', trimmedIcao)
        .limit(1)
        .maybeSingle()

      installation = byIcao
    }

    if (!installation) {
      const { data, error: insertError } = await supabase
        .from('bases')
        .insert({
          name: trimmedName,
          icao: trimmedIcao || null,
          unit: '',
          majcom: null,
          location: null,
          elevation_msl: null,
          timezone: 'America/New_York',
          ce_shops: [],
        })
        .select()
        .single()

      if (insertError) {
        console.error('[installations] Insert failed:', insertError.message, insertError.code, insertError.details)
        return NextResponse.json(
          { error: `Failed to create installation: ${insertError.message}` },
          { status: 500 },
        )
      }
      installation = data
    }

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

      await supabase
        .from('profiles')
        .update({ primary_base_id: installation.id })
        .eq('id', userId)
    }

    return NextResponse.json(installation)
  } catch (err) {
    console.error('[installations] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
