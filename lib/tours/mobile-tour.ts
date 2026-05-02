import type { TourStep } from '@/components/tour/OnboardingTour'

import { HOME_PAGE_TOUR } from './pages/home'
import { DASHBOARD_PAGE_TOUR } from './pages/dashboard'
import { ACTIVITY_PAGE_TOUR } from './pages/activity'
import { QRC_PAGE_TOUR } from './pages/qrc'
import { SHIFT_CHECKLIST_PAGE_TOUR } from './pages/shift-checklist'
import { CHECKS_PAGE_TOUR } from './pages/checks'
import { INSPECTIONS_ALL_PAGE_TOUR } from './pages/inspections-all'
import { WILDLIFE_PAGE_TOUR } from './pages/wildlife'
import { PPR_PAGE_TOUR } from './pages/ppr'
import { CONTRACTORS_PAGE_TOUR } from './pages/contractors'
import { DISCREPANCIES_PAGE_TOUR } from './pages/discrepancies'
import { CES_PAGE_TOUR } from './pages/ces'
import { OBSTRUCTIONS_PAGE_TOUR } from './pages/obstructions'
import { INFRASTRUCTURE_PAGE_TOUR } from './pages/infrastructure'
import { PARKING_PAGE_TOUR } from './pages/parking'
import { AIRCRAFT_PAGE_TOUR } from './pages/aircraft'
import { REGULATIONS_PAGE_TOUR } from './pages/regulations'
import { NOTAMS_PAGE_TOUR } from './pages/notams'
import { TRAINING_PAGE_TOUR } from './pages/training'
import { BASE_CONFIG_PAGE_TOUR } from './pages/base-config'
import { RECENT_ACTIVITY_PAGE_TOUR } from './pages/recent-activity'
import { DAILY_REVIEWS_PAGE_TOUR } from './pages/daily-reviews'
import { WAIVERS_PAGE_TOUR } from './pages/waivers'
import { REPORTS_PAGE_TOUR } from './pages/reports'
import { LIBRARY_PAGE_TOUR } from './pages/library'
import { USERS_PAGE_TOUR } from './pages/users'
import { FEEDBACK_PAGE_TOUR } from './pages/feedback'
import { SETTINGS_PAGE_TOUR } from './pages/settings'

// Mobile tour: anchored to /more page items + the bottom-nav More button.
// Each /more item launches into the SAME page sub-tour the desktop sidebar
// tour uses — that's the whole point of pulling page sub-tours out into
// shared lib/tours/pages/*.ts files. The /more page handles its own
// CollapsibleGroup expand state via the glidepath:more-expand-group event.

function withPageWalk(
  moreItem: TourStep,
  pageTour: TourStep[],
  navigateTo: string,
  nextItemId: string,
): TourStep[] {
  if (pageTour.length === 0) return [moreItem]
  const [intro, ...rest] = pageTour
  return [
    moreItem,
    { ...intro, navigateTo, skipSubTourTo: nextItemId },
    ...rest,
  ]
}

const MOBILE_PINNED: TourStep[] = [
  ...withPageWalk(
    { id: 'mobile-home', anchor: 'more-item-home',
      title: 'Airfield Status', body: 'Your default landing page on every shift.' },
    HOME_PAGE_TOUR, '/', 'mobile-dashboard',
  ),
  ...withPageWalk(
    { id: 'mobile-dashboard', anchor: 'more-item-dashboard',
      title: 'Dashboard', body: 'KPI hub for shift handoff.' },
    DASHBOARD_PAGE_TOUR, '/dashboard', 'mobile-section-operations-intro',
  ),
]

