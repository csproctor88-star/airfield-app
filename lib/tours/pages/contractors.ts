import type { TourStep } from '@/components/tour/OnboardingTour'

export const CONTRACTORS_PAGE_TOUR: TourStep[] = [
  {
    id: 'contractors-intro',
    anchor: 'contractors-header',
    title: 'Personnel on Airfield',
    body:
      'AF Form 483 contractor escort logs. Track who is on the ' +
      'airfield, what facility they are visiting, who is escorting ' +
      'them, and credential expirations. Active personnel show on ' +
      'the Airfield Status page.',
  },
]
