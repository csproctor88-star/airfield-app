import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { timingSafeEqual } from 'node:crypto'
import { getAdminClient } from '@/lib/admin/role-checks'
import { getSupabaseConfig } from '@/lib/utils'

// Kiosk auto-login.
//
// URL pattern: /kiosk/<ICAO>?token=<per-base-random-token>
// On hit:
//   1. Look up the base by ICAO.
//   2. Constant-time compare the query `token` against the base's row in
//      base_kiosk_tokens (a service-role-only table). Bases with no token row
//      are opt-out and reject outright.
//   3. Sign in as the per-base kiosk account (email = kiosk-<icao>@glidepathops.com,
//      password = process.env.KIOSK_PASSWORD).
//   4. If the account doesn't exist yet, auto-provision it (the
//      handle_new_user() trigger creates the profile + base_members row;
//      we flip status to 'active' since the account is system-managed).
//   5. Redirect to `/`. Session cookie is set on the redirect response.
//
// Two secrets defend this route:
//   • KIOSK_PASSWORD (server-only env var) — never leaves the server.
//   • the per-base kiosk token (base_kiosk_tokens, service-role only) — lives
//     in the URL. Treat the full URL like a share link; anyone with it can
//     view that base's board.

const EMAIL_DOMAIN = 'glidepathops.com'

function redirectToLogin(request: NextRequest, errorCode: string): NextResponse {
  const url = new URL('/login', request.url)
  url.searchParams.set('error', errorCode)
  return NextResponse.redirect(url)
}

/** Constant-time string compare that short-circuits mismatched lengths. */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { icao: string } },
) {
  const icao = (params.icao || '').toUpperCase()
  if (!/^[A-Z0-9]{3,4}$/.test(icao)) {
    return redirectToLogin(request, 'kiosk_invalid_icao')
  }

  const kioskPassword = process.env.KIOSK_PASSWORD
  if (!kioskPassword) {
    return redirectToLogin(request, 'kiosk_not_configured')
  }

  const admin = getAdminClient()
  const config = getSupabaseConfig()
  if (!admin || !config) {
    return redirectToLogin(request, 'kiosk_not_configured')
  }

  const providedToken = request.nextUrl.searchParams.get('token')
  if (!providedToken) {
    return redirectToLogin(request, 'kiosk_token_required')
  }

  // Look up the base. ICAO comparison is case-insensitive.
  const { data: base } = await admin
    .from('bases')
    .select('id, name, icao')
    .ilike('icao', icao)
    .maybeSingle()

  if (!base) {
    return redirectToLogin(request, 'kiosk_base_not_found')
  }

  // The token lives in the service-role-only base_kiosk_tokens table.
  const { data: tokenRow } = await admin
    .from('base_kiosk_tokens')
    .select('token')
    .eq('base_id', base.id)
    .maybeSingle()

  const expectedToken = (tokenRow as { token?: string | null } | null)?.token
  if (!expectedToken) {
    // Base has explicitly opted out of kiosk URLs (or hasn't set one yet).
    return redirectToLogin(request, 'kiosk_disabled')
  }

  if (!tokensMatch(providedToken, expectedToken)) {
    return redirectToLogin(request, 'kiosk_token_mismatch')
  }

  const kioskEmail = `kiosk-${icao.toLowerCase()}@${EMAIL_DOMAIN}`

  // Create the redirect response up front — Supabase cookies are written
  // into its cookie store, which is wired to set them on this response.
  const response = NextResponse.redirect(new URL('/', request.url))
  const cookieStore = cookies()

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // Happy path — account already exists.
  let signInError = (await supabase.auth.signInWithPassword({
    email: kioskEmail,
    password: kioskPassword,
  })).error

  if (signInError) {
    // Account probably missing — provision it. The handle_new_user() trigger
    // fires on INSERT and upserts the profile + base_members rows using
    // user_metadata, so we only need the createUser call here.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: kioskEmail,
      password: kioskPassword,
      email_confirm: true,
      user_metadata: {
        name: `Kiosk (${base.icao || icao})`,
        first_name: 'Kiosk',
        last_name: base.icao || icao,
        role: 'airfield_status',
        primary_base_id: base.id,
      },
    })

    if (createErr || !created?.user) {
      // createUser failed — most likely the user exists with a different
      // password (KIOSK_PASSWORD rotated). Operator needs to update the
      // password in the Supabase dashboard to match.
      return redirectToLogin(request, 'kiosk_auth_failed')
    }

    // Flip status to 'active' — trigger defaults to 'pending' for
    // self-registrations, but system-provisioned kiosks are always active.
    await admin
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', created.user.id)

    // Retry sign-in now that the account exists.
    signInError = (await supabase.auth.signInWithPassword({
      email: kioskEmail,
      password: kioskPassword,
    })).error

    if (signInError) {
      return redirectToLogin(request, 'kiosk_auth_failed')
    }
  }

  return response
}