const MOBILE_OPERATIONS: TourStep[] = [
  { id: 'mobile-section-operations-intro', anchor: 'more-section-operations',
    expandSidebarGroup: 'Operations',
    title: 'Operations', body: 'Daily ops work — recurring shift tasks.' },
  ...withPageWalk(
    { id: 'mobile-activity', anchor: 'more-item-activity', expandSidebarGroup: 'Operations',
      title: 'Events Log', body: 'Rolling log of every airfield action.' },
    ACTIVITY_PAGE_TOUR, '/activity', 'mobile-qrc',
  ),
  ...withPageWalk(
    { id: 'mobile-qrc', anchor: 'more-item-qrc', expandSidebarGroup: 'Operations',
      title: 'QRC', body: 'Emergency-response checklists.' },
    QRC_PAGE_TOUR, '/qrc', 'mobile-shift-checklist',
  ),
  ...withPageWalk(
    { id: 'mobile-shift-checklist', anchor: 'more-item-shift-checklist', expandSidebarGroup: 'Operations',
      title: 'Shift Checklist', body: 'Per-shift task list with 0600L reset.' },
    SHIFT_CHECKLIST_PAGE_TOUR, '/shift-checklist', 'mobile-checks',
  ),
  ...withPageWalk(
    { id: 'mobile-checks', anchor: 'more-item-checks', expandSidebarGroup: 'Operations',
      title: 'Airfield Checks', body: 'Daily, lighting, FOD, weather checks.' },
    CHECKS_PAGE_TOUR, '/checks', 'mobile-inspections-all',
  ),
  ...withPageWalk(
    { id: 'mobile-inspections-all', anchor: 'more-item-inspections-all', expandSidebarGroup: 'Operations',
      title: 'Inspections', body: 'Airfield, lighting, construction, joint-monthly.' },
    INSPECTIONS_ALL_PAGE_TOUR, '/inspections/all', 'mobile-wildlife',
  ),
  ...withPageWalk(
    { id: 'mobile-wildlife', anchor: 'more-item-wildlife', expandSidebarGroup: 'Operations',
      title: 'Wildlife / BASH', body: 'Sightings, strikes, BASH heatmap.' },
    WILDLIFE_PAGE_TOUR, '/wildlife', 'mobile-ppr',
  ),
  ...withPageWalk(
    { id: 'mobile-ppr', anchor: 'more-item-ppr', expandSidebarGroup: 'Operations',
      title: 'PPR Log', body: 'Prior Permission Required for transient aircraft.' },
    PPR_PAGE_TOUR, '/ppr', 'mobile-contractors',
  ),
  ...withPageWalk(
    { id: 'mobile-contractors', anchor: 'more-item-contractors', expandSidebarGroup: 'Operations',
      title: 'Personnel on Airfield', body: 'AF Form 483 contractor escort logs.' },
    CONTRACTORS_PAGE_TOUR, '/contractors', 'mobile-section-airfield-intro',
  ),
]

const MOBILE_AIRFIELD: TourStep[] = [
  { id: 'mobile-section-airfield-intro', anchor: 'more-section-airfield-management',
    expandSidebarGroup: 'Airfield Management',
    title: 'Airfield Management', body: 'The airfield\'s persistent-record modules.' },
  ...withPageWalk(
    { id: 'mobile-discrepancies', anchor: 'more-item-discrepancies', expandSidebarGroup: 'Airfield Management',
      title: 'Discrepancies', body: 'Submit, route, verify. Green dot = waiting on you.' },
    DISCREPANCIES_PAGE_TOUR, '/discrepancies', 'mobile-ces',
  ),
  ...withPageWalk(
    { id: 'mobile-ces', anchor: 'more-item-ces', expandSidebarGroup: 'Airfield Management',
      title: 'CES Work Orders', body: 'CES-shop-filtered queue.' },
    CES_PAGE_TOUR, '/ces', 'mobile-obstructions',
  ),
  ...withPageWalk(
    { id: 'mobile-obstructions', anchor: 'more-item-obstructions', expandSidebarGroup: 'Airfield Management',
      title: 'Obstruction Eval', body: 'UFC 3-260-01 imaginary-surface analysis.' },
    OBSTRUCTIONS_PAGE_TOUR, '/obstructions', 'mobile-infrastructure',
  ),
  ...withPageWalk(
    { id: 'mobile-infrastructure', anchor: 'more-item-infrastructure', expandSidebarGroup: 'Airfield Management',
      title: 'Visual NAVAIDs', body: 'Map every NAVAID component.' },
    INFRASTRUCTURE_PAGE_TOUR, '/infrastructure', 'mobile-parking',
  ),
  ...withPageWalk(
    { id: 'mobile-parking', anchor: 'more-item-parking', expandSidebarGroup: 'Airfield Management',
      title: 'Aircraft Parking', body: 'Wingtip / taxilane clearance envelopes.' },
    PARKING_PAGE_TOUR, '/parking', 'mobile-section-reference-intro',
  ),
]

const MOBILE_REFERENCE: TourStep[] = [
  { id: 'mobile-section-reference-intro', anchor: 'more-section-reference',
    expandSidebarGroup: 'Reference',
    title: 'Reference', body: 'Read-mostly reference data.' },
  ...withPageWalk(
    { id: 'mobile-aircraft', anchor: 'more-item-aircraft', expandSidebarGroup: 'Reference',
      title: 'Aircraft Database', body: '200+ airframes.' },
    AIRCRAFT_PAGE_TOUR, '/aircraft', 'mobile-regulations',
  ),
  ...withPageWalk(
    { id: 'mobile-regulations', anchor: 'more-item-regulations', expandSidebarGroup: 'Reference',
      title: 'Reference Library', body: '70+ DAFMAN/UFC/AFMAN documents.' },
    REGULATIONS_PAGE_TOUR, '/regulations', 'mobile-notams',
  ),
  ...withPageWalk(
    { id: 'mobile-notams', anchor: 'more-item-notams', expandSidebarGroup: 'Reference',
      title: 'NOTAMs', body: 'Live FAA feed.' },
    NOTAMS_PAGE_TOUR, '/notams', 'mobile-training',
  ),
  ...withPageWalk(
    { id: 'mobile-training', anchor: 'more-item-training', expandSidebarGroup: 'Reference',
      title: 'Glidepath Training', body: 'In-app reference for using Glidepath.' },
    TRAINING_PAGE_TOUR, '/training', 'mobile-section-admin-intro',
  ),
]

