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

// Helper: takes a sidebar item step + a page sub-tour and stitches them
// into a contiguous sequence. The sidebar item step is unchanged. The
// FIRST step of the page sub-tour gets `navigateTo` + `skipSubTourTo`
// patched in (so the engine navigates the user to the page when they
// hit Next on the sidebar item, and the "Skip this page's deep-dive"
// button jumps to `nextSidebarItemId`).
function withPageWalk(
  sidebarItem: TourStep,
  pageTour: TourStep[],
  navigateTo: string,
  nextSidebarItemId: string,
): TourStep[] {
  if (pageTour.length === 0) return [sidebarItem]
  const [intro, ...rest] = pageTour
  return [
    sidebarItem,
    { ...intro, navigateTo, skipSubTourTo: nextSidebarItemId },
    ...rest,
  ]
}

// Sidebar items get short bubbles describing what kind of work lives on
// the page. The page sub-tours go deeper. Permission-gated items use
// `requiresPerm` so non-admin roles see a tighter tour.

const PINNED: TourStep[] = [
  ...withPageWalk(
    { id: 'sidebar-home', anchor: 'sidebar-item-home', anchorIsFixed: true,
      title: 'Airfield Status',
      body: 'Real-time runway, NAVAID, ARFF, and custom-board status. The default landing page on every shift.' },
    HOME_PAGE_TOUR, '/', 'sidebar-dashboard',
  ),
  ...withPageWalk(
    { id: 'sidebar-dashboard', anchor: 'sidebar-item-dashboard', anchorIsFixed: true,
      title: 'Dashboard',
      body: 'KPI hub for shift handoff — open discrepancies, inspection cadence, daily-review pending.' },
    DASHBOARD_PAGE_TOUR, '/dashboard', 'section-operations-intro',
  ),
]

const OPERATIONS: TourStep[] = [
  { id: 'section-operations-intro', anchor: 'sidebar-section-operations', anchorIsFixed: true,
    expandSidebarGroup: 'Operations',
    title: 'Operations',
    body: 'Daily ops — these are the recurring tasks across every shift.' },
  ...withPageWalk(
    { id: 'sidebar-activity', anchor: 'sidebar-item-activity', anchorIsFixed: true,
      expandSidebarGroup: 'Operations',
      title: 'Events Log',
      body: 'Rolling log of every airfield action. AF Form 3616 substitute under T-3 waiver.' },
    ACTIVITY_PAGE_TOUR, '/activity', 'sidebar-qrc',
  ),
  ...withPageWalk(
    { id: 'sidebar-qrc', anchor: 'sidebar-item-qrc', anchorIsFixed: true,
      expandSidebarGroup: 'Operations',
      title: 'QRC',
      body: 'Quick Reaction Checklists for emergency response. Red dot = active QRCs.' },
    QRC_PAGE_TOUR, '/qrc', 'sidebar-shift-checklist',
  ),
  ...withPageWalk(
    { id: 'sidebar-shift-checklist', anchor: 'sidebar-item-shift-checklist', anchorIsFixed: true,
      expandSidebarGroup: 'Operations',
      title: 'Shift Checklist',
      body: 'Per-shift task list. Three-state toggle, 0600L reset.' },
    SHIFT_CHECKLIST_PAGE_TOUR, '/shift-checklist', 'sidebar-checks',
  ),
  ...withPageWalk(
    { id: 'sidebar-checks', anchor: 'sidebar-item-checks', anchorIsFixed: true,
      expandSidebarGroup: 'Operations',
      title: 'Airfield Checks',
      body: 'Daily, lighting, FOD, weather, construction, and other checks.' },
    CHECKS_PAGE_TOUR, '/checks', 'sidebar-inspections-all',
  ),
  ...withPageWalk(
    { id: 'sidebar-inspections-all', anchor: 'sidebar-item-inspections-all', anchorIsFixed: true,
      expandSidebarGroup: 'Operations',
      title: 'Inspections',
      body: 'Airfield, lighting, construction, and joint-monthly inspections.' },
    INSPECTIONS_ALL_PAGE_TOUR, '/inspections/all', 'sidebar-wildlife',
  ),
  ...withPageWalk(
    { id: 'sidebar-wildlife', anchor: 'sidebar-item-wildlife', anchorIsFixed: true,
      expandSidebarGroup: 'Operations',
      title: 'Wildlife / BASH',
      body: 'Sightings, strikes, BASH heatmap, 270+ species library.' },
    WILDLIFE_PAGE_TOUR, '/wildlife', 'sidebar-ppr',
  ),
  ...withPageWalk(
    { id: 'sidebar-ppr', anchor: 'sidebar-item-ppr', anchorIsFixed: true,
      expandSidebarGroup: 'Operations',
      title: 'PPR Log',
      body: 'Prior Permission Required. Red dot = entries waiting on you.' },
    PPR_PAGE_TOUR, '/ppr', 'sidebar-contractors',
  ),
  ...withPageWalk(
    { id: 'sidebar-contractors', anchor: 'sidebar-item-contractors', anchorIsFixed: true,
      expandSidebarGroup: 'Operations',
      title: 'Personnel on Airfield',
      body: 'AF Form 483 contractor escort logs.' },
    CONTRACTORS_PAGE_TOUR, '/contractors', 'section-airfield-intro',
  ),
]

