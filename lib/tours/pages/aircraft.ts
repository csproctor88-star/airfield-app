import type { TourStep } from '@/components/tour/OnboardingTour'

export const AIRCRAFT_PAGE_TOUR: TourStep[] = [
  {
    id: 'aircraft-intro',
    anchor: 'aircraft-header',
    title: 'Aircraft Database',
    body:
      'Reference data on 200+ airframes. Silhouettes, dimensions, ' +
      'wingspan / length / height, ARFF CAT, and parking clearance ' +
      'requirements. Used by the parking module and the ARFF ' +
      'readiness panel.',
  },
]
