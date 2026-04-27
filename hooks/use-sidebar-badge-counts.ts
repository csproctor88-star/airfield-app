'use client'

import { useState, useEffect, useCallback } from 'react'
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

  // Initial fetch + on installation/permission change.
  useEffect(() => {
    refresh()
  }, [refresh])

  // Realtime — refresh on any ppr_entries / ppr_coordination change
  // for this base. The /ppr page already subscribes; another channel
  // here is cheap and isolates the sidebar's data.
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [installationId, refresh])

  const ppr = pprTriage + pprApproval + pprCoord
  const total = ppr

  return { ppr, total }
}
