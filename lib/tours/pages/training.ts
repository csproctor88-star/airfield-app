import type { TourStep } from '@/components/tour/OnboardingTour'

export const TRAINING_PAGE_TOUR: TourStep[] = [
  {
    id: 'training-intro',
    anchor: 'training-header',
    title: 'Glidepath Training',
    body:
      'In-app reference for using Glidepath itself — module-by-module ' +
      'walkthroughs, FAQs, and screenshots. Distinct from airfield-' +
      'management training records (those live in the Air Force ' +
      'training systems your unit already uses).',
  },
]
