import type { TourStep } from '@/components/tour/OnboardingTour'

export const PARKING_PAGE_TOUR: TourStep[] = [
  {
    id: 'parking-intro',
    anchor: 'parking-header',
    title: 'Aircraft Parking',
    body:
      'Plan transient and resident parking with wingtip and taxilane ' +
      'clearance envelopes per UFC 3-260-01. Drag spots, set aircraft ' +
      'type, and the system ray-tests against runways, taxiways, and ' +
      'adjacent spots in real time. Plans persist per base.',
  },
]
