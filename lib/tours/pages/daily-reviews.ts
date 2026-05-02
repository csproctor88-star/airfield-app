import type { TourStep } from '@/components/tour/OnboardingTour'

export const DAILY_REVIEWS_PAGE_TOUR: TourStep[] = [
  {
    id: 'daily-reviews-intro',
    anchor: 'daily-reviews-header',
    title: 'Daily Reviews',
    body:
      'DAFMAN 13-204v1 §2.5.2.10.3 / .10.4 shift turnover + daily ' +
      'review queue. Each shift signs off on the events from their ' +
      'shift; AFM signs off the day. Amendments are tagged when ' +
      'events change after the shift was certified.',
  },
]
