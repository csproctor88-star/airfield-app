import type { TourStep } from '@/components/tour/OnboardingTour'

export const HELP_PAGE_TOUR: TourStep[] = [
  {
    id: 'help-intro',
    anchor: 'help-header',
    title: 'Help & Training',
    body:
      'In-app reference for using Glidepath itself — module-by-module ' +
      'walkthroughs, FAQs, and screenshots. Distinct from airfield-' +
      'management training records (those live in the AMTR module on ' +
      'USAF bases and the §139.303 Training module on civilian bases).',
  },
]
