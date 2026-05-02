import type { TourStep } from '@/components/tour/OnboardingTour'

export const INSPECTIONS_ALL_PAGE_TOUR: TourStep[] = [
  {
    id: 'inspections-intro',
    anchor: 'inspections-header',
    title: 'All Inspections',
    body:
      'Daily airfield inspections, lighting inspections, construction ' +
      'inspections, and joint-monthly inspections — all in one queue, ' +
      'each with its own checklist template configured in Base Setup.',
  },
  {
    id: 'inspections-list',
    anchor: 'inspections-list',
    title: 'Pick an inspection type',
    body:
      'Each tile starts a new inspection of that type or opens its ' +
      'history. Hard-locked to one airfield + one lighting per day per ' +
      'base; the system enforces this so you cannot accidentally ' +
      'double-book.',
  },
]
