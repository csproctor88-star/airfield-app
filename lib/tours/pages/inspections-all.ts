import type { TourStep } from '@/components/tour/OnboardingTour'

export const INSPECTIONS_ALL_PAGE_TOUR: TourStep[] = [
  {
    id: 'inspections-intro',
    anchor: 'inspections-header',
    title: 'All Inspections',
    body:
      'Launchpad for every inspection cadence at your base — Daily ' +
      'Airfield, ACSI (annual compliance), Pre/Post Construction, and ' +
      'Monthly Joint. Each tile starts a new inspection of that type ' +
      'or opens its history.',
  },
  {
    id: 'inspections-types',
    anchor: 'inspections-list',
    title: 'Four inspection types',
    body:
      'Daily Airfield (DAFMAN 13-204v2) covers the every-shift airfield ' +
      'and lighting checks. ACSI (Para 5.4.3) is the annual compliance ' +
      'review. Pre/Post Construction wraps construction-zone safety. ' +
      'Monthly Joint coordinates with CE and Safety. Each type runs on ' +
      'its own template configured in Base Setup.',
  },
  {
    id: 'inspections-one-per-day',
    anchor: 'inspections-list',
    title: 'One per day, hard-locked',
    body:
      'Daily Airfield is hard-locked to one airfield + one lighting ' +
      'inspection per day, per base, with a 0600L reset (using your ' +
      'installation timezone). The system enforces this so you cannot ' +
      'accidentally double-book. Cross-user draft isolation skips other ' +
      'inspectors\' drafts when you sync.',
  },
  {
    id: 'inspections-drafts',
    anchor: 'inspections-list',
    title: 'Drafts auto-save and resume',
    body:
      'Inspections auto-save to localStorage as you fill them out, with ' +
      'cross-device load from Supabase when you re-open. ACSI drafts ' +
      'show up as "Continue ACSI Draft" right on the launcher tile. ' +
      'started_at timestamps in are stamped at insert so the audit ' +
      'trail captures when you began, not when you saved.',
  },
  {
    id: 'inspections-discrepancies',
    anchor: 'inspections-list',
    title: 'Discrepancies + photos',
    body:
      'Issues you log during an inspection roll into the Discrepancies ' +
      'module — same workflow, same CES routing. Photos attach per-' +
      'issue (or per-discrepancy directly) via path-scoped storage RLS, ' +
      'so the inspector that wrote the issue is the only one who can ' +
      'edit its evidence.',
  },
  {
    id: 'inspections-history',
    anchor: 'inspections-list',
    title: 'History on every tile',
    body:
      'Every type\'s tile has a History button that opens its full ' +
      'log — filterable by date, inspector, status. Each historical ' +
      'inspection links to its source records (issues opened, photos ' +
      'captured, sign-offs) so the audit trail stays complete.',
  },
]
