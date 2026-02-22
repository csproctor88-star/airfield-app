import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'
import { getSupabaseConfig } from '@/lib/utils'

export function createClient() {
  const config = getSupabaseConfig()
  if (!config) return null

  const cookieStore = cookies()

  return createServerClient<Database>(
    config.url,
    config.key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if middleware refreshes sessions.
          }
        },
      },
    }
  )
}
