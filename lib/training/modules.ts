import type { LucideIcon } from 'lucide-react'
import {
  Home, Zap, LayoutDashboard, Activity, History, ListChecks, ClipboardCheck,
  ClipboardList, ShieldCheck, ClipboardSignature, AlertTriangle, HardHat,
  PlaneLanding, Bird, Users, Radio, Plane, MapPin, Lightbulb, FileText,
  Database, BookOpen, AlertCircle, BarChart3, Settings, UserCog,
  MessageSquare, GraduationCap, Download, ShieldAlert, Siren, Snowflake,
} from 'lucide-react'
import type { AirportType } from '@/lib/airport-mode'

/**
 * Roles that can show up in the training role-chip filter. Mirrors the
 * USER_ROLES that appear in the sidebar (kiosk roles excluded — they
 * don't see /training).
 */
export type TrainingRole =
  | 'sys_admin'
  | 'base_admin'
  | 'airfield_manager'
  | 'namo'
  | 'amops'
  | 'ces'
  | 'safety'
  | 'majcom_rfm'
  | 'ppr'
  | 'read_only'

export const ROLE_LABELS: Record<TrainingRole, string> = {
  sys_admin: 'Sys Admin',
  base_admin: 'Base Admin',
  airfield_manager: 'Airfield Mgr',
  namo: 'NAMO',
  amops: 'AMOPS',
  ces: 'CES',
  safety: 'Safety',
  majcom_rfm: 'MAJCOM',
  ppr: 'PPR',
  read_only: 'Read Only',
}

/**
 * Per-module training reference. Lives outside training/page.tsx so the
 * page component stays focused on layout + filtering. The PDF generator
 * (lib/training-pdf.ts) reads a structural subset (name / tagline /
 * overview / keyFeatures / howToAccess / screenshots) so this shape is
 * a superset, not a breaking change.
 */
export type ModuleRef = {
  id: string                // url slug for /help/[module-id]
  name: string
  icon: LucideIcon
  color: string             // CSS var or hex used for the module accent
  path: string              // sidebar destination (where the actual module lives)
  tagline: string
  roles: TrainingRole[]     // role chip filter
  /**
   * Which airport_type modes this guide applies to. Omitted = both modes.
   * Mirrors lib/modules-config.ts: ['usaf'] for USAF-only modules (ACSI, SCN,
   * AMTR), ['faa_part139'] for civilian-only modules (SMS, §139.303 Training,
   * AEP, Field Conditions, WHMP). The help page filters the guide grid by the
   * current installation's airport_type so each base sees only relevant guides.
   */
  appliesTo?: AirportType[]
  overview: string          // 2-3 paragraphs (use \n\n between paragraphs)
  keyFeatures: string[]
  howToAccess: string
  workflow?: { title: string; steps: string[] }
  screenshots?: { src: string; caption: string }[]
  faq?: { q: string; a: string }[]
  relatedModules?: string[] // ids
  readMinutes?: number
}

// All operational + AMOPS roles that touch most of the airfield.
// Per-module `roles` arrays describe the **actionable working set** for
// each role — modules that role actively uses or takes action on,
// not every module they have read permission on. CES users see a
// 4-module slice; Safety, MAJCOM, PPR, and Read-Only get curated
// short lists of what they actually need day-to-day.
const OPS_CORE: TrainingRole[] = ['airfield_manager', 'namo', 'amops', 'sys_admin', 'base_admin']
const OPS_AND_SAFETY: TrainingRole[] = [...OPS_CORE, 'safety']
const OPS_AND_OVERSIGHT: TrainingRole[] = [...OPS_CORE, 'majcom_rfm']
const ALL_ROLES: TrainingRole[] = [
  'sys_admin', 'base_admin', 'airfield_manager', 'namo', 'amops',
  'ces', 'safety', 'majcom_rfm', 'ppr', 'read_only',
]

