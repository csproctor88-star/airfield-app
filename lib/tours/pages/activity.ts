import type { TourStep } from '@/components/tour/OnboardingTour'

export const ACTIVITY_PAGE_TOUR: TourStep[] = [
  {
    id: 'activity-intro',
    anchor: 'activity-header',
    title: 'Events Log',
    body:
      'Rolling log of every airfield action — status changes, NOTAMs, ' +
      'inspections, sign-offs, manual entries. Filter by date, type, ' +
      'or actor. This is the AF Form 3616 substitute (T-3 waiver on ' +
      'file).',
  },
]
