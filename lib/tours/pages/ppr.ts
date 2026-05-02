import type { TourStep } from '@/components/tour/OnboardingTour'

export const PPR_PAGE_TOUR: TourStep[] = [
  {
    id: 'ppr-intro',
    anchor: 'ppr-header',
    title: 'PPR Log',
    body:
      'Prior Permission Required entries for transient aircraft. The ' +
      'sidebar dot fires when entries are awaiting your triage, ' +
      'approval, or coordination. PDF + Email export the current ' +
      'filtered range.',
  },
  {
    id: 'ppr-public-form',
    anchor: 'ppr-header',
    title: 'Public request form',
    body:
      'Aircrews request via a QR-coded public form at /<your-icao>/' +
      'ppr-request — no login required. Submissions land directly in ' +
      'this log with status Awaiting Review. Print the QR from Base ' +
      'Setup → PPR Columns to post in your AMOPS office.',
  },
  {
    id: 'ppr-kpi',
    anchor: 'ppr-kpi-band',
    title: 'Pending queues',
    body:
      'Awaiting Review (your triage queue), Awaiting Approval (after ' +
      'coordination is back), and per-agency pills (when an agency ' +
      'still owes you a reply). Click any pill to filter to that ' +
      'queue; the row collapses entirely when nothing is pending.',
  },
  {
    id: 'ppr-new',
    anchor: 'ppr-primary-action',
    title: 'New PPR entry',
    body:
      'File a PPR on behalf of a requestor. The column set is ' +
      'configured per base in Base Setup → PPR Columns — add or ' +
      'reorder fields and they show up here and in the public form.',
  },
  {
    id: 'ppr-filters',
    anchor: 'ppr-filters',
    title: 'Search and filter',
    body:
      'Search by PPR #, callsign, aircraft, or notes. The Filters ' +
      'dropdown groups status, agency, and date-range narrowings; the ' +
      'date filter auto-disables when viewing pending queues so you ' +
      'never miss a stale request.',
  },
  {
    id: 'ppr-list',
    anchor: 'ppr-list',
    title: 'The PPR table',
    body:
      'One row per entry. Status pills track the lifecycle: Review → ' +
      'Coordination → Approval → Approved / Denied / Canceled. ' +
      'Soft-canceled rows strike through but stay visible for the ' +
      'audit trail.',
  },
  {
    id: 'ppr-detail',
    anchor: 'ppr-list',
    title: 'Detail editor + coordination',
    body:
      'Click any PPR # to open the detail editor: full coordination ' +
      'log with per-agency reply tracking, email-driven approve / ' +
      'deny with branded denial reason, and a single-page PPR PDF ' +
      'for the requestor.',
  },
]
