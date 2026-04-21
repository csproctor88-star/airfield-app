'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { unseenReleaseNotes, type ReleaseNote } from '@/lib/release-notes'
import { WhatsNewModal } from '@/components/whats-new-modal'

/** Mounts once per app-shell render, checks whether the signed-in user has
 *  already seen the latest release notes, and pops the What's New modal if
 *  not. Fails silently on demo mode (no Supabase) and on unauthenticated
 *  requests — the login pages live outside this provider anyway. */
export function WhatsNewGate() {
  const [notes, setNotes] = useState<ReleaseNote[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    if (!supabase) return

    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled || !user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('last_seen_release_version')
          .eq('id', user.id)
          .single()

        if (cancelled) return
        const lastSeen = (profile as { last_seen_release_version?: string | null } | null)?.last_seen_release_version
        const unseen = unseenReleaseNotes(lastSeen)
        if (unseen.length > 0) setNotes(unseen)
      } catch {
        // Missing column, no row, network hiccup — skip silently.
      }
    })()

    return () => { cancelled = true }
  }, [])

  if (!notes) return null
  return <WhatsNewModal notes={notes} onDismiss={() => setNotes(null)} />
}
