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
      'sidebar fires when something is waiting for your verification. ' +
      'Excel / PDF / Email up here export the current filtered view.',
  },
  {
    id: 'discrepancies-kpi',
    anchor: 'discrepancies-kpi-band',
    title: 'Quick-filter tiles',
    body:
      'Open and > 30 Days are the headline counts — > 30 Days flashes ' +
      'red when anything is overdue. The smaller AFM / CES / AMOPS ' +
      'tiles narrow to who currently owns the open work. Click any ' +
      'tile to filter; click again to clear.',
  },
  {
    id: 'discrepancies-filters',
    anchor: 'discrepancies-filters',
    title: 'Search and filter',
    body:
      'Search title, description, or work order. The Filters button ' +
      'tucks status / shop / type chips into one panel; an active-' +
      'filter chip strip below shows what is applied with one-click ' +
      'dismissal.',
  },
  {
    id: 'discrepancies-view',
    anchor: 'discrepancies-view-toggle',
    title: 'Map or list view',
    body:
      'Toggle to map view to plot every filtered discrepancy on the ' +
      'airfield diagram — useful for spotting clusters around a ' +
      'specific runway, taxiway, or apron. The list always renders ' +
      'below the map for quick reference.',
  },
  {
    id: 'discrepancies-list',
    anchor: 'discrepancies-list',
    title: 'The discrepancies list',
    body:
      'Each row is one discrepancy. The colored left rail mirrors the ' +
      'current owner; the pill on the right is the lifecycle status. ' +
      'Days-open, photo count, and work order # live inline. Click any ' +
      'row to open the full record with notes history.',
  },
  {
    id: 'discrepancies-workflow',
    anchor: 'discrepancies-list',
    title: 'CES workflow',
    body:
      'Status progresses Submitted → Awaiting Action by CES → ' +
      'Waiting for Project / In Work → Work Completed (Awaiting ' +
      'Verification) → Closed. The green sidebar dot fires on that ' +
      'second-to-last state — that is your cue to verify and close.',
  },
  {
    id: 'discrepancies-new',
    anchor: 'discrepancies-primary-action',
    title: 'New discrepancy',
    body:
      'Click + New to file a discrepancy. Pick the type and the system ' +
      'auto-routes to the responsible CES shop based on the type-to-' +
      'shop mapping in your base setup — no manual triage required.',
  },
]
