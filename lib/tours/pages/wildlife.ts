import type { TourStep } from '@/components/tour/OnboardingTour'

export const WILDLIFE_PAGE_TOUR: TourStep[] = [
  {
    id: 'wildlife-intro',
    anchor: 'wildlife-header',
    title: 'Wildlife / BASH',
    body:
      'Log sightings and strikes for the BASH program. The species ' +
      'picker is pre-curated to your base in Base Setup → Wildlife ' +
      'Species. The heatmap aggregates strike data for trend ' +
      'analysis and mitigation review.',
  },
]
