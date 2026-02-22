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

    if (!user && !request.nextUrl.pathname.startsWith('/login')) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }

    return supabaseResponse
  } catch {
    // If auth check fails, redirect to login as a safety fallback
    if (!request.nextUrl.pathname.startsWith('/login')) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)',
  ],
}
