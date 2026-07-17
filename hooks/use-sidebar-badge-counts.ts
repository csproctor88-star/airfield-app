'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { fetchPendingTriageCount, fetchPendingApprovalCount } from '@/lib/supabase/ppr'
import { fetchPendingCoordinationCountForUser } from '@/lib/supabase/ppr-agency-members'
import { fetchActiveQrcCount } from '@/lib/supabase/qrc'
import { fetchRevisedQrcCount } from '@/lib/supabase/qrc-reviews'
import { fetchPendingVerificationCount } from '@/lib/supabase/discrepancies'
import { fetchAmtrNotificationCount } from '@/lib/supabase/amtr'
import { fetchUnacknowledgedReadFileCount } from '@/lib/supabase/read-files'
import { fetchDueLocalRegCount } from '@/lib/supabase/local-regulations'

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
 *   qrc   — count of currently-open qrc_executions, gated on qrc:view.
 *   discrepancies — count of discrepancies in
 *           current_status = work_completed_awaiting_verification (CES
 *           marked the work done; AMOPS still needs to verify and close).
 *           Gated on discrepancies:close — only the AFM verification
 *           role sees the dot.
 *   localRegsDue — active local regulations (Base Regs) the current user
 *           has never reviewed / must re-review (version bump or interval
 *           elapsed). Gated on local_regs:view AND the local_regs module
 *           being enabled (see localRegsEnabled below). Drives the
 *           /regulations sidebar dot — the Read File dot's sibling.
 *   total — sum across all modules tracked here. Used to drive the
 *           Operations section-header dot.
 */
export function useSidebarBadgeCounts() {
  const { installationId, enabledModules } = useInstallation()
  const { has, loaded: permsLoaded } = usePermissions()
  const pathname = usePathname()

  // Local Regs rides the ALWAYS_ON /regulations nav entry, so the module
  // toggle must gate the badge here — the same double gate the Base Regs tab
  // applies to itself (regulations/page.tsx `showBaseRegs`). Every other count
  // in this hook rides a module-gated nav item whose dot disappears with the
  // item when its module is disabled; /regulations stays visible, so without
  // this gate disabling the module would leave a stuck, unclearable red dot.
  // Derived as a boolean so the refresh callback's dep stays stable even if
  // the enabledModules array identity churns across renders.
  const localRegsEnabled = enabledModules.includes('local_regs')

  const [pprTriage, setPprTriage] = useState(0)
  const [pprApproval, setPprApproval] = useState(0)
  const [pprCoord, setPprCoord] = useState(0)
  const [qrcActive, setQrcActive] = useState(0)
  const [qrcRevised, setQrcRevised] = useState(0)
  const [discrepanciesPendingVerification, setDiscrepanciesPendingVerification] = useState(0)
  const [amtrNotifications, setAmtrNotifications] = useState(0)
  const [readFileOutstanding, setReadFileOutstanding] = useState(0)
  const [localRegsDue, setLocalRegsDue] = useState(0)

  const refresh = useCallback(async () => {
    if (!installationId || !permsLoaded) return
    const supabase = createClient()
    if (!supabase) return
    // getSession() reads from local storage — no auth-server roundtrip.
    // RLS on the count queries below enforces actual authorization, so
    // we don't need a server-validated user object for badge counts.
    // Saves ~one auth call per refresh tick (which, with polling at
    // 60s + realtime + focus + nav listeners, adds up fast).
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
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
    if (has(PERM.QRC_VIEW)) {
      tasks.push(fetchActiveQrcCount(installationId).then(setQrcActive))
    } else {
      setQrcActive(0)
    }
    // Revised-since-review (mid-cycle QRC revisions) → amber dot. Gated on
    // qrc:execute (the reviewer permission), since only reviewers re-review.
    if (has(PERM.QRC_EXECUTE)) {
      tasks.push(fetchRevisedQrcCount(installationId).then(setQrcRevised))
    } else {
      setQrcRevised(0)
    }
    if (has(PERM.DISCREPANCIES_CLOSE)) {
      tasks.push(
        fetchPendingVerificationCount(installationId).then(setDiscrepanciesPendingVerification),
      )
    } else {
      setDiscrepanciesPendingVerification(0)
    }
    if (has(PERM.AMTR_VIEW)) {
      tasks.push(fetchAmtrNotificationCount().then(setAmtrNotifications))
    } else {
      setAmtrNotifications(0)
    }
    if (has(PERM.READ_FILE_VIEW)) {
      tasks.push(fetchUnacknowledgedReadFileCount(installationId).then(setReadFileOutstanding))
    } else {
      setReadFileOutstanding(0)
    }
    if (localRegsEnabled && has(PERM.LOCAL_REGS_VIEW)) {
      tasks.push(fetchDueLocalRegCount(installationId).then(setLocalRegsDue))
    } else {
      setLocalRegsDue(0)
    }
    await Promise.all(tasks)
  }, [installationId, has, permsLoaded, localRegsEnabled])

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
      .channel(`sidebar-badges-${installationId}`)
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qrc_executions', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qrc_templates', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qrc_monthly_reviews', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discrepancies', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'amtr_notifications' },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'read_files', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'read_file_acknowledgments', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'local_regulations', filter: `base_id=eq.${installationId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'local_regulation_reviews', filter: `base_id=eq.${installationId}` },
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
  // shouldn't have to refresh the page. 60s balances staleness against
  // Supabase request volume; pathname + custom-event + focus +
  // visibilitychange listeners cover sub-minute updates whenever the
  // user is actually interacting. Skip the tick when the tab is
  // hidden — visibilitychange fires the next refresh on return.
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        refresh()
      }
    }, 60_000)
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
  const qrc = qrcActive
  const discrepancies = discrepanciesPendingVerification
  const amtr = amtrNotifications
  const readFile = readFileOutstanding
  const qrcReviseCount = qrcRevised
  const localRegs = localRegsDue
  const total = ppr + qrc + discrepancies + amtr + readFile + qrcReviseCount + localRegs

  return { ppr, qrc, qrcRevised: qrcReviseCount, discrepancies, amtr, readFile, localRegsDue: localRegs, total }
}
