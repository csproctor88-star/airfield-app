import type { TourStep } from '@/components/tour/OnboardingTour'

export const PPR_PAGE_TOUR: TourStep[] = [
  {
    id: 'ppr-intro',
    anchor: 'ppr-header',
    title: 'PPR Log',
    body:
      'Prior Permission Required entries for transient aircraft. The ' +
      'sidebar dot fires when entries are awaiting your triage, ' +
      'approval, or coordination.',
  },
  {
    id: 'ppr-new',
    anchor: 'ppr-primary-action',
    title: 'New PPR entry',
    body:
      'Click + New to file an entry on behalf of a requestor — for ' +
      'public submissions, the QR-coded form posts directly into ' +
      'this log. Configure the column set in Base Setup → PPR Columns.',
  },
  {
    id: 'ppr-filters',
    anchor: 'ppr-filters',
    title: 'Search and filter',
    body:
      'Search by PPR #, callsign, aircraft, or notes. The Filters ' +
      'dropdown groups status, surface, and date-range narrowings; ' +
      'an active-filter chip strip below shows what is applied.',
  },
  {
    id: 'ppr-list',
    anchor: 'ppr-list',
    title: 'The PPR table',
    body:
      'One row per entry. Status pills show triage / approval / ' +
      'coordination state. Click any row to open the detail editor ' +
      'with full coordination log + agency reply tracking.',
  },
]
