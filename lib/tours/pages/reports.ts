import type { TourStep } from '@/components/tour/OnboardingTour'

export const REPORTS_PAGE_TOUR: TourStep[] = [
  {
    id: 'reports-intro',
    anchor: 'reports-header',
    title: 'Reports & Analytics',
    body:
      'Five canned report categories — Daily ops rollup, Trends, ' +
      'Aging discrepancies, Discrepancy detail, Lighting outage. ' +
      'PDFs and Excel exports are generated client-side; nothing ' +
      'leaves your installation.',
  },
]
