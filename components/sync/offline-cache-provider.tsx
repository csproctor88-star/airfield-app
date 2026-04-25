'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const OFFLINE_READ_CACHES = [
  'glidepath-offline-reads-rest',
  'glidepath-offline-reads-storage',
]

async function clearOfflineReadCaches() {
  if (typeof caches === 'undefined') return
  await Promise.all(
    OFFLINE_READ_CACHES.map((name) => caches.delete(name).catch(() => false))
  )
}

/**
 * Wipes Workbox runtime caches that hold RLS-scoped Supabase responses whenever
 * a user signs out. Cache keys are URL-only, so without this a different user
 * signing in on the same device could see the prior user's cached rows when
 * offline. Mount once inside the authed app shell.
 */
export function OfflineCacheProvider() {
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        void clearOfflineReadCaches()
      }
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  return null
}
