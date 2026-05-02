import type { TourStep } from '@/components/tour/OnboardingTour'

export const NOTAMS_PAGE_TOUR: TourStep[] = [
  {
    id: 'notams-intro',
    anchor: 'notams-header',
    title: 'NOTAMs',
    body:
      'Live FAA feed of NOTAMs for your ICAO. Filter by category, ' +
      'date, or text. The red dot on the sidebar fires when one or ' +
      'more NOTAMs are within their expiration window.',
  },
]
