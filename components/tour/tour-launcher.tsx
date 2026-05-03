'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/lib/permissions'
import { OnboardingTour } from '@/components/tour/OnboardingTour'
import { getTour, registerTour } from '@/lib/tours/registry'
import { markTourCompleted } from '@/lib/tours/state'
import { SETUP_WIZARD_TOUR_STEPS } from '@/lib/tours/setup-wizard-tour'

// The full app-walkthrough tours (app-sidebar / app-mobile-nav) were
// retired — see /training for the canonical learning surface. Only the
// focused base-setup wizard tour remains; it auto-fires for sys_admins
// on first visit to /base-config/setup.
registerTour({
  tourId: 'setup-wizard',
  label: 'Replay base setup tour',
  scope: 'wizard',
  steps: SETUP_WIZARD_TOUR_STEPS,
  visibleWhen: (path) => path.startsWith('/base-config/setup'),
})

type ActiveTour = { tourId: string }

/**
 * Listens for `glidepath:tour-launch` events and renders the matching
 * tour. The app-sidebar / app-mobile-nav tours are explicit-launch only
 * (no first-login auto-fire) so a brand-new base with no data doesn't
 * walk a user through empty pages. The wizard's own onboarding tour
 * still auto-fires from the wizard page itself for sys_admins on first
 * visit — that one is its own concern.
 *
 * Kiosk roles (airfield_status, atc) get a no-op so a launch event
 * fired in error doesn't activate a tour they can't see.
 */
export function TourLauncher() {
  const { has } = usePermissions()
  const [active, setActive] = useState<ActiveTour | null>(null)
  const [isKiosk, setIsKiosk] = useState<boolean | null>(null)

  // Detect kiosk role.
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setIsKiosk(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) {
          setIsKiosk(true)
          return
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (cancelled) return
        const role = (profile as { role?: string } | null)?.role
        setIsKiosk(role === 'airfield_status' || role === 'atc')
      } catch {
        setIsKiosk(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Single entry point for launching a tour. HelpMenu fires this; any
  // future per-page Help launchers can fire it too.
  useEffect(() => {
    function onLaunch(e: Event) {
      const detail = (e as CustomEvent).detail as { tourId?: string } | undefined
      if (!detail?.tourId) return
      if (isKiosk) return
      setActive({ tourId: detail.tourId })
    }
    window.addEventListener('glidepath:tour-launch', onLaunch)
    return () => window.removeEventListener('glidepath:tour-launch', onLaunch)
  }, [isKiosk])

  function dismiss(tourId: string, _reason: 'completed' | 'skipped') {
    // Mark complete on first dismiss so future "Have I seen this?"
    // checks (e.g. a "What's new in this tour" prompt down the line)
    // can read it. The user's flag is harmless if they re-launch the
    // tour later from the View App Tutorial button.
    void markTourCompleted(tourId)
    setActive(null)
  }

  if (!active || isKiosk) return null
  const reg = getTour(active.tourId)
  if (!reg) return null

  return (
    <OnboardingTour
      tourId={active.tourId}
      steps={reg.steps}
      active={true}
      onDismiss={dismiss}
      hasPermission={has}
      // Key on tourId only. Including pathname would remount the
      // component on every router.push the engine triggers and reset
      // stepIdx to 0.
      key={active.tourId}
    />
  )
}
