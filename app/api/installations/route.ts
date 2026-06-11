import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { BASE_DIRECTORY } from '@/lib/base-directory'
import { TYPICAL_BASE_PRESET } from '@/lib/modules-config'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
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

/** POST — find or create an installation by name, optionally add user as member.
 *  During signup the user is not yet authenticated, so auth is optional when
 *  the request only finds/creates from the pre-loaded BASE_DIRECTORY. */
export async function POST(request: Request) {
  try {
    // Try auth but allow unauthenticated for signup flow
    const auth = await requireAuth()
    const isAuthenticated = !(auth instanceof NextResponse)
    const authedUserId = isAuthenticated ? (auth as { user: { id: string } }).user.id : null

    const supabase = getAdmin()
    if (!supabase) {
      console.error('[installations] SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not configured')
      return NextResponse.json(
        { error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 500 },
      )
    }

    const body = await request.json()
    const { name, icao, userId, airportType } = body as { name?: string; icao?: string; userId?: string; airportType?: string }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Installation name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const trimmedIcao = icao?.trim().toUpperCase() || null
    // airport_type: validate against the DB CHECK constraint values; default to 'usaf'
    const normalizedAirportType: 'usaf' | 'faa_part139' =
      airportType === 'faa_part139' ? 'faa_part139' : 'usaf'

    // Unauthenticated requests (signup flow) can only create bases from BASE_DIRECTORY
    if (!isAuthenticated) {
      const inDirectory = BASE_DIRECTORY.some(b =>
        b.name.toLowerCase() === trimmedName.toLowerCase() ||
        (trimmedIcao && b.icao.toUpperCase() === trimmedIcao)
      )
      if (!inDirectory) {
        return NextResponse.json({ error: 'Installation not found in directory. Contact support to request a new installation.' }, { status: 403 })
      }
    }

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
          enabled_modules: TYPICAL_BASE_PRESET,
          setup_progress: {},
          // Set at creation time and immutable thereafter (DB trigger
          // bases_airport_type_immutable forbids change once activity_log
          // has rows). Drives every downstream mode-specific behavior.
          airport_type: normalizedAirportType,
          // Civilian bases default to Part 77 obstruction surfaces;
          // USAF bases default to UFC 3-260-01.
          obstruction_surface_set: normalizedAirportType === 'faa_part139'
            ? 'faa_part77'
            : 'ufc_3_260_01',
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

    // If userId provided, ensure user is a member of this installation.
    // SECURITY (C-1): membership writes are self-only and require auth.
    // The route runs with the service-role key (RLS-bypassing), so without
    // this gate any caller could join — or force-move — an arbitrary user
    // into any base by passing their UUID. A user may only enroll THEMSELVES,
    // and only once authenticated (the signup flow holds a session by the
    // time it enrolls). Adding OTHER users is the admin-invite route's job.
    if (userId) {
      if (!isAuthenticated || userId !== authedUserId) {
        return NextResponse.json(
          { error: 'You can only join an installation as yourself.' },
          { status: 403 },
        )
      }

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

/** DELETE — remove a user's membership from an installation */
export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth()
    if (auth instanceof NextResponse) return auth
    const authedUserId = auth.user.id

    const supabase = getAdmin()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 500 },
      )
    }

    const body = await request.json()
    const { baseId, userId } = body as { baseId?: string; userId?: string }

    if (!baseId || !userId) {
      return NextResponse.json({ error: 'baseId and userId are required' }, { status: 400 })
    }

    // SECURITY (C-1): a user may only remove THEIR OWN membership. The
    // service-role client bypasses RLS, so without this an attacker could
    // strip any user from any base.
    if (userId !== authedUserId) {
      return NextResponse.json(
        { error: 'You can only leave an installation as yourself.' },
        { status: 403 },
      )
    }

    // Don't allow removing if this is the user's primary base
    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_base_id')
      .eq('id', userId)
      .single()

    if (profile?.primary_base_id === baseId) {
      return NextResponse.json(
        { error: 'Cannot remove your current primary installation. Switch to another first.' },
        { status: 400 },
      )
    }

    // Remove base_members entry
    const { error: deleteError } = await supabase
      .from('base_members')
      .delete()
      .eq('base_id', baseId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('[installations] Delete member failed:', deleteError.message)
      return NextResponse.json(
        { error: `Failed to remove installation: ${deleteError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[installations] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
