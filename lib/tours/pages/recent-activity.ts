import type { TourStep } from '@/components/tour/OnboardingTour'

export const RECENT_ACTIVITY_PAGE_TOUR: TourStep[] = [
  {
    id: 'recent-activity-intro',
    anchor: 'recent-activity-header',
    title: 'Recent Activity',
    body:
      'Per-user audit feed — what each member of your team has been ' +
      'doing across the app. Useful for shift handoff and oversight; ' +
      'mirrors the data captured in the Events Log but reorganised ' +
      'by actor instead of by chronology.',
  },
]
