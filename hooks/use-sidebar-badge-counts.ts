'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { fetchPendingTriageCount, fetchPendingApprovalCount } from '@/lib/supabase/ppr'
import { fetchPendingCoordinationCountForUser } from '@/lib/supabase/ppr-agency-members'

/**
 * Per-module pending-action counts for sidebar badges.
 *
 * Returns counts that the current user can act on, scoped to the
 * current installation. Subscribes to Supabase realtime so the dot
 * appears/clears within seconds of a state change in another tab.
 *
 * Exposes:
 *   ppr   — sum of buckets the user can act on:
 *           - has ppr:triage → pending_amops_triage entries
 *           - has ppr:approve → pending_amops_approval entries
 *           - has ppr:coordinate → pending coord rows on agencies
 *             where the current user is a member
 *   total — sum across all modules tracked here. Used to drive the
 *           Operations section-header dot.
 */
export function useSidebarBadgeCounts() {
  const { installationId } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()
  const pathname = usePathname()

  const [pprTriage, setPprTriage] = useState(0)
  const [pprApproval, setPprApproval] = useState(0)
  const [pprCoord, setPprCoord] = useState(0)

  const refresh = useCallback(async () => {
    if (!installationId || !permsLoaded) return
    const supabase = createClient()
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const tasks: Promise<unknown>[] = []
    if (has(PERM.PPR_TRIAGE)) {
      tasks.push(fetchPendingTriageCount(installationId).then(setPprTriage))
    } else {
      setPprTriage(0)
    }
    if (has(PERM.PPR_APPROVE)) {
      tasks.push(fetchPendingApprovalCount(installationId).then(setPprApproval))
    } else {
      setPprApproval(0)
    }
    if (has(PERM.PPR_COORDINATE)) {
      tasks.push(
        fetchPendingCoordinationCountForUser(installationId, user.id).then(setPprCoord),
      )
    } else {
      setPprCoord(0)
    }
    await Promise.all(tasks)
  }, [installationId, has, permsLoaded])

  // Initial fetch + on installation/permission change + on
  // in-app navigation. The sidebar persists across route changes,
  // so neither focus nor visibilitychange fires on a sidebar click
  // — pathname is the only signal that pulls fresh data when the
  // user navigates between modules within the same tab.
  useEffect(() => {
    refresh()
  }, [refresh, pathname])

  // Realtime — refresh on any ppr_entries / ppr_coordination change
  // for this base. The /ppr page already subscribes; another channel
  // here is cheap and isolates the sidebar's data. Subscribe status
  // is logged so we can tell from devtools whether the channel is
  // alive when the badge appears stuck.
  useEffect(() => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return

    const channel = supabase
      .channel(`sidebar-ppr-${installationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ppr_entries', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ppr_coordination' },
        // Coord rows aren't base-scoped at the row level (entry_id only),
        // so refresh on any change — the count query filters by base.
        () => refresh(),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[sidebar-badge] realtime channel', status,
            '— polling fallback will keep counts current')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [installationId, refresh])

  // Action bridge. Mutation handlers (approve/deny/triage/coordinate
  // on /ppr) dispatch `glidepath:badges-refresh` after they succeed,
  // so the badge updates instantly without depending on the realtime
  // websocket — which has been observed to silently fail on prod.
  // Pages don't need to import the hook; firing the event is the
  // entire contract.
  useEffect(() => {
    function onRefresh() { refresh() }
    window.addEventListener('glidepath:badges-refresh', onRefresh)
    return () => window.removeEventListener('glidepath:badges-refresh', onRefresh)
  }, [refresh])

  // Polling fallback. Realtime can silently fail for several reasons
  // — websocket dropped, RLS denying the payload, publication
  // metadata staleness, schema change after subscribe — and the user
  // shouldn't have to refresh the page. 30s is a reasonable trade-off
  // between staleness and load (3 small count queries per tick).
  useEffect(() => {
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  // Fallback for missed realtime events when the user switches
  // BROWSER tabs (vs. in-app sidebar navigation, which is handled by
  // the pathname effect above). visibilitychange fires when the tab
  // becomes visible; focus fires when the window regains focus.
  useEffect(() => {
    function onFocus() { refresh() }
    function onVisibility() { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  const ppr = pprTriage + pprApproval + pprCoord
  const total = ppr

  return { ppr, total }
}