const MOBILE_ADMIN: TourStep[] = [
  { id: 'mobile-section-admin-intro', anchor: 'more-section-admin',
    expandSidebarGroup: 'Admin',
    requiresPerm: 'base_setup:write',
    title: 'Admin', body: 'Admin-tier modules. Most are role-gated.' },
  ...withPageWalk(
    { id: 'mobile-base-config', anchor: 'more-item-base-config', expandSidebarGroup: 'Admin',
      requiresPerm: 'base_setup:write',
      title: 'Base Configuration', body: 'Installation-level admin work.' },
    BASE_CONFIG_PAGE_TOUR, '/base-config', 'mobile-recent-activity',
  ),
  ...withPageWalk(
    { id: 'mobile-recent-activity', anchor: 'more-item-recent-activity', expandSidebarGroup: 'Admin',
      requiresPerm: 'recent_activity:view',
      title: 'Recent Activity', body: 'Per-user audit feed.' },
    RECENT_ACTIVITY_PAGE_TOUR, '/recent-activity', 'mobile-daily-reviews',
  ),
  ...withPageWalk(
    { id: 'mobile-daily-reviews', anchor: 'more-item-daily-reviews', expandSidebarGroup: 'Admin',
      requiresPerm: 'daily_reviews:view',
      title: 'Daily Reviews', body: 'Shift sign-off queue.' },
    DAILY_REVIEWS_PAGE_TOUR, '/daily-reviews', 'mobile-waivers',
  ),
  ...withPageWalk(
    { id: 'mobile-waivers', anchor: 'more-item-waivers', expandSidebarGroup: 'Admin',
      requiresPerm: 'waivers:view',
      title: 'Waivers', body: 'AF Form 505 lifecycle.' },
    WAIVERS_PAGE_TOUR, '/waivers', 'mobile-reports',
  ),
  ...withPageWalk(
    { id: 'mobile-reports', anchor: 'more-item-reports', expandSidebarGroup: 'Admin',
      requiresPerm: 'reports:view',
      title: 'Reports & Analytics', body: 'Five canned report categories.' },
    REPORTS_PAGE_TOUR, '/reports', 'mobile-library',
  ),
  ...withPageWalk(
    { id: 'mobile-library', anchor: 'more-item-library', expandSidebarGroup: 'Admin',
      requiresPerm: 'library:view',
      title: 'PDF Library', body: 'Historical PDF archive (sys_admin only).' },
    LIBRARY_PAGE_TOUR, '/library', 'mobile-users',
  ),
  ...withPageWalk(
    { id: 'mobile-users', anchor: 'more-item-users', expandSidebarGroup: 'Admin',
      requiresPerm: 'users:view',
      title: 'User Management', body: 'Invite, edit, assign roles.' },
    USERS_PAGE_TOUR, '/users', 'mobile-feedback',
  ),
  ...withPageWalk(
    { id: 'mobile-feedback', anchor: 'more-item-feedback', expandSidebarGroup: 'Admin',
      requiresPerm: 'feedback:view',
      title: 'Customer Feedback', body: 'QR-code feedback inbox.' },
    FEEDBACK_PAGE_TOUR, '/feedback', 'mobile-settings',
  ),
]

const MOBILE_FOOTER: TourStep[] = [
  ...withPageWalk(
    { id: 'mobile-settings', anchor: 'more-item-settings',
      title: 'Settings', body: 'Profile, theme, notifications.' },
    SETTINGS_PAGE_TOUR, '/settings', 'mobile-help',
  ),
  { id: 'mobile-help', anchor: 'more-help',
    title: 'Replay anytime',
    body: 'Replay this tour from this row whenever you need a refresher. That\'s it.' },
]

export const MOBILE_TOUR_STEPS: TourStep[] = [
  { id: 'mobile-welcome',
    title: 'Welcome to Glidepath',
    body:
      'Quick walkthrough on mobile. We\'ll visit every section of the More menu and ' +
      'every page underneath. Skip any page\'s deep-dive with "Skip this page", or ' +
      'cancel altogether with Skip tour. Hit Next to start.' },
  { id: 'mobile-bottom-nav', anchor: 'bottom-nav-more', anchorIsFixed: true,
    navigateTo: '/more',
    title: 'The More button',
    body: 'Tap More from any page to see every module not in the bottom row.' },
  { id: 'mobile-more-pinned', anchor: 'more-pinned', navigateTo: '/more',
    title: 'Top of the More menu',
    body: 'Airfield Status and Dashboard are your two daily landing pages.' },
  ...MOBILE_PINNED,
  ...MOBILE_OPERATIONS,
  ...MOBILE_AIRFIELD,
  ...MOBILE_REFERENCE,
  ...MOBILE_ADMIN,
  ...MOBILE_FOOTER,
]
