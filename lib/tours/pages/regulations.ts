import type { TourStep } from '@/components/tour/OnboardingTour'

export const REGULATIONS_PAGE_TOUR: TourStep[] = [
  {
    id: 'regulations-intro',
    anchor: 'regulations-header',
    title: 'Reference Library',
    body:
      'Searchable PDF library of 70+ DAFMAN, UFC, AFMAN, and AF Form ' +
      'documents that govern airfield management. The IAW Compliance ' +
      'callouts elsewhere in the app point you back to specific ' +
      'paragraphs here.',
  },
]
