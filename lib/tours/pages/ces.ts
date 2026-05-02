import type { TourStep } from '@/components/tour/OnboardingTour'

export const CES_PAGE_TOUR: TourStep[] = [
  {
    id: 'ces-intro',
    anchor: 'ces-header',
    title: 'CES Work Orders',
    body:
      'CES-shop-filtered queue of discrepancies routed to your shop. ' +
      'Update status (In Work / Project / Work Completed Awaiting ' +
      'Verification), drop resolution notes, and AMOPS verifies ' +
      'before final close.',
  },
]
