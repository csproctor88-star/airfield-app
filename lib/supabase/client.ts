import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'
import { getSupabaseConfig } from '@/lib/utils'

export function createClient() {
  const config = getSupabaseConfig()
  if (!config) return null
  return createBrowserClient<Database>(config.url, config.key)
}
