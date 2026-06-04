import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig } from '@/lib/utils'

export async function middleware(request: NextRequest) {
  const config = getSupabaseConfig()

  // Demo mode: skip auth entirely when Supabase is not configured
  if (!config) {
    return NextResponse.next()
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user && !isPublicPath(request.nextUrl.pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }

    return supabaseResponse
  } catch {
    // If auth check fails, redirect to login as a safety fallback
    if (!isPublicPath(request.nextUrl.pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }
    return NextResponse.next()
  }
}

/** Paths that bypass the auth gate. Anonymous visitors land here
 *  via QR codes, password resets, public submission forms, etc. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/login')
    || pathname.startsWith('/reset-password')
    || pathname.startsWith('/setup-account')
    || pathname.startsWith('/auth/confirm')
    || pathname.startsWith('/api/installations')
    || pathname.startsWith('/api/signup-email')
    || pathname.startsWith('/api/send-ppr-confirmation')
    // Vercel cron routes: invoked by Vercel with no auth cookie, so they must
    // bypass the cookie auth-gate — otherwise middleware 307-redirects them to
    // /login and the handler never runs. Each enforces Bearer CRON_SECRET
    // itself, so this is not an open endpoint.
    || pathname.startsWith('/api/amtr-due-reconcile')
    || pathname.startsWith('/api/training-expiry-digest')
    || pathname.startsWith('/api/annual-review-digest')
    || pathname.startsWith('/feedback')
    || pathname.startsWith('/ppr-request')
    || pathname.startsWith('/kiosk')
    // Short PPR request URL: /<icao>/ppr-request[/...]. The route
    // handler validates the ICAO and shows a not-found state if the
    // base doesn't exist, so a permissive prefix match is safe.
    || /^\/[^/]+\/ppr-request(\/.*)?$/.test(pathname)
  )
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