const AIRFIELD: TourStep[] = [
  { id: 'section-airfield-intro', anchor: 'sidebar-section-airfield-management', anchorIsFixed: true,
    expandSidebarGroup: 'Airfield Management',
    title: 'Airfield Management',
    body: 'The airfield\'s persistent-record modules — discrepancies, NAVAIDs, parking, obstructions.' },
  ...withPageWalk(
    { id: 'sidebar-discrepancies', anchor: 'sidebar-item-discrepancies', anchorIsFixed: true,
      expandSidebarGroup: 'Airfield Management',
      title: 'Discrepancies',
      body: 'Submit, route, verify. Green dot = work done, awaiting your verification.' },
    DISCREPANCIES_PAGE_TOUR, '/discrepancies', 'sidebar-ces',
  ),
  ...withPageWalk(
    { id: 'sidebar-ces', anchor: 'sidebar-item-ces', anchorIsFixed: true,
      expandSidebarGroup: 'Airfield Management',
      title: 'CES Work Orders',
      body: 'CES-shop-filtered queue. CES updates here; AMOPS verifies on close.' },
    CES_PAGE_TOUR, '/ces', 'sidebar-obstructions',
  ),
  ...withPageWalk(
    { id: 'sidebar-obstructions', anchor: 'sidebar-item-obstructions', anchorIsFixed: true,
      expandSidebarGroup: 'Airfield Management',
      title: 'Obstruction Eval',
      body: 'UFC 3-260-01 imaginary-surface analysis.' },
    OBSTRUCTIONS_PAGE_TOUR, '/obstructions', 'sidebar-infrastructure',
  ),
  ...withPageWalk(
    { id: 'sidebar-infrastructure', anchor: 'sidebar-item-infrastructure', anchorIsFixed: true,
      expandSidebarGroup: 'Airfield Management',
      title: 'Visual NAVAIDs',
      body: 'Map every NAVAID component. Outage Engine + bar-out detection per DAFMAN A3.1.' },
    INFRASTRUCTURE_PAGE_TOUR, '/infrastructure', 'sidebar-parking',
  ),
  ...withPageWalk(
    { id: 'sidebar-parking', anchor: 'sidebar-item-parking', anchorIsFixed: true,
      expandSidebarGroup: 'Airfield Management',
      title: 'Aircraft Parking',
      body: 'Wingtip / taxilane clearance envelopes per UFC 3-260-01.' },
    PARKING_PAGE_TOUR, '/parking', 'section-reference-intro',
  ),
]

const REFERENCE: TourStep[] = [
  { id: 'section-reference-intro', anchor: 'sidebar-section-reference', anchorIsFixed: true,
    expandSidebarGroup: 'Reference',
    title: 'Reference',
    body: 'Read-mostly reference data — aircraft library, regulations, NOTAMs, training.' },
  ...withPageWalk(
    { id: 'sidebar-aircraft', anchor: 'sidebar-item-aircraft', anchorIsFixed: true,
      expandSidebarGroup: 'Reference',
      title: 'Aircraft Database',
      body: '200+ airframes with silhouettes, dimensions, and ARFF CAT.' },
    AIRCRAFT_PAGE_TOUR, '/aircraft', 'sidebar-regulations',
  ),
  ...withPageWalk(
    { id: 'sidebar-regulations', anchor: 'sidebar-item-regulations', anchorIsFixed: true,
      expandSidebarGroup: 'Reference',
      title: 'Reference Library',
      body: '70+ DAFMAN, UFC, AFMAN, and AF Form documents.' },
    REGULATIONS_PAGE_TOUR, '/regulations', 'sidebar-notams',
  ),
  ...withPageWalk(
    { id: 'sidebar-notams', anchor: 'sidebar-item-notams', anchorIsFixed: true,
      expandSidebarGroup: 'Reference',
      title: 'NOTAMs',
      body: 'Live FAA feed for your ICAO. Red dot = expiring soon.' },
    NOTAMS_PAGE_TOUR, '/notams', 'sidebar-training',
  ),
  ...withPageWalk(
    { id: 'sidebar-training', anchor: 'sidebar-item-training', anchorIsFixed: true,
      expandSidebarGroup: 'Reference',
      title: 'Glidepath Training',
      body: 'In-app reference for using Glidepath itself.' },
    TRAINING_PAGE_TOUR, '/training', 'section-admin-intro',
  ),
]

