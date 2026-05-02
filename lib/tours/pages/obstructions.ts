import type { TourStep } from '@/components/tour/OnboardingTour'

export const OBSTRUCTIONS_PAGE_TOUR: TourStep[] = [
  {
    id: 'obstructions-intro',
    anchor: 'obstructions-header',
    title: 'Obstruction Eval Tool',
    body:
      'UFC 3-260-01 imaginary-surface analysis. Log a candidate ' +
      'obstruction, plot it on the airfield, and the engine computes ' +
      'whether it penetrates the primary, approach, transitional, ' +
      'or inner-horizontal surfaces.',
  },
]
