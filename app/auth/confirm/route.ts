import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseConfig } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('next')

  const config = getSupabaseConfig()
  if (!config) {
    redirectTo.pathname = '/login'
    return NextResponse.redirect(redirectTo)
  }

  if (token_hash && type) {
    const cookieStore = cookies()
    const supabase = createServerClient(config.url, config.key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    })

    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      return NextResponse.redirect(redirectTo)
    }

    console.error('[auth/confirm] OTP verification failed:', error.message)
  }

  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'Email link is invalid or has expired')
  return NextResponse.redirect(redirectTo)
}