export const MODULES: ModuleRef[] = [
  {
    id: 'airfield-status',
    name: 'Airfield Status',
    icon: Home,
    color: 'var(--color-cyan)',
    path: '/',
    tagline: 'Real-time situational awareness for the runway and the airfield',
    roles: [...OPS_CORE, 'safety', 'ppr', 'read_only'],
    overview:
      'Glidepath\'s landing page and the single screen most users keep open all shift. Combines live weather, runway open/closed status, NAVAID outage indicators, ARFF readiness, advisory alerts, and an at-a-glance count of contractors currently on the field.\n\n' +
      'Edits are inline — set runway labels, change a NAVAID color, toggle AFM Out-of-Office — and every change auto-logs to the Events Log so the AF Form 3616 audit trail builds itself. The page subscribes to Supabase realtime so what one shift changes shows up on every other open browser within a second.',
    keyFeatures: [
      'Current installation, Zulu time, Julian Date and local date in header so it is viewable across the application',
      'Live weather + runway selector with editable status labels',
      'NAVAID grid color-coded green / yellow / red with click-to-update status dialog (notes field for shift handoff context)',
      'ARFF readiness panel with CAT dropdown (when configured)',
      'Advisory + WWA Notification strip (WATCH / WARNING / ADVISORY) for active alerts',
      'AMOPS Out-of-Office and Closed-for-Day toggles that shows Kiosk Mode users the status of AMOPS and the airfield',
      'Custom status boards configurable per base in Base Setup',
      'Personnel-on-Airfield mini-table (full management on /contractors)',
      'PPR grid surfaces transient aircraft inbound today, columns displayed customizable in Base Setup',
      'Realtime updates — no manual refresh needed',
      'Kiosk mode, enabling other agencies to view airfield status without logging in using a token URL that can be reset if compromised',
    ],
    howToAccess: 'Sidebar › Home (/) or mobile bottom-nav Home tab. Glidepath\'s default landing route after sign-in.',
    workflow: {
      title: 'Daily airfield update',
      steps: [
        'Open Glidepath — the Airfield Status page is your default landing.',
        'Scan weather + active runway + advisory strip for anything new since last shift.',
        'Set or change runway status labels if conditions changed (auto-logs to Events Log).',
        'Click any NAVAID and use the status dialog to set green / yellow / red plus shift-handoff notes.',
        'Verify ARFF readiness reflects current CAT.',
        'Toggle AMOPS Out-of-Office from the Dashboard if leaving the office; toggle off when back.',
      ],
    },
    screenshots: [
      { src: '/training/airfield-status_1.png', caption: 'AFM Out-of-Office banner active, with the weather + Runway Status + NAVAID Status + ARFF Status panels rolled up across the top of the page.' },
      { src: '/training/airfield-status_2.png', caption: 'Click any NAVAID to open the status dialog — Green / Yellow / Red with an optional context note (e.g. "01 Glideslope out of service").' },
      { src: '/training/airfield-status_3.png', caption: 'Below the status panels: Personnel on Airfield mini-panel, Construction & Closures, Miscellaneous Info, and the day\'s Prior Permission Required roster.' },
    ],
    faq: [],
    relatedModules: ['discrepancies', 'notams', 'qrc', 'shift-checklist', 'contractors'],
    readMinutes: 5,
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    color: 'var(--color-cyan)',
    path: '/dashboard',
    tagline: 'AMOPS administrative controls',
    roles: OPS_CORE,
    overview:
      'A shift-focused operational view with inspection quick start tiles, the AFM Out-of-Office / Closed-for-Day controls, and module shortcut tiles.\n\n' +
      'The KPI strip shows today\'s airfield + lighting inspection state, the daily-review pending count, the last completed check. The module shortcut tiles jump straight into the most-used flows so you don\'t have to navigate the sidebar.',
    keyFeatures: [
      'Inspection cadence summary — today\'s airfield + lighting status with in-progress / completed states',
      'Last completed check type + Zulu timestamp for quick handoff context',
      'Open-discrepancies count + awaiting-verification badge',
      'AMOPS Out-of-Office and Closed-for-Day toggles with message customization',
      'Module shortcut tiles — Personnel on Airfield, Shift Checklist, QRCs, SCN, and more',
      'Module setup progress bar (sys admin) showing overall base configuration completeness',
      '0600L daily reset honoring the installation timezone',
    ],
    howToAccess: 'Sidebar › Operations › Dashboard. On mobile, More menu › Dashboard.',
    workflow: {
      title: 'Shift handoff briefing',
      steps: [
        'Open the Dashboard at the start of your shift.',
        'Read the inspection cadence — has today\'s airfield inspection been completed?',
        'Note the last-check timestamp + type for context on what the prior shift just did.',
        'Skim open discrepancies and the awaiting-verification badge.',
        'Use the module shortcut tiles to log a contractor, open the shift checklist, or fire a QRC without leaving the page.',
      ],
    },
    screenshots: [
      { src: '/training/dashboard_1.png', caption: 'DASHBOARD header with the last-check stamp, today\'s Airfield + Lighting inspection state, base-setup nudge banner, and the full row of module shortcut tiles (Airfield Checks, New Discrepancy, Personnel on Airfield, Shift Checklist, QRCs, PPR Log, BASH, Out of Office, Close Airfield).' },
    ],
    faq: [],
    relatedModules: ['shift-checklist', 'checks', 'discrepancies', 'daily-reviews'],
    readMinutes: 4,
  },
  {
    id: 'activity',
    name: 'Events Log',
    icon: Activity,
    color: 'var(--color-cyan)',
    path: '/activity',
    tagline: 'Immutable audit trail — the AF Form 3616 substitute',
    roles: OPS_AND_OVERSIGHT,
    overview:
      'Rolling log of every airfield action — status changes, NOTAMs, inspections, sign-offs, manual entries. This is the AF Form 3616 substitute. Entries are immutable; the audit trail captures who did what and when.\n\n' +
      'Most rows are auto-logged by the system as you work. Manual entries are templated for common operational events (Tower Reporting, AMOPS Reporting, Inspections / Checks notes, etc.) so the right category surfaces on the report PDF. Filter by date, type, or actor; search across users / action / entity / notes.',
    keyFeatures: [
      'Immutable audit trail — no edit / delete (except for users own entries)',
      'Date-range filter (Today / 7d / 30d / Custom) + active-filter chip strip',
      'Filter by action type, entity type, or specific user',
      'Full-text search across actor / action / entity / metadata',
      'Manual-entry templates auto-categorize by reporting source',
      'Day-grouped timeline (Zulu) with rank + name attribution + OI badge',
      'Entity links jump to source records (discrepancies, checks, inspections)',
      'Realtime subscription — new entries appear without refresh',
    ],
    howToAccess: 'Sidebar › Operations › Events Log. On mobile, More menu › Operations › Events Log.',
    workflow: {
      title: 'Logging a manual event',
      steps: [
        'Open the Events Log.',
        'Click a template (Tower Reporting / AMOPS / Inspections, etc.) to pre-fill the category.',
        'Type the event details in the body field.',
        'Click Log Event — the entry stamps with your name, rank, OI, and Zulu time.',
        'Filter the timeline below to confirm the entry rendered as expected.',
      ],
    },
    screenshots: [
      { src: '/training/activity_1.png', caption: 'Log Entry Templates modal — pick a category (Tower Reporting / AMOPS Reporting / Inspections / Shift Changes / etc.) then a template (e.g. "{callsign} advises tower is now open; RWY {runway} in use") so manual entries log with a consistent format.' },
      { src: '/training/activity_2.png', caption: 'Period chip cluster (Today / 7 Days / 30 Days / Custom) for narrowing the timeline by date range.' },
      { src: '/training/activity_3.png', caption: 'Full Events Log — header counts + Sign Shift Review + Excel export + New Log Entry field with template helper, sitting above a day-grouped timeline of NAVAID changes, inspections, and manual entries with OI badges and edit/delete affordances.' },
    ],
    faq: [],
    relatedModules: ['recent-activity', 'daily-reviews', 'airfield-status'],
    readMinutes: 4,
  },
  {
    id: 'recent-activity',
    name: 'Recent Activity',
    icon: History,
    color: 'var(--color-cyan)',
    path: '/recent-activity',
    tagline: 'Per-user audit feed — what each teammate has been doing',
    roles: OPS_CORE,
    overview:
      'Extends beyond what the Events Log captures, organized chronology. Useful for shift handoff oversight and answering "who worked what in the last shift."\n\n' +
      'Defaults to the last 7 days. Filter by user, entity type, or action type; search free text in the action details. No edit or delete (it\'s a view onto the same immutable audit trail).',
    keyFeatures: [
      'Period selector — Today / 7d / 30d / 90d / Custom',
      'Filter by entity type (Discrepancy / Check / Inspection / etc.)',
      'Filter by action type (Created / Updated / Deleted / Closed)',
      'User-name + free-text details search',
      'Read-only — no edit / delete capability (audit trail)',
      'Entity links jump to source records (same as Events Log)',
    ],
    howToAccess: 'Sidebar › Operations › Recent Activity. On mobile, More menu › Operations › Recent Activity.',
    workflow: {
      title: 'Shift handoff oversight',
      steps: [
        'Open Recent Activity.',
        'Set the period to the prior shift\'s window (e.g., last 8 hours).',
        'Scan to see what was completed and what was opened.',
        'Click any entity link to jump into the source record for follow-up.',
      ],
    },
    screenshots: [
      { src: '/training/recent-activity_1.png', caption: 'Activity Log — admin audit view spanning every recorded action across the installation, with Today / 7 / 30 / 90 day window selectors.' },
      { src: '/training/recent-activity_2.png', caption: 'Filter row (entity type, action type, user, free-text search) above the day-grouped timeline; each entry surfaces actor, OI badge, and entity link.' },
    ],
    faq: [],
    relatedModules: ['activity', 'daily-reviews', 'dashboard'],
    readMinutes: 3,
  },
  {
    id: 'qrc',
    name: 'Quick Reaction Checklists',
    icon: Zap,
    color: 'var(--color-amber)',
    path: '/qrc',
    tagline: 'Step-by-step checklists with full audit trail',
    roles: OPS_CORE,
    overview:
      '25 emergency and contingency checklist templates that are editable per base — aircraft mishap, hung ordnance, fuel spill, severe weather, and more. The engine steps the responder through each item in order; every acknowledgement is stamped with who did it and when so the after-action review writes itself.\n\n' +
      'Active QRCs persist across shift changes — start a checklist on day shift and mid shift can pick up exactly where you left off. The sidebar fires a red dot whenever a QRC is open so handoffs never miss an in-progress emergency response.',
    keyFeatures: [
      '25 starter templates, plus any custom checklists configured for your base',
      'Four tabs: Available (the library), Active (currently running, persists across shifts), History (audit trail), Reviews (for documenting checklist reviews IAW DAFMAN 13-204v2, configurable for monthly or quarterly)',
      'Eight step types: confirmations, notifications, free-text capture, sub-checklists, navigations to other modules, status updates, and more',
      'Per-step audit: who acknowledged + Zulu timestamp, captured automatically',
      'After-Action Report PDF on close — every step + acknowledgement, ready for post-event debrief',
      'Review-overdue indicator on each tile flags templates whose annual review is past due',
      'Integration with SCN module (some checklists fire an SCN call as a step)',
      'Sidebar dot fires red while any QRC is active; clears when all are closed',
    ],
    howToAccess: 'Sidebar › Operations › QRC, or mobile More menu › Operations › QRC.',
    workflow: {
      title: 'Activating and closing a QRC',
      steps: [
        'On the Available tab, click any tile to start that checklist.',
        'Step through each item in order; the engine captures who acknowledged and when.',
        'If you hand off mid-emergency, the QRC stays in Active for the next shift to resume.',
        'When complete, click Close — stamps closer name + Zulu time and freezes the record.',
        'Download the After-Action PDF from the closed-QRC view for the post-event debrief.',
      ],
    },
    screenshots: [
      { src: '/training/qrc_1.png', caption: 'Execution Report PDF for a closed QRC — full status block (Opened / Closed / Progress 16/16 done) followed by every checklist step + sub-step with DONE markers and Zulu timestamps for the after-action record.' },
      { src: '/training/qrc_2.png', caption: 'Active tab with an open QRC mid-execution — progress bar across the top, per-step DONE / N/A toggles, and Add note fields. Stays put across shift changes so the next operator can resume.' },
      { src: '/training/qrc_3.png', caption: 'Available tab tile grid — each tile shows step count and a per-template review status (Reviewed [date] in green, Never reviewed in red).' },
    ],
    faq: [],
    relatedModules: ['scn', 'discrepancies', 'activity', 'shift-checklist'],
    readMinutes: 7,
  },
  {
    id: 'scn',
    name: 'Secondary Crash Net',
    icon: Radio,
    color: 'var(--color-danger)',
    path: '/scn',
    tagline: 'Daily SCN check log + monthly evidence package',
    roles: OPS_CORE,
    appliesTo: ['usaf'],
    overview:
      'Daily Secondary Crash Net communication check log. Each shift toggles the agencies that were reached during the SCN check, and the system stamps the time and person performing it. Agencies are configured per base in Base Setup › SCN Agencies.\n\n' +
      'The monthly PDF export is your AFMAN evidence package showing every daily check, with per-agency response status broken out for the entire month. No agency is hardcoded — every base configures its own roster (Tower, Fire, Ambulance, Security Forces, Command Post, Hospital, etc.).',
    keyFeatures: [
      'Daily SCN check log with per-agency toggle badges',
      'Per-base agency roster configured in Base Setup › SCN Agencies',
      'Time-stamp captured automatically when toggles are flipped',
      'Notes field for shift comments (radio issues, agency unreachable, etc.)',
      'Monthly PDF export with full month\'s checks + per-agency rollup',
      'Historical entries retain their original agency snapshot — adding/removing agencies doesn\'t rewrite history',
    ],
    howToAccess: 'Sidebar › Operations › SCN. On mobile, More menu › Operations › SCN.',
    workflow: {
      title: 'Performing the daily SCN check',
      steps: [
        'Open the SCN page at the start of your shift.',
        'Initiate the SCN call following local procedures.',
        'Toggle each agency badge as they respond.',
        'Add notes for any agency that didn\'t answer or any radio issues.',
        'At month-end, export the monthly PDF for the AFMAN evidence binder.',
      ],
    },
    screenshots: [
      { src: '/training/scn_1.png', caption: 'Monthly PDF export — agency × day matrix with L (Loud & Clear, green), N (No Response, amber), X (Out of Service, red), and · (No check logged, gray). Plus a Monthly Back-up SCN row at the bottom.' },
      { src: '/training/scn_2.png', caption: 'Daily SCN Check modal — Opening Call script callout, Mark All Loud & Clear shortcut, then per-agency three-state cards (Loud & Clear / No Response / Out of Service).' },
    ],
    faq: [],
    relatedModules: ['qrc', 'activity', 'shift-checklist'],
    readMinutes: 4,
  },
  {
    id: 'shift-checklist',
    name: 'Shift Checklist',
    icon: ListChecks,
    color: 'var(--color-cyan)',
    path: '/shift-checklist',
    tagline: 'Per-shift task tracking with three-state toggles',
    roles: OPS_CORE,
    overview:
      'Per-shift task list (Day / Swing / Mid). Three-state toggle per task — unchecked, completed, or N/A — with a progress bar that includes both completed and N/A items. Resets at 0600L per the installation timezone.\n\n' +
      'Items are configured per base in Base Setup › Shift Checklist with frequency tags (Daily / Weekly / Monthly). Items only show on days they apply (e.g., a weekly item skips days when not due). Completing the checklist locks all toggles and stamps closer name + time; reopening clears all responses.',
    keyFeatures: [
      'Day / Swing / Mid shift tabs with per-shift item filtering',
      'Three-state toggle: unchecked › completed › N/A › unchecked (cycle)',
      'Progress bar: (completed + N/A) / total — N/A counts as resolved',
      'Frequency color-coding: Daily (cyan), Weekly (purple), Monthly (warning amber)',
      '0600L daily reset honoring installation timezone (configurable per base)',
      'Complete Checklist locks all toggles + stamps closer + Zulu time',
      'Reopen (AFM-gated) clears responses for re-completion',
      'History tab shows past checklists with per-item responses + closer info',
    ],
    howToAccess: 'Sidebar › Operations › Shift Checklist. On mobile, More menu › Operations › Shift Checklist.',
    workflow: {
      title: 'Completing the shift checklist',
      steps: [
        'Open Shift Checklist at the start of your shift; pick your shift tab.',
        'Work down the list, toggling items completed or N/A as you go.',
        'Complete required items before signing off the shift.',
        'Click Complete Checklist — system stamps closer name + Zulu time.',
        'Past checklists are visible in the History tab for the audit trail.',
      ],
    },
    screenshots: [
      { src: '/training/shift-checklist_1.png', caption: 'History view — past shift-checklist filings by date, with the filer (rank + name) and Zulu time, each with a green FILED pill.' },
      { src: '/training/shift-checklist_2.png', caption: 'Completed items render with a green check + strikethrough + closer name + Zulu time. The Monthly amber pill on the right marks frequency.' },
      { src: '/training/shift-checklist_3.png', caption: 'Active checklist panel — IN PROGRESS pill, completion counter (6/33), Day Shift section with item descriptions and per-item closer attribution.' },
    ],
    faq: [],
    relatedModules: ['daily-reviews', 'dashboard', 'checks'],
    readMinutes: 4,
  },
  {
    id: 'checks',
    name: 'Airfield Checks',
    icon: ClipboardCheck,
    color: 'var(--color-cyan)',
    path: '/checks',
    tagline: '7 check types, draft persistence, inline discrepancy capture',
    roles: OPS_CORE,
    overview:
      'Daily, lighting, FOD, weather, construction, heavy aircraft, and other checks. Pick a type, work through the items, and log discrepancies inline as you find them. Drafts auto-save to the database so you can resume from another device.\n\n' +
      'Discrepancies you log during a check auto-route to the right CES shop based on the type-to-shop mapping in Base Setup. Photos attach per-discrepancy to the discrepancy database. Check-specific fields (RSC for Daily, BWC for FOD, BASH for Wildlife checks) appear conditionally based on the check type chosen.',
    keyFeatures: [
      'Seven check types — Daily, Lighting, FOD, Weather, Construction, Other, Heavy Aircraft',
      'Per-area selector covers entire airfield or specific zones configured in Base Setup',
      'Inline discrepancy capture — log issues as you find them, photo + GPS optional',
      'Draft auto-save to database for cross-device resume',
      'Resume prompt on page load if a draft exists from another device',
      'Conditional fields by check type (RSC, BWC, RCR, BASH)',
      'Offline write queue — drafts sync when connection returns',
      'Submission logs the check; discrepancies auto-route to assigned CES shop',
    ],
    howToAccess: 'Sidebar › Operations › Airfield Checks. On mobile, More menu › Operations › Airfield Checks.',
    workflow: {
      title: 'Conducting a daily check',
      steps: [
        'Open Airfield Checks; select Daily as the check type.',
        'Pick the area (Entire Airfield or per-zone).',
        'Work down the inspection items, toggling each as you go. Capture discrepancies inline with photos.',
        'Fill in check-specific fields (RSC, BWC, etc.) if applicable.',
        'Click Submit when done — the check logs and discrepancies route to CES.',
      ],
    },
    screenshots: [
      { src: '/training/checks_1.png', caption: 'Resume prompt on landing — "Check In Progress: You have an unfinished FOD Check saved May 3" with Resume Check / Discard buttons. Drafts persist across devices.' },
      { src: '/training/checks_2.png', caption: 'Mid-check view — Check Type chip up top, an Issue Found toggled in red, Issue Details panel with pin-on-map, Comment, Location/Area, Use My Location, Add Photo, Save Draft.' },
      { src: '/training/checks_3.png', caption: 'Check Type tile grid — FOD Check, RSC/RCR Check, In-Flight Emergency, Ground Emergency, Heavy Aircraft Check, BASH Check, Construction Check, Other.' },
    ],
    faq: [],
    relatedModules: ['discrepancies', 'inspections', 'shift-checklist'],
    readMinutes: 6,
  },
  {
    id: 'inspections',
    name: 'All Inspections',
    icon: ClipboardList,
    color: 'var(--color-cyan)',
    path: '/inspections/all',
    tagline: 'Daily, ACSI, Construction, and Joint inspection launcher',
    roles: OPS_CORE,
    overview:
      'Launchpad for every inspection cadence at your base — Daily Airfield (DAFMAN 13-204v2), ACSI (Para 5.4.3 annual compliance), Pre/Post Construction, and Monthly Joint. Each tile starts a new inspection of that type or opens its history.\n\n' +
      'Daily Airfield is hard-locked to one airfield + one lighting inspection per day, per base, with a 0600L reset. Drafts auto-save to device cache with cross-device load from database upon draft save. Issues you log roll into the Discrepancies module with the same workflow + CES routing.',
    keyFeatures: [
      'Four inspection types — Daily Airfield, ACSI, Pre/Post Construction, Monthly Joint',
      'Daily one-per-day lock prevents double-booking at the same base',
      '0600L reset honoring installation timezone',
      'Auto-save drafts to device; cross-device load from database with save draft option before filing',
      'Time started stamped on insert for accurate audit trail, with auto "AFLD3/ ON AFLD FOR..."',
      'Issues log to Discrepancies with auto-routing to CES shops',
      'Photos attach per-issue to the discrepancy database',
      'History link on every tile — filter by date, inspector, status',
    ],
    howToAccess: 'Sidebar › Operations › All Inspections. On mobile, More menu › Operations › All Inspections.',
    workflow: {
      title: 'Starting a daily inspection',
      steps: [
        'Open All Inspections or navigate to the Dashboard.',
        'Click the Daily Airfield tile to start a new airfield inspection.',
        'Work through the inspection items; log discrepancies and capture photos as you find issues.',
        'The draft auto-saves; sign in from another device to continue if needed.',
        'Submit when complete — the inspection logs and discrepancies route to CES.',
      ],
    },
    screenshots: [
      { src: '/training/inspections_1.png', caption: 'Inspections launchpad — four cadence tiles with their own start + history actions: Daily Airfield Inspection, Airfield Compliance and Safety Inspection (ACSI), Pre/Post Construction, Monthly Joint Inspection.' },
      { src: '/training/inspections_2.png', caption: 'ACSI tile with an in-progress draft — Continue ACSI Draft button (long-running multi-day inspections resume from where you left off).' },
    ],
    faq: [],
    relatedModules: ['acsi', 'checks', 'discrepancies'],
    readMinutes: 6,
  },
  {
    id: 'acsi',
    name: 'ACSI Inspection',
    icon: ShieldCheck,
    color: 'var(--color-purple)',
    path: '/acsi',
    tagline: 'Annual Airfield Compliance + Safety Inspection (DAFMAN 5.4.3)',
    roles: OPS_CORE,
    appliesTo: ['usaf'],
    overview:
      'Annual compliance inspection per DAFMAN 13-204v2 Para 5.4.3. The full ACSI checklist runs to hundreds of items across multiple sections; the engine renders one section at a time, captures pass/fail/N/A per item with optional remarks and photos, and supports per-member signatures so the inspection team\'s sign-off is on the record.\n\n' +
      'Drafts auto-save and resume — ACSI often span days. The launcher tile on /inspections/all surfaces an in-progress draft as "Continue ACSI Draft" so you can pick up where you left off without searching.',
    keyFeatures: [
      'Hundreds of items across multiple sections, rendered one section at a time',
      'Pass / Fail / N/A per item with optional remarks + photo evidence',
      'Per-member signature toggle (configurable in Base Setup) for team sign-off',
      'Auto-save with cross-device resume — surfaces as "Continue ACSI Draft" on the launcher',
      'Existing discrepancies can be linked to Fail items, importing remarks, project cost, Work Order number, Risk Control Measures etc. with full workflow integration',
      'PDF export bundles the entire inspection with signatures + photos all in line, without manual consolidation',
      'History tab shows every past ACSI run with completion status',
    ],
    howToAccess: 'Sidebar › Operations › All Inspections › ACSI tile (Start ACSI or Continue ACSI Draft).',
    workflow: {
      title: 'Running an ACSI inspection',
      steps: [
        'From All Inspections, click ACSI to start a new inspection.',
        'Step the team through each section — Pass / Fail / N/A per item with remarks and photos.',
        'For Failed items, link a discrepancy directly from your discrepancy log.',
        'Save and resume across days as needed — the draft persists.',
        'When complete, export the PDF and collect per-member signatures for the official record.',
      ],
    },
    screenshots: [
      { src: '/training/acsi_1.png', caption: 'Inspection Team Coordination — Airfield Manager (Required) section with Rank / Name / Title fields and a "Signature required on PDF" toggle that brings the signer into the official PDF.' },
      { src: '/training/acsi_2.png', caption: 'Section 1 — Obstacle Clearance Criteria mid-inspection. Per-item Y / N / N/A toggles, with a failed item expanding the inline DISCREPANCY DETAILS panel (pin-on-map, photo, comment) so the gap is captured without leaving the section.' },
    ],
    faq: [],
    relatedModules: ['inspections', 'discrepancies', 'daily-reviews'],
    readMinutes: 6,
  },
  {
    id: 'daily-reviews',
    name: 'Daily Reviews',
    icon: ClipboardSignature,
    color: 'var(--color-purple)',
    path: '/daily-reviews',
    tagline: 'Per-shift sign-off + NAMO/AFM daily certification',
    roles: OPS_AND_OVERSIGHT,
    overview:
      'DAFMAN 13-204v1 §2.5.2.10.3 / .10.4 shift turnover and daily review queue. Each shift signs off on the events from their shift; AFM finalizes the review. Pending and reviewed counters in the header give an at-a-glance read before scrolling.\n\n' +
      'The colored left rail on each row communicates state: green when fully certified, amber when today is pending (your turn), quiet when a past day is still unsigned. Click any row to open the sign modal. Required slots adapt to your base — bases.shift_count (2 or 3) determines whether you have Day/Mid/Swing or just Day/Swing.',
    keyFeatures: [
      'Per-day rows with colored left rail showing state at a glance',
      'Required slots: Day AMSL / Swing AMSL / Mid AMSL + NAMO + AFM (slot count from bases.shift_count)',
      'Events save and freeze the daily review on certification by the AFM',
      'Events Log shows AMENDED pill when an entry on Events Log is amended after the Daily Ops Summary is fully certified.',
      'Sign modal carries name + rank + Zulu timestamp + optional notes per slot',
      'AFM certification stamps when every required slot is signed; row turns green',
      'PDF export per day for Air Force Records Disposition requirements',
      'Pending vs reviewed counter in the header for queue oversight',
    ],
    howToAccess: 'Sidebar › Operations › Daily Reviews. On mobile, More menu › Operations › Daily Reviews.',
    workflow: {
      title: 'Signing your shift\'s daily review',
      steps: [
        'Open Daily Reviews; today\'s row should be amber if your slot is pending.',
        'Click today\'s row to open the sign modal.',
        'Scroll through the day\'s events to confirm everything looks right.',
        'Sign your slot — the system records your name, rank, and Zulu timestamp.',
        'AFM signs last to close the day; the row turns green when fully certified.',
      ],
    },
    screenshots: [
      { src: '/training/daily-reviews_1.png', caption: 'Daily Review modal — full-page PDF preview on the left, four-slot signature panel on the right (Day Shift AMSL, Swing Shift AMSL, NAMO, Airfield Manager) with timestamps, FULLY REVIEWED pill once all slots are signed, plus Sign Review / Email this review / Download Reviewed PDF actions.' },
      { src: '/training/daily-reviews_2.png', caption: 'Per-day rows showing PENDING (slots still missing) vs REVIEWED (all four signed). Each card surfaces signer last name + initials so you can see at a glance who covered the day.' },
    ],
    faq: [],
    relatedModules: ['activity', 'recent-activity', 'shift-checklist'],
    readMinutes: 5,
  },
  {
    id: 'discrepancies',
    name: 'Discrepancies',
    icon: AlertTriangle,
    color: 'var(--color-warning)',
    path: '/discrepancies',
    tagline: 'Issue tracking with CES routing and verification workflow',
    roles: [...OPS_CORE, 'ces'],
    overview:
      'Submit problems, route them to the right CES shop, and verify the work when CES marks it complete. The green dot on the sidebar fires when something is waiting for AMOPS verification — the second-to-last state in the lifecycle (Work Completed Awaiting Verification).\n\n' +
      'New discrepancies auto-route to the assigned CES shop based on the type-to-shop mapping in Base Setup. KPI tiles up top quick-filter to Open, > 30 Days, or per-current-status (AFM / CES / AMOPS). Map view plots every filtered discrepancy on the airfield diagram for spotting clusters.',
    keyFeatures: [
      'Lifecycle: Submitted › Awaiting Action by CES › Waiting for Project / In Work › Work Completed (Awaiting Verification) › Closed',
      'Auto-routing to CES shops based on type-to-shop mapping (configured in Base Setup)',
      'KPI tiles for quick-filter (Open, > 30 Days, AFM / CES / AMOPS owners)',
      'Map view plots every filtered discrepancy on the airfield diagram',
      'Status pills with colored left rails on every row showing current owner',
      'Photos per discrepancy',
      'Notes history on every discrepancy detail for back-and-forth context',
      'Excel / PDF / Email export of the current filtered view',
      'Sidebar green dot fires when discrepancies await AMOPS verification',
    ],
    howToAccess: 'Sidebar › Airfield Management › Discrepancies. On mobile, More menu › Airfield Management › Discrepancies.',
    workflow: {
      title: 'Filing and verifying a discrepancy',
      steps: [
        'Click + New on Discrepancies. Pick the type — system auto-assigns the CES shop.',
        'Add description, photos, and location. Submit.',
        'CES sees the discrepancy in their queue, updates status as work progresses.',
        'When CES marks Work Completed Awaiting Verification, the sidebar green dot fires.',
        'Verify the fix in person, then close the discrepancy from the detail view.',
      ],
    },
    screenshots: [
      { src: '/training/discrepancies_1.png', caption: 'Map view of discrepancies plotted on the satellite airfield diagram, with the KPI quick-filter tiles up top (Open / >30 Days / AFM / CES / AMOPS owners) and Excel / PDF / Email / + New actions.' },
      { src: '/training/discrepancies_2.png', caption: 'Discrepancy detail — work-order header, full description, Location / Type / Current Status / Work Order assigned shop, Days Open + ECD, Pinned Location map snippet, plus Update / Status / Capture / Upload / Export PDF / Email / Delete actions.' },
      { src: '/training/discrepancies_3.png', caption: 'List view — title-by-title rows with display ID and the current status pill (TO AFM / TO CES / AWAIT CES) showing who currently owns each discrepancy.' },
    ],
    faq: [],
    relatedModules: ['ces', 'inspections', 'checks', 'infrastructure'],
    readMinutes: 7,
  },
  {
    id: 'ces',
    name: 'CES Work Orders',
    icon: HardHat,
    color: 'var(--color-orange)',
    path: '/ces',
    tagline: 'CES-shop-filtered queue of routed discrepancies',
    roles: ['ces', 'airfield_manager', 'sys_admin', 'base_admin'],
    overview:
      'CES-role landing — a shop-filtered queue of discrepancies routed to your shop. Update status (In Work, Project, Work Completed Awaiting Verification), drop resolution notes, and AMOPS verifies before final close.\n\n' +
      'Shop tabs at top let you filter to your shop or scan All Shops. KPI badges break out NEW / IN WORK / PROJECT / VERIFY / OVERDUE counts; click any badge to filter. Recently completed discrepancies show in a separate read-only section for the audit trail.',
    keyFeatures: [
      'Shop tabs filter to your shop with inline counts',
      'KPI badges: NEW / IN WORK / PROJECT / VERIFY / OVERDUE — click to filter',
      'Status modal limited to the CES-relevant transitions (In Work / Project / Work Completed)',
      'Resolution notes captured per status update for the discrepancy notes history',
      'Recently completed section shows the last 7 days of closed work',
      'Realtime updates — shop counts refresh as new discrepancies arrive',
      'Flat sidebar for CES-only users (Discrepancies / CES / Visual NAVAIDs / Settings)',
    ],
    howToAccess: 'Sidebar › Airfield Management › CES Work Orders (or sidebar landing for CES-role users).',
    workflow: {
      title: 'Working a discrepancy',
      steps: [
        'Open CES Work Orders; select your shop tab.',
        'Click any row to view the discrepancy details.',
        'Update status (In Work when starting; Project when waiting on materials/design).',
        'Mark Work Completed Awaiting Verification when the fix is in place.',
        'AMOPS verifies and closes — the discrepancy moves to Recently Completed.',
      ],
    },
    screenshots: [
      { src: '/training/ces_1.png', caption: 'CES Work Orders — shop tabs across the top (All Shops / CE Electrical / CE Structures / CE Engineering / CE Roads & Grounds / USDA / Airfield Management) with NEW / IN WORK / PROJECT / VERIFY / OVERDUE counters, an Active Work Queue list, and a Recently Completed (7 Days) section below.' },
      { src: '/training/ces_2.png', caption: 'Update Status modal — five-step lifecycle stepper (AFM › CES › In Work › Project › Verify), Open / Closed toggle, Current Status, Assigned Shop dropdown, optional notes, and a single Update Status button.' },
    ],
    faq: [],
    relatedModules: ['discrepancies', 'infrastructure'],
    readMinutes: 5,
  },
  {
    id: 'ppr',
    name: 'PPR Log',
    icon: PlaneLanding,
    color: 'var(--color-cyan)',
    path: '/ppr',
    tagline: 'Prior Permission Required for transient aircraft',
    roles: ['ppr', ...OPS_CORE],
    overview:
      'Prior Permission Required entries for transient aircraft. The sidebar dot fires when entries are awaiting your review, approval, or coordination. Aircrews request via a QR-coded public form at /<your-icao>/ppr-request — no login required — and submissions land here with status Awaiting Review.\n\n' +
      'The column set is configured per base in Base Setup › PPR Columns. Status pills track the lifecycle: Review › Coordination › Approval › Approved / Denied / Canceled. Soft-canceled rows strike through but stay visible for the audit trail. Email approve/deny + branded PPR PDF export are built in.',
    keyFeatures: [
      'Public QR-coded request form at /<icao>/ppr-request — no login needed',
      'Configurable column set per base (Base Setup › PPR Columns)',
      'Request queue with KPI pills (Awaiting Review / Awaiting Approval / per-agency pending)',
      'Multi-agency coordination log with per-agency reply tracking',
      'Status pills: Review › Coordination › Approval › Approved / Denied / Canceled',
      'Email approve / deny with branded denial reason.',
      'Single-page PPR PDF for the requestor',
      'Soft-cancel preserves rows in the audit trail (strikethrough display)',
    ],
    howToAccess: 'Sidebar › Operations › PPR. On mobile, More menu › Operations › PPR.',
    workflow: {
      title: 'Triaging a public PPR request',
      steps: [
        'Open PPR; the Awaiting Review pill shows new public submissions.',
        'Click any row to open the detail editor.',
        'Coordinate with required agencies (Tower, Transient Alert, Fuels, etc.) using the coordination log.',
        'Once coordinated, move to Approval and decide — the requestor gets an email.',
        'Export the PPR PDF for the approved arrival.',
      ],
    },
    screenshots: [
      { src: '/training/ppr_1.png', caption: 'Public PPR request form (Selfridge ANG Base shown) — Name / Email / Commercial Phone / Arrival Date plus base-specific service callouts (Tower hours, transient services), then aircraft details (Callsign, Aircraft Type, Quantity, ETA Z). No login required.' },
      { src: '/training/ppr_2.png', caption: 'PPR detail — full Request Details block (arrival date, callsign, aircraft type/qty, ICAOs, ETA/ETD, POC name/email/phone, weight-bearing waiver), Remarks field, Audit timestamps, and Decide / Edit / Cancel / Del action row.' },
      { src: '/training/ppr_3.png', caption: 'PPR Log — KPI tile row (Awaiting Review, Awaiting Approval, per-agency pending counts) above a review table with PPR # / Status pill / Arrival Date / Callsign / Aircraft Type columns.' },
    ],
    faq: [],
    relatedModules: ['contractors', 'activity', 'airfield-status'],
    readMinutes: 6,
  },
  {
    id: 'wildlife',
    name: 'Wildlife / BASH',
    icon: Bird,
    color: 'var(--color-amber)',
    path: '/wildlife',
    tagline: 'Bird and Wildlife Aircraft Strike Hazard reporting',
    roles: [...OPS_CORE, 'safety'],
    overview:
      'Bird and wildlife Aircraft Strike Hazard module per DAFMAN 91-212. Log every sighting and every strike, track dispersal effectiveness, and build the trend data your annual mitigation review depends on. Species list is curated to your base in Base Setup › Wildlife Species.\n\n' +
      'Two entry types: + Sighting (green) for observed wildlife with optional dispersal action; + Strike (red) for confirmed aircraft contact with damage level and aircraft details. They feed two different reporting requirements. Heatmap aggregates strike density on the airfield map; analytics breaks out trends by species and time-of-day.',
    keyFeatures: [
      'DAFMAN 91-212 BASH program logging — sightings + strikes',
      'Species picker with photos curated per base in Base Setup › Wildlife Species (270+ species available)',
      'Dispersal action + effectiveness tracking on sightings',
      'Damage level + aircraft details on strikes',
      'Day-grouped timeline (Today / Yesterday / weekday-date)',
      'Heatmap view aggregates strike density on the airfield map (Mapbox)',
      'Analytics: monthly volume, top species, dispersal success rate, damage distribution',
      'Reports tab generates the wildlife strike summary PDF',
    ],
    howToAccess: 'Sidebar › Operations › Wildlife / BASH. On mobile, More menu › Operations › Wildlife.',
    workflow: {
      title: 'Logging a wildlife sighting',
      steps: [
        'Open Wildlife / BASH; click + Sighting.',
        'Pick the species + count, set the location.',
        'If you took dispersal action, capture the method and effectiveness.',
        'Submit — the sighting appears on the timeline and feeds the heatmap + analytics.',
      ],
    },
    screenshots: [
      { src: '/training/wildlife_1.png', caption: 'Analytics tab — KPI cards (Total Sightings / Strikes / Dispersal Actions / Dispersal Effectiveness), Sightings By Month bar chart, Top Species ranking, and Birds / Mammals species-group split.' },
      { src: '/training/wildlife_2.png', caption: 'Heatmap tab — density overlay on the satellite airfield (Low → High legend) with 30-day / All Activity filters and a live data-point counter for hotspot identification.' },
      { src: '/training/wildlife_3.png', caption: 'Activity Log tab — day-grouped Sighting (green) and Strike (red) entries with species, count, Zulu time, runway tag, and damage rating where applicable.' },
    ],
    faq: [],
    relatedModules: ['discrepancies', 'reports', 'qrc'],
    readMinutes: 5,
  },
  {
    id: 'contractors',
    name: 'Personnel on Airfield',
    icon: Users,
    color: 'var(--color-cyan)',
    path: '/contractors',
    tagline: 'Contractors and Personnel on the Airfield tracking',
    roles: OPS_CORE,
    overview:
      'Track who is on the airfield, what facility they are visiting, who is escorting them, and AF Form 483 validation. Active personnel show on the Airfield Status page so the duty AMOPS personnel have constant read on who\'s out there. Automatic entries are made to the Events Log as personnel are logged on and off the airfield.\n\n' +
      'Templates speed up recurring contractors — define a template once, apply it for repeat visits. Filter tabs (Active / All / Completed) and a search bar narrow the list. AF Form 483 refresher dates color-code red when imminent.',
    keyFeatures: [
      'Entry / exit logging with escort assignment',
      'Templates for recurring contractors (stored in bases.contractor_templates JSONB)',
      'Active / All / Completed filter tabs',
      'Credential expiry color-coding (red when within 30 days)',
      'Active personnel mirror to the Airfield Status page mini-table',
      'Search by company, contact name, location, or escort',
      'PDF + Email export for shift handoff or daily rollup',
    ],
    howToAccess: 'Sidebar › Airfield Management › Personnel on Airfield. On mobile, More menu › Airfield Management › Personnel.',
    workflow: {
      title: 'Logging a contractor on the airfield',
      steps: [
        'Open Personnel on Airfield; click + Add Personnel.',
        'Fill in company, contact, location, escort, AF Form 483 and POV pass information as applicable.',
        'Submit — the entry logs and the contractor appears on Airfield Status.',
        'When they leave, click their row and mark exit time — they move to Completed.',
      ],
    },
    screenshots: [
      { src: '/training/contractors_1.png', caption: 'New Personnel Entry form — template picker plus Company / Contact / Location / Start Date / Work Description / Radio / Flag (vehicle escort) / Callsign / AF Form 483 # / 483 Expiration Date / Phone / Notes.' },
      { src: '/training/contractors_2.png', caption: 'Active queue — template loaded with an "AF Form 483 EXPIRED" warning surfaced on the template summary, then per-personnel rows (CES1, AECOM) with Edit / Mark Completed actions. Active / All / Completed tabs above plus Export PDF / Email.' },
    ],
    faq: [],
    relatedModules: ['airfield-status', 'activity'],
    readMinutes: 4,
  },
  {
    id: 'parking',
    name: 'Aircraft Parking',
    icon: Plane,
    color: 'var(--color-cyan)',
    path: '/parking',
    tagline: 'UFC 3-260-01 parking plans with live clearance analysis',
    roles: OPS_CORE,
    overview:
      'Plan transient and home station parking with wingtip and taxilane clearance envelopes per UFC 3-260-01. Drag aircraft, set heading, and the engine ray-tests against runways, taxiways, and adjacent spots in real time. Plans persist per base — multiple plans can be saved to the database.\n\n' +
      'The floating panel has four tabs: Aircraft (placed silhouettes grouped by type), Environment (obstacles + taxilanes + apron boundaries), Clearance (live UFC evaluation with violations + warnings), and Settings (per-plan apron context that flips which UFC table the engine reads).',
    keyFeatures: [
      'UFC 3-260-01 wingtip + taxilane clearance evaluation, live as you drag',
      'To-scale aircraft silhouettes from a 200+ airframe library',
      'Multiple plans per base — Draft / Active / Template states',
      'Box-select for batch heading rotation + bulk clearance overrides',
      'Multi-aircraft, obstacle, taxilane, and apron-boundary drawing tools',
      'Clearance tab shows every violation + warning with feet-clearance numbers and UFC cite',
      'Per-plan apron context (Parking / Taxiway / Loading) shifts the UFC table values',
      'PDF + Email export with to-scale plan view + violations summary + UFC cite chain',
    ],
    howToAccess: 'Sidebar › Airfield Management › Aircraft Parking. On mobile, More menu › Airfield Management › Parking.',
    workflow: {
      title: 'Building a transient parking plan',
      steps: [
        'Open Parking; click + on the panel header to create a new plan.',
        'Click + Add Aircraft on the Aircraft tab; pick an airframe and place it on the map.',
        'Drag and rotate as needed — the Clearance tab updates live.',
        'Switch to Clearance tab; resolve violations by repositioning or overriding clearances.',
        'Set the plan Active when ready.',
      ],
    },
    screenshots: [
      { src: '/training/parking_1.png', caption: 'Floating panel Clearance tab — three violation rows showing actual-vs-required clearance distances (9.0ft / 25ft, 17.4ft / 25ft, 87.0ft / 115.4ft) with the offending source (aircraft × aircraft, aircraft × peripheral taxilane) tagged VIOLATION.' },
      { src: '/training/parking_2.png', caption: 'Aircraft tab — placed silhouettes grouped by airframe (8 KC-135R/T Stratotankers) with a master heading slider that rotates the whole group plus per-instance heading + clearance.' },
      { src: '/training/parking_3.png', caption: 'Full satellite map view with eight KC-135R/T Stratotanker silhouettes laid out across the apron, peripheral taxilane envelopes drawn in purple/amber, and the left-edge toolbar (Aircraft / Point / Building / Line / Circle / Boundary / Per Tax) for adding new objects.' },
    ],
    faq: [],
    relatedModules: ['aircraft', 'obstructions', 'infrastructure'],
    readMinutes: 8,
  },
  {
    id: 'obstructions',
    name: 'Obstruction Evaluation',
    icon: MapPin,
    color: 'var(--color-danger)',
    path: '/obstructions',
    tagline: 'UFC 3-260-01 imaginary surface analysis',
    roles: OPS_CORE,
    overview:
      'UFC 3-260-01 Chapter 3 imaginary-surface analysis. Plot a candidate obstruction (crane, antenna, structure) and the engine computes whether it penetrates the primary, approach, transitional, or inner-horizontal surfaces — and by how many feet.\n\n' +
      'The map renders FAA survey coordinates for every imaginary surface around your runways and taxiways. Pick a point (or use Use My Location for an in-situ evaluation) and the card below the map reports coordinates, distance from centerline, and the surface name + altitude at that point.',
    keyFeatures: [
      'Imaginary surface plotting per UFC 3-260-01 Chapter 3',
      'FAA survey-grade coordinates for primary, approach, transitional, inner-horizontal',
      'Single-point evaluation: click map or Use My Location',
      'Multi-point mode: lines + areas evaluated at every vertex with worst-penetration flagging',
      'Required Actions section numbers FAA, CES and leadership notification steps',
      'History page shows every past evaluation with re-open links',
      'Distance + altitude calculations use published coordinates (not visual rendering)',
    ],
    howToAccess: 'Sidebar › Airfield Management › Obstruction Evaluation. On mobile, More menu › Airfield Management › Obstructions.',
    workflow: {
      title: 'Evaluating a candidate obstruction',
      steps: [
        'Open Obstruction Evaluation.',
        'Click the map at the candidate location (or use Use My Location for in-situ).',
        'Read the surface name + altitude from the card below the map.',
        'If multi-point (line / area), use the multi-point mode to evaluate every vertex.',
        'Save the evaluation — it appears in History for the next review cycle.',
      ],
    },
    screenshots: [
      { src: '/training/obstructions_1.png', caption: 'History list — every past evaluation with display ID, VIOLATION (red) / CLEAR (green) status, AGL height, distance from centerline, surfaces breached, and resolution context (e.g. "Trimmed to 15ft", "Covered under DEMO-WV-2024-002") per row with Edit / Delete actions.' },
      { src: '/training/obstructions_2.png', caption: 'VIOLATION DETECTED detail — controlling surface, total obstruction height MSL vs max allowable, surface-by-surface analysis (Approach-Departure Clearance, Runway Clear Zone, Graded Portion of Clear Zone) with per-surface penetration in feet, NOT APPLICABLE list, taxiway surface analysis, and applicable UFC references.' },
      { src: '/training/obstructions_3.png', caption: 'Click-to-evaluate map view — satellite airfield with Clear Zone overlay (yellow), a marker dropped at the candidate point, and a Selected Location panel showing coordinates / distance from centerline / nearest threshold / ground elevation / surface zone, plus a NOTAM reference for the position.' },
    ],
    faq: [],
    relatedModules: ['parking', 'infrastructure', 'waivers'],
    readMinutes: 5,
  },
  {
    id: 'infrastructure',
    name: 'Visual NAVAIDs',
    icon: Lightbulb,
    color: 'var(--color-amber)',
    path: '/infrastructure',
    tagline: 'NAVAID inventory + DAFMAN A3.1 outage engine',
    roles: [...OPS_CORE, 'ces'],
    overview:
      'Map view of every NAVAID component on the field — edge lights, PAPI, MALSR, ALSF, threshold bars, taxiway lighting. Each fixture has a status; the Outage Engine classifies outages into four tiers per DAFMAN 13-204v2 Table A3.1 and detects conditions across grouped fixtures.\n\n' +
      'Click any fixture marker to inspect or report inop — the engine immediately re-evaluates the system tier and shows the outage ring (green / yellow / red / black). Reporting an outage auto-creates a discrepancy and routes it to the Electrical Light shop based on your base setup.',
    keyFeatures: [
      'DAFMAN 13-204v2 Table A3.1 outage engine — green / yellow / red / black tiers',
      'Bar-level analysis flags bar inop when 3+ fixtures in the group are down for approach light centerline bars',
      'Click any fixture to inspect or report inop — auto-creates discrepancy',
      'Lighting Status panel rolls up per-system status (PAPI, MALSR, ALSF, edge, threshold)',
      'Edit Mode: drag fixtures to correct positions, bulk-shift, box-select, place new bars',
      'Audit Mode: component-grouped review with click-to-zoom for periodic NAVAID audits',
      'Import Base Data seeds from your installation\'s standard NAVAID inventory',
      'Import Features accepts KML uploads for one-off updates',
    ],
    howToAccess: 'Sidebar › Airfield Management › Visual NAVAIDs. On mobile, More menu › Airfield Management › Visual NAVAIDs.',
    workflow: {
      title: 'Reporting a NAVAID outage',
      steps: [
        'Open Visual NAVAIDs; locate the inop fixture on the map.',
        'Click the marker.',
        'Mark inop — the engine re-evaluates the system tier and creates a discrepancy.',
        'CES sees the discrepancy in their queue with auto-routing to the Electrical Light shop.',
        'When fixed, mark the fixture operational again — system prompts to close the discrepancy.',
      ],
    },
    screenshots: [
      { src: '/training/infrastructure_1.png', caption: 'Edit Mode active — zoomed-in runway segment with edge-light fixtures rendered as blue dots, an INST sign marker, and an inline X / Save / Cancel popup for repositioning or updating fixtures.' },
      { src: '/training/infrastructure_2.png', caption: '"Outage reported · Discrepancy D-2026-CYAN created" toast above an OUTAGE EXCEEDS ALLOWABLE LIMIT panel — TWY G Mandatory Signs 1/2 out (zero-tolerance threshold), with required-actions checklist (Issue NOTAM, Notify CE Electrical) and the auto-created discrepancy assignment.' },
      { src: '/training/infrastructure_3.png', caption: 'Default map view — Visual NAVAIDs header with feature count (1,387), Lighting Status pill flagging 18 INOP, and the full airfield satellite plot with every NAVAID fixture color-coded by status.' },
    ],
    faq: [],
    relatedModules: ['discrepancies', 'ces', 'parking'],
    readMinutes: 6,
  },
  {
    id: 'waivers',
    name: 'Waivers',
    icon: FileText,
    color: 'var(--color-amber)',
    path: '/waivers',
    tagline: 'AF Form 505 lifecycle with annual review queue',
    roles: OPS_CORE,
    overview:
      'AF Form 505 lifecycle — six classifications (permanent, temporary, construction, event, extension, amendment), seven statuses (draft › pending › approved › active › completed / expired / cancelled). Track each waiver from initiation through approval and recertification. The annual-review page flags what is due each year.\n\n' +
      'KPI tiles up top quick-filter to Permanent, Temporary, Expiring (within 12 months), and Overdue Review. Map view shows geographic distribution of active waivers. Expiration date color-coding overrides classification color when within 365 days — urgency takes precedence.',
    keyFeatures: [
      'AF Form 505 lifecycle — 6 classifications, 7 statuses',
      'KPI quick-filter tiles: PERMANENT / TEMPORARY / EXPIRING / OVERDUE REVIEW',
      'Annual review queue flags what is due each year',
      'Status filter bar: All / Draft / Pending / Approved / Active / Completed / Expired / Cancelled',
      'Map view shows geographic distribution of active waivers',
      'Expiration color-coding (red ≤30d, yellow ≤90d) overrides classification color when imminent',
      'Search by waiver #, description, or proponent',
      'Excel export + PDF',
    ],
    howToAccess: 'Sidebar › Airfield Management › Waivers. On mobile, More menu › Airfield Management › Waivers.',
    workflow: {
      title: 'Filing a new waiver',
      steps: [
        'Open Waivers; click + New Waiver.',
        'Pick the classification (permanent, temporary, construction, event, extension, amendment).',
        'Fill in proponent, description, justification, and surface affected.',
        'Set the expiration (or mark permanent).',
        'Submit — the waiver enters Pending status and proceeds through approval.',
      ],
    },
    screenshots: [
      { src: '/training/waivers_1.png', caption: 'Annual Review page — year selector with KPI tiles (Active / Reviewed / Not Reviewed / To Board), then per-waiver review cards with classification pill, Reviewed status, description, and Recommendation line (Retain / Modify · Board briefed).' },
      { src: '/training/waivers_2.png', caption: 'New Waiver form — Classification dropdown expanded showing all six options (Permanent / Temporary / Construction / Event / Extension / Amendment) with one-line descriptions, then Justification field and a Criteria & Standards section with Source / Reference / Description per criterion.' },
      { src: '/training/waivers_3.png', caption: 'Main Waivers list — KPI quick-filter tiles (Permanent / Temporary / Expiring ≤12mo / Overdue Review), status filter chip strip (All / Draft / Pending / Approved / Active / Closed / Expired / Cancelled), and per-waiver rows with classification, description, location, expiry date (red when imminent), and lifecycle status.' },
    ],
    faq: [],
    relatedModules: ['obstructions', 'discrepancies'],
    readMinutes: 6,
  },
  {
    id: 'aircraft',
    name: 'Aircraft Database',
    icon: Database,
    color: 'var(--color-cyan)',
    path: '/aircraft',
    tagline: '200+ airframes — silhouettes, dimensions, ARFF CAT, ACN/PCN',
    roles: [...OPS_CORE, 'read_only'],
    overview:
      'Reference data on 200+ airframes. Silhouettes, dimensions (wingspan / length / height), and parking clearance requirements. Used by the parking module (silhouettes + clearance envelopes), and as a quick reference when fielding transient requests.\n\n' +
      'Search by aircraft type or manufacturer; sort by MTOW, wingspan, length, or height. The ACN/PCN calculator lets you compare aircraft pavement requirements against your airfield\'s PCN. Favorites persist per browser via localStorage.',
    keyFeatures: [
      '200+ airframes — military and commercial',
      'Silhouettes rendered to-scale (used by /parking)',
      'Wingspan / length / height / MTOW per airframe',
      'ACN/PCN calculator for pavement bearing comparison',
      'Search by type / manufacturer; sort by dimensions',
      'Favorites system — star frequently-used airframes (localStorage)',
      'Read-only reference (no create / edit; admins update via base setup)',
    ],
    howToAccess: 'Sidebar › Reference › Aircraft Database. On mobile, More menu › Reference › Aircraft.',
    workflow: {
      title: 'Looking up an airframe',
      steps: [
        'Open Aircraft Database.',
        'Search the type or scroll the list.',
        'Click a tile to expand specs.',
        'Use the ACN/PCN calculator if planning a transient parking spot.',
        'Star to add to favorites for quick recall.',
      ],
    },
    screenshots: [
      { src: '/training/aircraft_1.png', caption: 'Per-airframe detail (AC-130U Spooky Gunship shown) — wingspan / length / height up top, hero photo, then Turn Data (pivot, turn radius, 180° diameter, controlling gear), Weights (empty / mission T/O / max T/O / mission + max landing), and Performance (takeoff + landing distance). Pin and ACN/PCN tabs.' },
      { src: '/training/aircraft_2.png', caption: 'Aircraft Database list — 211 airframes total (127 military · 84 commercial), tabbed split between Military / Commercial / All, search bar, and per-airframe rows showing FAA ADG group + wingspan.' },
    ],
    faq: [],
    relatedModules: ['parking', 'airfield-status'],
    readMinutes: 3,
  },
  {
    id: 'regulations',
    name: 'Reference Library',
    icon: BookOpen,
    color: 'var(--color-cyan)',
    path: '/regulations',
    tagline: '70+ DAFMAN, UFC, AFMAN, and AF Form references',
    roles: [...OPS_CORE, 'ces', 'majcom_rfm', 'ppr', 'read_only'],
    overview:
      'Searchable PDF library of 70+ DAFMAN, UFC, AFMAN, and AF Form documents that govern airfield management. The IAW Compliance callouts elsewhere in the app point you back to specific paragraphs here. Full-text search works across PDF content + titles (search all regulations at once).\n\n' +
      'Two tabs: References (curated regulatory library) and My Documents (user uploads — local procedures, wing guidance). Filter by category (DAFMAN / UFC / AFMAN / AF Form) or favorites only. PDF viewer opens inline for quick lookups.',
    keyFeatures: [
      '70+ regulations: DAFMAN 13-204, UFC 3-260-01, AFMAN 91-203, etc.',
      'Full-text search across PDF content + titles',
      'IAW Compliance callouts elsewhere link back to specific paragraphs',
      'Tabs: References (curated) + My Documents (user uploads)',
      'Filter by Category (DAFMAN / UFC / AFMAN / AF Form), Pub Type, Favorites',
      'In-app PDF viewer (lazy-loaded, no download required)',
      'My Documents allows uploads of local procedures + wing guidance',
      'Favorites persist via localStorage',
    ],
    howToAccess: 'Sidebar › Reference › Reference Library. On mobile, More menu › Reference › Reference Library.',
    workflow: {
      title: 'Looking up a regulatory paragraph',
      steps: [
        'Open Reference Library.',
        'Search the regulation number or topic.',
        'Click the matching reg to open the in-app PDF viewer.',
        'Navigate to the paragraph (the search highlights matches).',
        'Star to add to favorites for quick recall.',
      ],
    },
    screenshots: [
      { src: '/training/regulations_1.png', caption: 'References tab — 70 references with Filters / Favorites / Category / Pub Type controls. Per-reference cards show title, category tags (Safety & Mishap Prevention / Airfield Design & Planning / etc.), publication type, and effective edition.' },
      { src: '/training/regulations_2.png', caption: 'In-app PDF viewer with the regulation full text rendered (DAFMAN 13-204 Vol. 2 shown) — Back / New Tab / External actions plus PDF page controls. Opens any reference without leaving Glidepath.' },
    ],
    faq: [],
    relatedModules: ['aircraft'],
    readMinutes: 4,
  },
  {
    id: 'notams',
    name: 'NOTAMs',
    icon: AlertCircle,
    color: 'var(--color-amber)',
    path: '/notams',
    tagline: 'Live FAA feed with expiration tracking',
    roles: [...OPS_CORE, 'read_only'],
    overview:
      'Live FAA feed of NOTAMs for your ICAO. Filter by status (Active / Expired) or free text. The red dot on the sidebar fires when one or more NOTAMs are within their expiration window (24h warning).\n\n' +
      'Effective dates render in compact Zulu format. Expiring-within-24h NOTAMs get a red AlertCircle glow so they\'re unmissable. PDF + Email export the current filtered view.',
    keyFeatures: [
      'Live FAA NOTAM feed by ICAO (auto-refreshable)',
      'Filter by status (Active / Expired) or free text search',
      'Expiration warning glow within 24h window',
      'Sidebar red dot fires while any NOTAM is within expiration window',
      'Compact Zulu effective-date format (e.g., "Today 1430Z")',
      'PDF + Email export of current filtered view',
    ],
    howToAccess: 'Sidebar › Reference › NOTAMs. On mobile, More menu › Reference › NOTAMs.',
    workflow: {
      title: 'Reviewing today\'s NOTAMs',
      steps: [
        'Open NOTAMs.',
        'Confirm the ICAO is your airfield (pre-filled from base config).',
        'Click Refresh to pull the latest FAA feed.',
        'Scan the Active filter for new or expiring entries.',
        'Export the current view via PDF or Email for the daily brief.',
      ],
    },
    screenshots: [
      { src: '/training/notams_1.png', caption: 'NOTAMs page — FAA Feed for the configured ICAO with All / FAA / LOCAL / Active / Expired filter chips. NOTAM cards in a two-column grid with badges (FAA / MILITARY / SAFETY / ACTIVE), display ID, effective window in Zulu, and an EXPIRING SOON tag with red highlight when within the warning window. Export PDF available top-right.' },
    ],
    faq: [],
    relatedModules: ['airfield-status', 'waivers'],
    readMinutes: 4,
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    icon: BarChart3,
    color: 'var(--color-cyan)',
    path: '/reports',
    tagline: 'Five canned reports + 30-day analytics dashboard',
    roles: OPS_AND_OVERSIGHT,
    overview:
      'Five canned report categories — Daily Operations Summary, Discrepancy Trends, Aging Discrepancies, Discrepancy Detail Export, and Lighting Outage. PDFs and Excel exports are generated client-side; nothing leaves your installation.\n\n' +
      'The Analytics dashboard on the hub aggregates 30-day KPIs across every module: inspection completion rates, check volume, discrepancy pipeline (open + opened-vs-closed + avg days to close), QRC activations, personnel, obstructions, parking, wildlife strikes + sightings, customer feedback ratings.',
    keyFeatures: [
      'Five report subroutes — Daily / Trends / Aging / Discrepancies / Lighting',
      'Each report has its own date range + filter set',
      'PDF + Excel export client-side (no third-party data leak)',
      'Analytics dashboard with 30-day KPIs across every module',
      'Time-frame selector: 7d / 30d / 90d / 6mo / 1yr / Custom',
      'KPI tiles drill into source modules where relevant',
      'Email PDF via Resend pipeline for shift handoff distribution',
    ],
    howToAccess: 'Sidebar › Reports & Analytics. On mobile, More menu › Reports.',
    workflow: {
      title: 'Generating the daily ops summary',
      steps: [
        'Open Reports & Analytics.',
        'Click the Daily Operations Summary card.',
        'Set the date range.',
        'Click Generate PDF.',
        'Email it from the modal or download for records management.',
      ],
    },
    screenshots: [
      { src: '/training/reports_1.png', caption: 'Reports & Analytics hub — five report cards (Daily Operations Summary, Discrepancy Report, Discrepancy Trends, Aging Discrepancies, Airfield Lighting Report) above an Analytics dashboard with 7d / 30d / 90d / 6mo / 1yr / Custom period selector. KPI tiles cover Inspections / Checks / Discrepancies / QRC / Personnel / Obstructions / Parking / Wildlife / Feedback.' },
      { src: '/training/reports_2.png', caption: 'Daily Airfield Operations Summary PDF preview — base header, generated-by + Zulu timestamp, then sections for Airfield & Lighting Inspections, Visual NAVAID Outages, ARFF Status Changes, Completed Checks, New Discrepancies, Discrepancy Updates, Obstruction Evaluations, and QRC Executions.' },
    ],
    faq: [],
    relatedModules: ['activity', 'discrepancies', 'wildlife', 'infrastructure'],
    readMinutes: 5,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    color: 'var(--color-cyan)',
    path: '/settings',
    tagline: 'Profile, theme, installation switcher, offline cache',
    roles: ALL_ROLES,
    overview:
      'Per-user profile, theme (Day / Night / Auto), operating initials (used in audit-trail signatures), and default PDF email address. The installation switcher lets system administrators move between bases that they have membership at.\n\n' +
      'The Offline section configures regulation library caching (IndexedDB, ~70 PDFs, favorites-first toggle) and map-tile precaching (Workbox service worker for satellite imagery in your base area). About surfaces the Glidepath version + environment + a contact link.',
    keyFeatures: [
      'Profile: name (read-only), role badge, operating initials (4 chars max), default PDF email',
      'Installation switcher (when you have membership at multiple bases)',
      'Theme: Day / Night / Auto',
      'Regulation library offline cache (IndexedDB, favorites-first option)',
      'Map tile precaching for offline access to your base area',
      'About: Glidepath version, environment, support contact',
      'Sign Out lives in the sidebar footer, not here',
    ],
    howToAccess: 'Sidebar › Settings (always pinned at the bottom of the nav list). On mobile, More menu › Settings.',
    workflow: {
      title: 'Setting your operating initials',
      steps: [
        'Open Settings.',
        'Find the Profile section.',
        'Set Operating Initials (max 4 chars; appears in audit-trail signatures).',
        'Click Save.',
      ],
    },
    screenshots: [
      { src: '/training/settings_1.png', caption: 'Data & Storage section — Estimated Storage Used (660.7 MB of ~10.9 GB available), Regulation PDFs cache size, Map Tile Cache with Cache Map Tiles button (pre-downloads satellite tiles for your base area), and a Regulations Library "Cached for offline use" counter with Cache All / Clear Cache.' },
      { src: '/training/settings_2.png', caption: 'Full Settings page — Profile block (rank+name, installation, role pill, operating initials, default PDF email), then Installation / Data & Storage / Regulations Library accordions, Appearance theme picker (Day / Night / Auto), and About section showing Version, Environment, Website, Support — Sign Out lives at the bottom.' },
    ],
    faq: [],
    relatedModules: ['users', 'regulations'],
    readMinutes: 3,
  },
  {
    id: 'users',
    name: 'User Management',
    icon: UserCog,
    color: 'var(--color-cyan)',
    path: '/users',
    tagline: 'Invite, edit, role assignment, per-user permission overrides',
    roles: ['sys_admin', 'base_admin'],
    overview:
      'Invite, edit, and remove users; assign roles from the permission matrix; grant per-user permission overrides for the rare case a member needs more or less than their role preset gives them. Invitations send a branded email via Resend with a setup-account link.\n\n' +
      'Status states are pending (awaiting email verification or admin approval) › active › deactivated (soft delete, can be reactivated). System administrators see all users; base administrators see only their installation. Sign-up requests come in as pending and need an admin to approve.',
    keyFeatures: [
      'Invite users via email — sets pending status',
      'Role assignment from the permission matrix (12 roles, ~86 permission keys)',
      'Per-user permission overrides for fine-grained adjustments',
      'Status: pending › active › deactivated (soft delete, reactivatable)',
      'System admins see all users; base admins see their installation only',
      'Self-signup requests show as pending for admin approval',
      'Name, Operating initials, rank, and EDIPI capture for audit-trail signatures',
      'Per-user password reset (admin-triggered)',
    ],
    howToAccess: 'Sidebar › Admin › Users (admin role required). On mobile, More menu › Admin › Users.',
    workflow: {
      title: 'Inviting a new user',
      steps: [
        'Open Users.',
        'Click + Invite User.',
        'Fill in name, email, rank, role.',
        'Submit — invitation email sends; status is pending.',
        'User clicks the email link, sets a password, and lands as active.',
      ],
    },
    screenshots: [
      { src: '/training/users_1.png', caption: 'Invite User modal — Email / Rank / First Name / Last Name fields plus a Role dropdown showing all twelve role options (Airfield Manager, NAMO, AMOPS, CES, Safety, ATC, Read Only, Base Admin, System Admin, PPR, Airfield Status, MAJCOM / RFM).' },
      { src: '/training/users_2.png', caption: 'User list — per-user rows with role pill (Read Only / AFM / Base Admin / etc.) and status pill (ACTIVE green / PENDING amber / DEACTIVATED red), installation, and "Last Seen Xd ago" attribution.' },
    ],
    faq: [],
    relatedModules: ['settings'],
    readMinutes: 4,
  },
  {
    id: 'feedback',
    name: 'Customer Feedback',
    icon: MessageSquare,
    color: 'var(--color-cyan)',
    path: '/feedback',
    tagline: 'Review inbox for the public QR feedback form',
    roles: OPS_CORE,
    overview:
      'Inbox for the public QR-code feedback form (configured in Base Setup › Customer Feedback Form). Review submissions, reply, and route to the right module owner. The QR code is designed for posting at base ops or transient parking so anyone can scan and submit feedback without a login.\n\n' +
      'Form fields are customizable per base — free-form comment + 1-5 star rating + any custom fields you configure. Stats cards aggregate submissions and average rating; rating colors green for 4-5★, amber for 3★, red for 1-2★.',
    keyFeatures: [
      'Public QR-code form at /feedback/[baseId] — no login required',
      'Form field schema customizable per base in Base Setup › Customer Feedback Form',
      '1-5 star rating + free-form comment + custom field responses',
      'Stats cards: submissions, average rating, distribution histogram',
      'Time filters (7d / 30d / All) + PDF / Email export',
      'Rating semantic color: green (4-5★), amber (3★), red (1-2★)',
      'Per-rating color rail on each row for at-a-glance scanning',
      'Delete gated on a separate permission for audit-trail integrity',
    ],
    howToAccess: 'Sidebar › Operations › Customer Feedback. On mobile, More menu › Operations › Customer Feedback.',
    workflow: {
      title: 'Triaging incoming feedback',
      steps: [
        'Open Customer Feedback.',
        'Skim the time filter (default 7d) for new submissions.',
        'Read each row inline — comment, rating, and any custom-field responses surface on the row itself.',
        'Reply via your normal email if a contact email was provided.',
        'Export the monthly PDF for command-level rollup.',
      ],
    },
    screenshots: [
      { src: '/training/feedback_1.png', caption: 'Customer Feedback inbox — Submissions / Avg Rating / Distribution stats up top with 7 Days / 30 Days / All time filters and Export PDF + Email PDF actions. Per-row entries surface rank + name + unit, star rating (semantic color), full comment, structured responses (Reason for visit, Would you recommend this airfield?, Any services we should add or improve?), date + Zulu time, and contact email — everything renders inline; no detail view needed.' },
    ],
    faq: [],
    relatedModules: ['reports', 'settings'],
    readMinutes: 3,
  },
  {
    id: 'amtr',
    name: 'Training Records (AMTR)',
    icon: GraduationCap,
    color: 'var(--color-purple)',
    path: '/amtr',
    tagline: 'Digital airfield-management training record — 623A, 1098, 803, JQS, RAT',
    roles: OPS_CORE,
    appliesTo: ['usaf'],
    overview:
      'The Airfield Management Training Record — a fully digital AF training folder that replaces the standalone AFFSA training-record workbook. Each airfield-management member gets one electronic record spanning AF Forms 623A, 797, 803, and 1098, the JQS/CFETP task list, Ready Airman Training, qualifications, and formal training, with role-based signatures and due-date tracking.\n\n' +
      'The roster auto-populates airfield-management personnel only (Airfield Manager, NAMO, Base Admin, AMOPS) and leaves read-only / CES / other base members off. Completing a source task drafts the matching AF 623A narrative automatically through a trainee → trainer → certifier → AFM sign-off flow, and the per-year 1098 catalog can be locked and archived as each training year closes.',
    keyFeatures: [
      'One member record with tabs for Cover, Qualifications, Formal Training, JQS-CFETP, DAF 797, DAF 803, DAF 623A, Milestones, DAF 1098, RAT, Files, References, and History',
      'Roster auto-populates airfield-management personnel only (Airfield Manager, NAMO, Base Admin, AMOPS); read-only, CES, and other members are not auto-rostered',
      'Auto-623A — signing a 1098, JQS, 797, 803, or milestone task drafts the matching AF 623A narrative through a trainee → trainer → certifier → AFM flow',
      'Twelve DAFMAN 13-204v2 comment templates for consistent, compliant 623A narrative entries',
      'Per-year 1098 catalog with archive — lock a training year read-only; a new year clones the prior year\'s task list',
      'Bulk Transcribe — stamp initials and completion dates across many JQS / 1098 / 797 / 803 rows from an imported paper record in one pass',
      'Import / export round-trip with the standard HAF/AFFSA training-record .xlsx (Cover, Qualifications, JQS, 1098, 797, 623A, 803, RAT, Milestones)',
      'Files tab — attach supporting documents (PDF / JPG / PNG / Excel / Word, up to 25 MB each) with Document Title and Document Date metadata',
      'Built-in Training Records self-inspection — a 36-item checklist (DAFI 36-2670 / DAFMAN 36-2689 / DAFMAN 13-204v2) with auto-keyed findings',
      'Roster KPIs: Members, Compliance %, Recurring Items, Complete, Due Soon, Overdue',
    ],
    howToAccess:
      'Sidebar › Airfield Management › Training Records. USAF airfields only; gated by amtr:view (Airfield Manager, NAMO, AMOPS, Base Admin, and system administrators). A member with no app permission can still view their own record after sign-in.',
    workflow: {
      title: 'Documenting a completed 1098 task',
      steps: [
        'On the member\'s 1098 tab, record the completed task — name, completion date, and any hours or score.',
        'Sign the 1098 row as the trainer; the Auto-623A dialog opens with the task source and a comment block (insert a DAFMAN template if you want standard language).',
        'Fill the comment and choose whether a certifier is required — signing locks the trainer block.',
        'If a certifier is required, they reopen the row, see the trainer comment read-only, add their own, and sign the certifier block.',
        'Optionally open the auto-generated entry on the 623A tab and add the AFM endorsement (the AFM block is always signed manually).',
        'Check the roster — compliance KPIs and the member record reflect the new entry.',
      ],
    },
    faq: [],
    relatedModules: ['users', 'regulations', 'activity'],
    readMinutes: 8,
  },
  {
    id: 'records-export',
    name: 'Records Export',
    icon: Download,
    color: 'var(--color-cyan)',
    path: '/settings/exports',
    tagline: 'One-click records-disposition export — PDFs, Excel, photos, and an offline viewer in one ZIP',
    roles: OPS_CORE,
    overview:
      'Records Export packages your airfield\'s records into a single organized ZIP for Air Force records disposition or migration. Everything is generated in your browser, so record data never leaves the device — the download is one self-contained archive.\n\n' +
      'Pick a time range, choose which output kinds and modules to include, and generate. A tamper-evident START-HERE cover sheet and a SHA-256 manifest travel with the export so a recipient can verify nothing was altered, and the bundled offline viewer opens the records on any computer with no internet or login.',
    keyFeatures: [
      'Export all-time or a date range, with This Month / Last Month / This Quarter / This FY quick-picks',
      'Five optional output kinds — formatted PDF documents, Excel workbooks, photos, an offline interactive viewer, and raw JSON',
      'Per-module selection covering Waivers, ACSI, Discrepancies, Inspections, Checks, Obstructions, Events Log, Daily Reviews, Wildlife, PPR, Personnel, and SCN (plus SMS / AEP / §139.303 Training on civilian bases)',
      'Browser-only generation — record data never leaves the device; the download is a single ZIP',
      'Tamper-evident 00-START-HERE.pdf cover and manifest.json carrying per-module record counts and a SHA-256 hash of every file',
      'Photos download in-browser with retry; any failures are logged on the manifest and never abort the export',
      'Offline interactive viewer with searchable, sortable tables that opens from a USB stick on any computer or phone',
      'AMTR training records are exported from the AMTR module itself, not here',
    ],
    howToAccess:
      'Sidebar › Settings (gear) › Records Export section › Open Records Export. It is not a top-level nav item; access is gated by exports:read (system and base administrators).',
    workflow: {
      title: 'Producing a records export',
      steps: [
        'Open Settings and click Open Records Export under the Records Export section.',
        'Choose the period — All time, or a date range with an optional quick-pick (This Month / Last Month / This Quarter / This FY).',
        'Toggle the output kinds (PDF / Excel / Photos / Viewer / JSON) and check the modules to include.',
        'Click Generate Export; the app builds the files in-browser, hashes them into the manifest, and downloads one ZIP.',
      ],
    },
    faq: [],
    relatedModules: ['settings', 'daily-reviews', 'activity'],
    readMinutes: 5,
  },
  {
    id: 'sms',
    name: 'Safety Management System',
    icon: ShieldAlert,
    color: 'var(--color-purple)',
    path: '/sms',
    tagline: 'FAA Part 139 Safety Management System — policy, hazards, SPIs, change control',
    roles: OPS_AND_SAFETY,
    appliesTo: ['faa_part139'],
    overview:
      'A Safety Management System per 14 CFR §139.401–415 and AC 150/5200-37A, implementing all four pillars — Safety Policy, Safety Risk Management, Safety Assurance, and Safety Promotion. The Accountable Executive dashboard summarizes each pillar at a glance.\n\n' +
      'The hazard register scores every hazard on a 5×5 risk matrix and tracks mitigations to closure; Safety Performance Indicators recompute nightly against targets and alert thresholds; Management of Change routes operational changes through an AE approval gate; and an anonymous public reporting form feeds a triage queue that promotes reports into hazards.',
    keyFeatures: [
      'Accountable Executive dashboard — four cards, one per AC 150/5200-37A pillar (Policy, SRM, Safety Assurance, Promotion)',
      'Hazard register with a 5×5 risk matrix — current and residual risk bands, mitigations, and status (open → under-review → controlled → closed)',
      'Safety Performance Indicators (SPIs) with targets, alert thresholds, and 12-month trend sparklines, recomputed nightly',
      'Internal SMS audits (annual internal / external / self-assessment) with findings and a scheduled → in-progress → completed → closed lifecycle',
      'Management of Change — operational, organizational, equipment, and procedural changes with a risk-analysis summary and an AE approve / reject gate',
      'AE-signed Safety Policy with versioning, annual review, and a non-retribution reporting pledge',
      'Anonymous public safety reporting at /<icao>/sms-report — reporter contact is visible to triagers only; the queue promotes reports into hazards',
      'One-click SMS Manual PDF combining policy, hazards, SPIs, audits, MoC, and reports for FAA certification inspector visits',
    ],
    howToAccess:
      'Sidebar › Safety Management System (its own section) › Safety Policy / Hazard Register / Safety Indicators / SMS Audits / Management of Change / Safety Reports. Civilian FAA Part 139 bases only. Public report form at /<icao>/sms-report.',
    workflow: {
      title: 'Working a hazard through the register',
      steps: [
        'Capture a hazard with Add Hazard — a title and description, optionally linked from a WHMP finding, discrepancy, inspection, audit, or safety report.',
        'On the hazard detail, score likelihood and severity on the 5×5 matrix to derive the risk band, then add mitigations with owners and target dates.',
        'Move the status as work progresses: open → under-review → controlled → closed.',
        'Route any operational change through Management of Change — complete the risk analysis and request AE approval.',
        'Triage anonymous public reports in Safety Reports, promoting real issues into the hazard register.',
        'Run the annual internal audit and review the Safety Policy; download the SMS Manual PDF for an inspector visit.',
      ],
    },
    faq: [],
    relatedModules: ['whmp', 'aep', 'discrepancies'],
    readMinutes: 8,
  },
  {
    id: 'training-part139',
    name: 'Training (§139.303)',
    icon: GraduationCap,
    color: 'var(--color-purple)',
    path: '/training',
    tagline: '14 CFR §139.303 personnel training currency for Part 139 airports',
    roles: OPS_CORE,
    appliesTo: ['faa_part139'],
    overview:
      '§139.303 training records for civilian Part 139 airports — the 13 mandatory §139.303(e) topics seeded on every base, per-user records with FAA\'s 24-month retention, and a compliance matrix built for inspector review. (This is the civilian training module at /training, distinct from the Glidepath Help & Training guide you are reading now.)\n\n' +
      'Records carry automatic expiry, renewal chains link each recurrent completion to the one it supersedes, and a daily digest emails each user the topics expiring within 30 days. Professional AAAE / ACE certificates are tracked alongside the regulatory topics.',
    keyFeatures: [
      'The 13 §139.303(e) topics seeded on every civilian base as immutable system topics, plus base-specific custom topics',
      'Per-user training records (initial / recurrent / remedial) with auto-calculated expiry and 24-month retention',
      'Compliance matrix — a users × topics grid color-coded current / expiring / expired / not-started, with CSV export for inspections',
      'Training roster with per-user current / expiring / expired / not-started counts and last-trained date',
      'AAAE / ACE professional certificates (AAAE-CM, ACE-Ops / Comm / Sec / WHC) with issue and expiry dates and PDF links',
      'Renewal chains link each recurrent completion to the record it supersedes for full history',
      '30-day expiry email digest — one daily email per user listing topics expiring within 30 days',
      'Per-user PDF training transcript and CSV compliance export for FAA or state auditors',
    ],
    howToAccess:
      'Sidebar › Training & Compliance › Training Topics / Training Roster / Compliance Matrix. Civilian FAA Part 139 bases only.',
    workflow: {
      title: 'Recording and tracking a member\'s training',
      steps: [
        'Review the 13 seeded topics under Training Topics; clone one to a base-specific override or add a custom topic if needed.',
        'Open a member from the roster, switch to Records, and Log a completion — date, type (initial / recurrent / remedial), instructor, evidence, notes.',
        'Watch currency on the roster and compliance matrix: current (green), expiring (amber), expired (red), not-started (grey).',
        'When something is due, log a recurrent completion — it becomes the latest record and links to the prior one in the renewal chain.',
        'Export the compliance matrix CSV for an FAA inspection, or a per-user PDF transcript for the member\'s file.',
      ],
    },
    faq: [],
    relatedModules: ['sms', 'aep'],
    readMinutes: 6,
  },
  {
    id: 'aep',
    name: 'Airport Emergency Plan',
    icon: Siren,
    color: 'var(--color-danger)',
    path: '/aep',
    tagline: 'FAA Part 139 Airport Emergency Plan — plan, agencies, comms checks, drills',
    roles: OPS_CORE,
    appliesTo: ['faa_part139'],
    overview:
      'The Airport Emergency Plan per 14 CFR §139.325 and AC 150/5200-31C — a versioned plan document with FAA acceptance tracking and an annual Accountable Executive sign-off. On civilian Part 139 bases it replaces the USAF Secondary Crash Net module.\n\n' +
      'Around the plan it keeps a role-grouped response-agency roster, a monthly communications check against those agencies, and a drill program covering the triennial full-scale exercise and the annual tabletop/functional drills. Completed drills and comms checks feed the SMS Safety Performance Indicators nightly.',
    keyFeatures: [
      'Versioned AEP document with FAA acceptance tracking — one active plan per base, superseded versions retained',
      'Annual AE sign-off satisfying §139.325(d), with a review-notes field',
      'Response-agency roster (ARFF, EMS, mutual aid, other) with primary and backup contacts (phone / radio), grouped by role',
      'Monthly comms checks — per-agency loud-clear / no-response / out-of-service / not-reached, with a required note on OOS, and 12-month history',
      'Drill program — triennial full-scale (§139.325(h)) plus at least one annual tabletop / functional drill (§139.325(j)), with attendance, after-action notes, findings, and AAR upload',
      'Dashboard cards — plan status, full-scale-due, this month\'s comms check, and agency count',
      'Completed full-scale drills and comms checks feed the SMS Safety Performance Indicators nightly',
    ],
    howToAccess:
      'Sidebar › Airport Emergency Plan › AEP Document / Response Agencies / AEP Comms Checks / AEP Drills. Civilian FAA Part 139 bases only (replaces the Secondary Crash Net).',
    workflow: {
      title: 'Logging a monthly comms check',
      steps: [
        'Open AEP Comms Checks and click Run Check.',
        'For each agency, mark loud-clear / no-response / out-of-service / not-reached; OOS requires a note.',
        'Log the check — it appears on this month\'s card and in the 12-month history and feeds the SMS SPI.',
        'Separately, keep the plan current under AEP Document (upload a new version, record FAA acceptance, sign the annual review) and run drills under AEP Drills.',
      ],
    },
    faq: [],
    relatedModules: ['sms', 'qrc', 'field-conditions'],
    readMinutes: 6,
  },
  {
    id: 'field-conditions',
    name: 'Field Conditions / TALPA',
    icon: Snowflake,
    color: 'var(--color-cyan)',
    path: '/field-conditions',
    tagline: 'Per-third RwyCC assessment with automatic FICON NOTAM generation',
    roles: OPS_CORE,
    appliesTo: ['faa_part139'],
    overview:
      'Runway condition assessment per AC 150/5200-30D for civilian Part 139 airports. You assess each runway third — touchdown, midpoint, rollout — by contaminant type, depth, and temperature, and the engine derives the Runway Condition Code (RwyCC 6–0) from Table 4-1.\n\n' +
      'From those thirds it builds a FICON NOTAM body ready to paste straight into FAA NOTAM Manager, auto-copied to the clipboard on save. An operator can override a derived RwyCC with a required reason, and a 30-day rolling history keeps every report with its full FICON text for audit.',
    keyFeatures: [
      'Per-third Runway Condition Code (RwyCC 6–0) derived per AC 150/5200-30D Table 4-1 from contaminant, depth, and temperature',
      '13 contaminant types (dry, wet, frost, slush, dry / wet / compacted snow, ice, ice patches, wet ice, and more) and 6 treatments (plowed, swept, broomed, sanded, chemically treated, de-iced)',
      'Automatic FICON NOTAM text builder ready to paste into FAA NOTAM Manager; auto-copied to the clipboard on save',
      'RwyCC override (0–6) with a required reason; the log shows "derived X → override Y" with the reason',
      'Coverage %, depth, and temperature captured per runway third',
      'Active report shows issued time (Zulu), operator initials, valid-until, and hours remaining',
      'No active report presumes a dry runway (6/6/6)',
      '30-day rolling history grouped by Zulu date with the full FICON text for audit',
    ],
    howToAccess:
      'Sidebar › Daily Operations › Field Conditions. Civilian FAA Part 139 bases only.',
    workflow: {
      title: 'Issuing a field condition report',
      steps: [
        'Open Field Conditions and click + New Report (or Issue Report on a runway card).',
        'For each third — touchdown, midpoint, rollout — pick the contaminant, enter depth, coverage %, and temperature; the live preview shows the derived RwyCC.',
        'Override a third\'s RwyCC with a required reason only if manual judgment differs from the table.',
        'Select the treatments applied and add any notes.',
        'Click Issue Report — the FICON NOTAM body is auto-copied; paste it into FAA NOTAM Manager.',
      ],
    },
    faq: [],
    relatedModules: ['notams', 'infrastructure', 'aep'],
    readMinutes: 6,
  },
  {
    id: 'whmp',
    name: 'Wildlife Hazard Management Plan',
    icon: Bird,
    color: 'var(--color-amber)',
    path: '/wildlife/whmp',
    tagline: 'Annual Wildlife Hazard Management Plan per 14 CFR §139.337',
    roles: OPS_AND_SAFETY,
    appliesTo: ['faa_part139'],
    overview:
      'The annual Wildlife Hazard Management Plan per 14 CFR §139.337 for civilian Part 139 airports — a versioned assessment with FAA acceptance tracking and an Accountable Executive annual sign-off, plus a hazardous-species register and a mitigation summary.\n\n' +
      'Findings promote into the SMS hazard register in one click, and the existing Wildlife module\'s sighting and strike data feeds the annual assessment narrative. A countdown flags when the next annual review is due.',
    keyFeatures: [
      'One active annual assessment per base per year; in-year revisions supersede via a retained chain',
      'FAA acceptance tracking (date + reference code) and AE annual sign-off with a countdown to the next review (§139.337(c))',
      'Hazardous-species register — species, hazard level (low / medium / high / severe), attractants, and mitigations',
      'Findings with a category (habitat / population / reporting / training / infrastructure / other) and recommended actions',
      'One-click Promote to SMS Hazard prefills the SMS hazard form; Mark Linked backfills the hazard ID onto the finding',
      'Mitigation summary narrative of the airport-wide control approach',
      'WHMP document upload for the full assessment PDF',
      'Prior-year history grouped by assessment year with performer, species count, and findings count',
    ],
    howToAccess:
      'Sidebar › Daily Operations › Wildlife / WHMP. Civilian FAA Part 139 bases only; it sits beside the Wildlife module whose sighting and strike data feeds the assessment.',
    workflow: {
      title: 'Filing the annual assessment',
      steps: [
        'Click + New Year (or Amend / Supersede on an existing one) and enter the year, performed date, performer, FAA acceptance metadata, and the WHMP PDF.',
        'Add hazardous species — name, hazard level, attractants, and mitigations.',
        'Add findings — narrative, category, and recommended action — and write the mitigation summary.',
        'File the assessment; for each finding, Promote to SMS Hazard, complete the SMS risk assessment, then Mark Linked with the hazard ID.',
        'Once a year, record the annual review to stamp the AE sign-off and reset the 12-month countdown.',
      ],
    },
    faq: [],
    relatedModules: ['wildlife', 'sms'],
    readMinutes: 6,
  },
]

/**
 * True when a guide applies to the given airport_type. A guide without
 * `appliesTo` applies to both modes (default). Null/undefined airport type
 * fails open (returns true) so an unknown base still sees every guide.
 */
export function moduleRefAppliesToAirport(
  m: ModuleRef,
  airportType: AirportType | null | undefined,
): boolean {
  if (!m.appliesTo) return true
  if (!airportType) return true
  return m.appliesTo.includes(airportType)
}