const ADMIN: TourStep[] = [
  { id: 'section-admin-intro', anchor: 'sidebar-section-admin', anchorIsFixed: true,
    expandSidebarGroup: 'Admin',
    requiresPerm: 'base_setup:write',
    title: 'Admin',
    body: 'Admin-tier modules. Most of these are role-gated, so you may not see every step that follows.' },
  ...withPageWalk(
    { id: 'sidebar-base-config', anchor: 'sidebar-item-base-config', anchorIsFixed: true,
      expandSidebarGroup: 'Admin',
      requiresPerm: 'base_setup:write',
      title: 'Base Configuration',
      body: 'Hub for installation-level admin work + the first-time setup wizard.' },
    BASE_CONFIG_PAGE_TOUR, '/base-config', 'sidebar-recent-activity',
  ),
  ...withPageWalk(
    { id: 'sidebar-recent-activity', anchor: 'sidebar-item-recent-activity', anchorIsFixed: true,
      expandSidebarGroup: 'Admin',
      requiresPerm: 'recent_activity:view',
      title: 'Recent Activity',
      body: 'Per-user audit feed.' },
    RECENT_ACTIVITY_PAGE_TOUR, '/recent-activity', 'sidebar-daily-reviews',
  ),
  ...withPageWalk(
    { id: 'sidebar-daily-reviews', anchor: 'sidebar-item-daily-reviews', anchorIsFixed: true,
      expandSidebarGroup: 'Admin',
      requiresPerm: 'daily_reviews:view',
      title: 'Daily Reviews',
      body: 'Shift sign-off queue per DAFMAN 13-204v1 §2.5.2.10.3 / .10.4.' },
    DAILY_REVIEWS_PAGE_TOUR, '/daily-reviews', 'sidebar-waivers',
  ),
  ...withPageWalk(
    { id: 'sidebar-waivers', anchor: 'sidebar-item-waivers', anchorIsFixed: true,
      expandSidebarGroup: 'Admin',
      requiresPerm: 'waivers:view',
      title: 'Waivers',
      body: 'AF Form 505 lifecycle.' },
    WAIVERS_PAGE_TOUR, '/waivers', 'sidebar-reports',
  ),
  ...withPageWalk(
    { id: 'sidebar-reports', anchor: 'sidebar-item-reports', anchorIsFixed: true,
      expandSidebarGroup: 'Admin',
      requiresPerm: 'reports:view',
      title: 'Reports & Analytics',
      body: 'Five canned report categories, all generated client-side.' },
    REPORTS_PAGE_TOUR, '/reports', 'sidebar-library',
  ),
  ...withPageWalk(
    { id: 'sidebar-library', anchor: 'sidebar-item-library', anchorIsFixed: true,
      expandSidebarGroup: 'Admin',
      requiresPerm: 'library:view',
      title: 'PDF Library',
      body: 'Historical PDF archive (sys_admin only).' },
    LIBRARY_PAGE_TOUR, '/library', 'sidebar-users',
  ),
  ...withPageWalk(
    { id: 'sidebar-users', anchor: 'sidebar-item-users', anchorIsFixed: true,
      expandSidebarGroup: 'Admin',
      requiresPerm: 'users:view',
      title: 'User Management',
      body: 'Invite, edit, and assign roles.' },
    USERS_PAGE_TOUR, '/users', 'sidebar-feedback',
  ),
  ...withPageWalk(
    { id: 'sidebar-feedback', anchor: 'sidebar-item-feedback', anchorIsFixed: true,
      expandSidebarGroup: 'Admin',
      requiresPerm: 'feedback:view',
      title: 'Customer Feedback',
      body: 'QR-code feedback form inbox.' },
    FEEDBACK_PAGE_TOUR, '/feedback', 'sidebar-settings',
  ),
]

const FOOTER: TourStep[] = [
  ...withPageWalk(
    { id: 'sidebar-settings', anchor: 'sidebar-item-settings', anchorIsFixed: true,
      title: 'Settings',
      body: 'Profile, theme, notifications, installation switcher.' },
    SETTINGS_PAGE_TOUR, '/settings', 'sidebar-customize',
  ),
  { id: 'sidebar-customize', anchor: 'sidebar-customize', anchorIsFixed: true,
    title: 'Customize Navigation',
    body: 'Drag-and-drop reorder of every item in this sidebar. Changes sync across all your devices.' },
  { id: 'sidebar-help', anchor: 'sidebar-help', anchorIsFixed: true,
    title: 'Replay anytime',
    body: 'You can replay this tour — or any future tour we add — from this Help button. That\'s it. Welcome aboard.' },
]

export const SIDEBAR_TOUR_STEPS: TourStep[] = [
  { id: 'welcome',
    title: 'Welcome to Glidepath',
    body:
      'Quick walkthrough of the app. We\'ll visit each section of the sidebar, then ' +
      'every page underneath. Each page step explains what the page does and points ' +
      'at its primary controls. You can skip any page\'s deep-dive with the "Skip this ' +
      'page" button, or skip the whole tour with Skip tour. Hit Next to start.' },
  { id: 'pinned-intro', anchor: 'sidebar-pinned', anchorIsFixed: true,
    title: 'Top of the sidebar',
    body: 'Airfield Status and Dashboard sit pinned at the top — your two daily landing pages.' },
  ...PINNED,
  ...OPERATIONS,
  ...AIRFIELD,
  ...REFERENCE,
  ...ADMIN,
  ...FOOTER,
]
