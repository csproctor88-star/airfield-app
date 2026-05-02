import type { TourStep } from '@/components/tour/OnboardingTour'

// Page-internal sub-tour for /discrepancies. Master sidebar tour patches
// step #1 with `navigateTo` and `skipSubTourTo` at composition time.
export const DISCREPANCIES_PAGE_TOUR: TourStep[] = [
  {
    id: 'discrepancies-intro',
    anchor: 'discrepancies-header',
    title: 'Discrepancies',
    body:
      'Submit problems, route them to the right CES shop, and verify ' +
      'the work when CES marks it complete. The green dot on the ' +
      'sidebar fires when something is waiting for your verification.',
  },
  {
    id: 'discrepancies-filters',
    anchor: 'discrepancies-filters',
    title: 'Filter and search',
    body:
      'Filter by status, type, shop, or use the search box. The ' +
      'default view shows open discrepancies for your installation; ' +
      'KPI tiles above quick-filter to >30-day or per-current-status.',
  },
  {
    id: 'discrepancies-list',
    anchor: 'discrepancies-list',
    title: 'The discrepancies list',
    body:
      'Each row is one discrepancy. Click to open. Status pills show ' +
      'CES progress: Submitted → Awaiting Action → Work Completed ' +
      '(Awaiting Verification) → Closed. The map view at the top ' +
      'plots them on the airfield.',
  },
  {
    id: 'discrepancies-new',
    anchor: 'discrepancies-primary-action',
    title: 'New discrepancy',
    body:
      'Click + New to file a discrepancy. Pick the type and the system ' +
      'auto-routes to the responsible CES shop based on the type-to-' +
      'shop mapping in your base setup.',
  },
]
