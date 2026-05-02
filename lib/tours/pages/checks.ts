import type { TourStep } from '@/components/tour/OnboardingTour'

export const CHECKS_PAGE_TOUR: TourStep[] = [
  {
    id: 'checks-intro',
    anchor: 'checks-header',
    title: 'Airfield Checks',
    body:
      'Daily, lighting, FOD, weather, and other checks. Pick a type, ' +
      'walk the inspection items, log discrepancies inline. Drafts ' +
      'auto-save to Supabase + localStorage so you can resume from ' +
      'another device or recover after a crash.',
  },
]
