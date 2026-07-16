import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig } from '@/lib/utils'

export async function middleware(request: NextRequest) {
  const config = getSupabaseConfig()

  // Demo mode: skip auth entirely when Supabase is not configured.
  //
  // SECURITY (L-4): in production this is fail-CLOSED. A real deployment
  // always has Supabase configured, so a missing/typo'd config there is a
  // misconfiguration — silently skipping the auth gate would expose the whole
  // app. The no-auth demo bypass is allowed only outside production or when a
  // deployment explicitly opts in via NEXT_PUBLIC_ALLOW_DEMO.
  if (!config) {
    const demoAllowed =
      process.env.NODE_ENV !== 'production' ||
      process.env.NEXT_PUBLIC_ALLOW_DEMO === 'true'
    if (demoAllowed) {
      return NextResponse.next()
    }
    if (!isPublicPath(request.nextUrl.pathname)) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }
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
    // Anonymous public-write server hops (PPR request, SMS safety report,
    // customer feedback). 3f5e4dbe fronted the public RPCs with IP+base rate
    // limits but never allowlisted the new paths, so the middleware
    // 307-redirected the anonymous POSTs to /login and all three forms died
    // with "Submission failed" for 12 days (the same failure M-6 fixed for
    // forgot-password). Each route enforces its own rate limit, so this is
    // not an open endpoint. Listed explicitly rather than as a blanket
    // `/api/public/` prefix so a NEW route dropped under that namespace is
    // gated by default (fail-safe) and made public only by a deliberate edit
    // here.
    || pathname.startsWith('/api/public/ppr-request')
    || pathname.startsWith('/api/public/safety-report')
    || pathname.startsWith('/api/public/feedback')
    // Self-service password reset is called by anonymous users from the
    // login page. Without this it was 307-redirected to /login (405) and
    // silently failed — see M-6. The handler is per-email + per-IP
    // rate-limited.
    || pathname.startsWith('/api/forgot-password')
    // Vercel cron routes: invoked by Vercel with no auth cookie, so they must
    // bypass the cookie auth-gate — otherwise middleware 307-redirects them to
    // /login and the handler never runs. Each enforces Bearer CRON_SECRET
    // itself, so this is not an open endpoint.
    || pathname.startsWith('/api/amtr-due-reconcile')
    || pathname.startsWith('/api/training-expiry-digest')
    || pathname.startsWith('/api/annual-review-digest')
    // Public QR forms live at /feedback/<baseId> and /ppr-request/<baseId>.
    // Anchor to the dynamic child so the bare authenticated staff page at
    // /feedback (app/(app)/feedback) is NOT exempted from the auth gate.
    || /^\/feedback\/[^/]+/.test(pathname)
    || /^\/ppr-request\/[^/]+/.test(pathname)
    || pathname.startsWith('/kiosk')
    // Short public QR URLs: /<icao>/ppr-request and /<icao>/sms-report.
    // Both route handlers validate the ICAO and show a not-found state if
    // the base doesn't exist, so a permissive prefix match is safe. The
    // SMS safety-report form is an anonymous hazard-reporting channel
    // (AC 150/5200-37A) — M-7 restored it to the allowlist.
    || /^\/[^/]+\/(ppr-request|sms-report)(\/.*)?$/.test(pathname)
  )
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
