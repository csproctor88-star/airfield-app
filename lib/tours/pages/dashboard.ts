import type { TourStep } from '@/components/tour/OnboardingTour'

export const DASHBOARD_PAGE_TOUR: TourStep[] = [
  {
    id: 'dashboard-intro',
    anchor: 'dashboard-header',
    title: 'Dashboard',
    body:
      'KPI hub: open discrepancies, inspection cadence, daily review ' +
      'pending count, AFM Out of Office toggle, and last-airfield-' +
      'check status. Quick read for shift handoff and oversight.',
  },
]
