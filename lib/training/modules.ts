import type { LucideIcon } from 'lucide-react'
import {
  Home, Zap, LayoutDashboard, Activity, History, ListChecks, ClipboardCheck,
  ClipboardList, ShieldCheck, ClipboardSignature, AlertTriangle, HardHat,
  PlaneLanding, Bird, Users, Radio, Plane, MapPin, Lightbulb, FileText,
  Database, BookOpen, AlertCircle, BarChart3, Settings, UserCog,
  MessageSquare,
} from 'lucide-react'

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
  id: string                // url slug for /training/[module-id]
  name: string
  icon: LucideIcon
  color: string             // CSS var or hex used for the module accent
  path: string              // sidebar destination (where the actual module lives)
  tagline: string
  roles: TrainingRole[]     // role chip filter
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
    tagline: 'Real-time situational awareness for the runway and field',
    roles: [...OPS_CORE, 'safety', 'ppr', 'read_only'],
    overview:
      'Glidepath\'s landing page and the single screen most users keep open all shift. Combines live weather, runway open/closed status, NAVAID outage indicators, ARFF readiness, advisory alerts, and an at-a-glance count of contractors currently on the field.\n\n' +
      'Edits are inline — set runway labels, change a NAVAID color, toggle AFM Out-of-Office — and every change auto-logs to the Events Log so the AF Form 3616 audit trail builds itself. The page subscribes to Supabase realtime so what one shift changes shows up on every other open browser within a second.',
    keyFeatures: [
      'Live weather + runway selector with editable status labels',
      'NAVAID grid color-coded green / yellow / red; reporting red auto-creates a discrepancy + routes to the Electrical Light shop',
      'ARFF readiness panel with CAT dropdown (when configured)',
      'Advisory + WWA Notification strip (WATCH / WARNING / ADVISORY) for active alerts',
      'AFM Out-of-Office and Closed-for-Day toggles (DAFMAN 13-204 §2.5.2)',
      'Custom status boards configurable per base in Base Setup',
      'Personnel-on-Airfield mini-table (full management on /contractors)',
      'PPR grid surfaces transient aircraft inbound today',
      'Realtime updates — no manual refresh needed',
    ],
    howToAccess: 'Sidebar › Home (/) or mobile bottom-nav Home tab. Glidepath\'s default landing route after sign-in.',
    workflow: {
      title: 'Daily airfield update',
      steps: [
        'Open Glidepath — the Airfield Status page is your default landing.',
        'Scan weather + active runway + advisory strip for anything new since last shift.',
        'Set or change runway status labels if conditions changed (auto-logs to Events Log).',
        'Mark any NAVAID red — confirm the auto-discrepancy creation prompt.',
        'Verify ARFF readiness reflects current CAT.',
        'Toggle AFM Out-of-Office if leaving the office; toggle off when back.',
      ],
    },
    screenshots: [],
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
    tagline: 'KPI hub + AFM administrative controls',
    roles: OPS_CORE,
    overview:
      'A shift-focused operational view with KPI tiles, quick-launch actions, and the AFM Out-of-Office / Closed-for-Day controls. Open at the start of every shift to see what is open, what is overdue, and where the day stands.\n\n' +
      'The KPI strip shows today\'s airfield + lighting inspection state, the daily-review pending count, the last completed check, and any open discrepancies awaiting verification. Quick-launch buttons jump straight into starting a check, opening a QRC, adding a contractor, or beginning the shift checklist.',
    keyFeatures: [
      'Inspection cadence summary — today\'s airfield + lighting status with in-progress / completed states',
      'Last completed check type + Zulu timestamp for quick handoff context',
      'Open-discrepancies count + awaiting-verification badge',
      'AFM Out-of-Office and Closed-for-Day toggles with message customization',
      'Quick-launch buttons for Contractor add, Shift Checklist, QRC',
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
        'Use the quick-launch buttons to begin your own shift checklist or start a check.',
      ],
    },
    screenshots: [],
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
      'Rolling log of every airfield action — status changes, NOTAMs, inspections, sign-offs, manual entries. This is the AF Form 3616 substitute (T-3 waiver on file with HQ AFCEC). Entries are immutable; the audit trail captures who did what and when.\n\n' +
      'Most rows are auto-logged by the system as you work. Manual entries are templated for common operational events (Tower Reporting, AMOPS Reporting, Inspections / Checks notes, etc.) so the right category surfaces on the report PDF. Filter by date, type, or actor; search across actor / action / entity / notes.',
    keyFeatures: [
      'Immutable audit trail — no edit / delete (DAFMAN 13-204v2 §2.5)',
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
    screenshots: [],
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
      'Same underlying data as the Events Log, but reorganised by actor instead of chronology. Useful for shift handoff oversight and answering "who worked what in the last shift." Each user gets their own card with all of their actions in the visible window.\n\n' +
      'Defaults to the last 7 days. Filter by user, entity type, or action type; search free text in the action details. No edit or delete (it\'s a view onto the same immutable audit trail).',
    keyFeatures: [
      'User-grouped cards (rank + name header, then all of their actions below)',
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
        'Scan each user\'s card to see what was completed and what was opened.',
        'Click any entity link to jump into the source record for follow-up.',
      ],
    },
    screenshots: [],
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
    tagline: 'Step-by-step emergency response with full audit trail',
    roles: OPS_CORE,
    overview:
      '25 emergency and contingency checklists from AFMAN 91-203 — aircraft mishap, hung ordnance, fuel spill, severe weather, and more. The engine walks the responder through each step in order; every acknowledgement is stamped with who did it and when so the after-action review writes itself.\n\n' +
      'Active QRCs persist across shift changes — start a checklist on day shift and mid shift can pick up exactly where you left off. The sidebar fires a red dot whenever a QRC is open so handoffs never miss an in-progress emergency response.',
    keyFeatures: [
      '25 starter templates from AFMAN 91-203, plus any custom checklists configured for your base',
      'Three tabs: Available (the library), Active (currently running, persists across shifts), History (audit trail)',
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
        'Walk through each step in order; the engine captures who acknowledged and when.',
        'If you hand off mid-emergency, the QRC stays in Active for the next shift to resume.',
        'When complete, click Close — stamps closer name + Zulu time and freezes the record.',
        'Download the After-Action PDF from the closed-QRC view for the post-event debrief.',
      ],
    },
    screenshots: [],
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
    screenshots: [],
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
        'Walk down the list, toggling items completed or N/A as you go.',
        'Complete required items before signing off the shift.',
        'Click Complete Checklist — system stamps closer name + Zulu time.',
        'Past checklists are visible in the History tab for the audit trail.',
      ],
    },
    screenshots: [],
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
      'Daily, lighting, FOD, weather, construction, heavy aircraft, and other checks. Pick a type, walk the inspection items, and log discrepancies inline as you find them. Drafts auto-save to Supabase + localStorage so you can resume from another device or recover after a crash.\n\n' +
      'Discrepancies you log during a check auto-route to the right CES shop based on the type-to-shop mapping in Base Setup. Photos attach per-discrepancy via path-scoped storage RLS. Check-specific fields (RSC for Daily, BWC for FOD, BASH for Wildlife checks) appear conditionally based on the check type chosen.',
    keyFeatures: [
      'Seven check types — Daily, Lighting, FOD, Weather, Construction, Other, Heavy Aircraft',
      'Per-area selector covers entire airfield or specific zones configured in Base Setup',
      'Inline discrepancy capture — log issues as you find them, photo + GPS optional',
      'Draft auto-save to Supabase + localStorage for cross-device resume',
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
        'Walk the airfield, toggling items as you go. Capture discrepancies inline with photos.',
        'Fill in check-specific fields (RSC, BWC, etc.) if applicable.',
        'Click Submit when done — the check logs and discrepancies route to CES.',
      ],
    },
    screenshots: [],
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
      'Daily Airfield is hard-locked to one airfield + one lighting inspection per day, per base, with a 0600L reset. Drafts auto-save to localStorage with cross-device load from Supabase. Issues you log roll into the Discrepancies module with the same workflow + CES routing.',
    keyFeatures: [
      'Four inspection types — Daily Airfield, ACSI, Pre/Post Construction, Monthly Joint',
      'Daily one-per-day lock prevents double-booking at the same base',
      '0600L reset honoring installation timezone',
      'Auto-save drafts to localStorage; cross-device load from Supabase',
      'started_at stamped on insert for accurate audit trail',
      'Issues log to Discrepancies with auto-routing to CES shops',
      'Photos attach per-issue via path-scoped storage RLS',
      'History link on every tile — filter by date, inspector, status',
    ],
    howToAccess: 'Sidebar › Operations › All Inspections. On mobile, More menu › Operations › All Inspections.',
    workflow: {
      title: 'Starting a daily inspection',
      steps: [
        'Open All Inspections.',
        'Click the Daily Airfield tile to start a new airfield inspection.',
        'Walk the inspection items; log discrepancies and capture photos as you find issues.',
        'The draft auto-saves; sign in from another device to continue if needed.',
        'Submit when complete — the inspection logs and discrepancies route to CES.',
      ],
    },
    screenshots: [],
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
    overview:
      'Annual compliance inspection per DAFMAN 13-204v2 Para 5.4.3. The full ACSI checklist runs to hundreds of items across multiple sections; the engine renders one section at a time, captures pass/fail/N/A per item with optional remarks and photos, and supports per-member signatures so the inspection team\'s sign-off is on the record.\n\n' +
      'Drafts auto-save and resume — ACSI runs are long, often spanning days. The launcher tile on /inspections/all surfaces an in-progress draft as "Continue ACSI Draft" so you can pick up where you left off without searching.',
    keyFeatures: [
      'Hundreds of items across multiple sections, rendered one section at a time',
      'Pass / Fail / N/A per item with optional remarks + photo evidence',
      'Per-member signature toggle (configurable in Base Setup) for team sign-off',
      'Auto-save with cross-device resume — surfaces as "Continue ACSI Draft" on the launcher',
      'Issues log to Discrepancies with full workflow integration',
      'PDF export bundles the entire inspection with signatures + photos',
      'History tab shows every past ACSI run with completion status',
    ],
    howToAccess: 'Sidebar › Operations › All Inspections › ACSI tile (Start ACSI or Continue ACSI Draft).',
    workflow: {
      title: 'Running an ACSI inspection',
      steps: [
        'From All Inspections, click ACSI to start a new inspection.',
        'Walk the team through each section — Pass / Fail / N/A per item with remarks and photos.',
        'For Failed items, capture a discrepancy directly so the audit trail includes routing.',
        'Save and resume across days as needed — the draft persists.',
        'When complete, collect per-member signatures and export the PDF for the official record.',
      ],
    },
    screenshots: [],
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
    tagline: 'Per-shift sign-off + AFM daily certification',
    roles: OPS_AND_OVERSIGHT,
    overview:
      'DAFMAN 13-204v1 §2.5.2.10.3 / .10.4 shift turnover and daily review queue. Each shift signs off on the events from their shift; AFM closes the day. Pending and reviewed counters in the header give an at-a-glance read before scrolling.\n\n' +
      'The colored left rail on each row communicates state: green when fully certified, amber when today is pending (your turn), quiet when a past day is still unsigned. Click any row to open the sign modal. Required slots adapt to your base — bases.shift_count (2 or 3) determines whether you have Day/Mid/Swing or just Day/Swing.',
    keyFeatures: [
      'Per-day rows with colored left rail showing state at a glance',
      'Required slots: Day AMSL / Swing AMSL / Mid AMSL + NAMO + AFM (slot count from bases.shift_count)',
      'Events hash (SHA-256 of the day\'s entity IDs) freezes the rollup on certification',
      'Events Log shows AMENDED pill when a row\'s created_at > the day\'s fully_certified_at',
      'Sign modal carries name + rank + Zulu timestamp + optional notes per slot',
      'fully_certified_at stamps when every required slot is signed; row turns green',
      'PDF export per day for the AFMAN evidence binder',
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
    screenshots: [],
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
      'Submit problems, route them to the right CES shop, and verify the work when CES marks it complete. The green dot on the sidebar fires when something is waiting for your verification — the second-to-last state in the lifecycle (Work Completed Awaiting Verification).\n\n' +
      'New discrepancies auto-route to the assigned CES shop based on the type-to-shop mapping in Base Setup. KPI tiles up top quick-filter to Open, > 30 Days, or per-current-status (AFM / CES / AMOPS). Map view plots every filtered discrepancy on the airfield diagram for spotting clusters.',
    keyFeatures: [
      'Lifecycle: Submitted › Awaiting Action by CES › Waiting for Project / In Work › Work Completed (Awaiting Verification) › Closed',
      'Auto-routing to CES shops based on type-to-shop mapping (configured in Base Setup)',
      'KPI tiles for quick-filter (Open, > 30 Days, AFM / CES / AMOPS owners)',
      'Map view plots every filtered discrepancy on the airfield diagram',
      'Status pills with colored left rails on every row showing current owner',
      'Photos per discrepancy via path-scoped storage RLS',
      'Notes history on every discrepancy detail for back-and-forth context',
      'Excel / PDF / Email export of the current filtered view',
      'Sidebar green dot fires when discrepancies await your verification',
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
    screenshots: [],
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
    screenshots: [],
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
      'Prior Permission Required entries for transient aircraft. The sidebar dot fires when entries are awaiting your triage, approval, or coordination. Aircrews request via a QR-coded public form at /<your-icao>/ppr-request — no login required — and submissions land here with status Awaiting Review.\n\n' +
      'The column set is configured per base in Base Setup › PPR Columns. Status pills track the lifecycle: Review › Coordination › Approval › Approved / Denied / Canceled. Soft-canceled rows strike through but stay visible for the audit trail. Email approve/deny + branded PPR PDF export are built in.',
    keyFeatures: [
      'Public QR-coded request form at /<icao>/ppr-request — no login needed',
      'Configurable column set per base (Base Setup › PPR Columns)',
      'Triage queue with KPI pills (Awaiting Review / Awaiting Approval / per-agency pending)',
      'Multi-agency coordination log with per-agency reply tracking',
      'Status pills: Review › Coordination › Approval › Approved / Denied / Canceled',
      'Email approve / deny with branded denial reason via Resend',
      'Single-page PPR PDF for the requestor',
      'Soft-cancel preserves rows in the audit trail (strikethrough display)',
    ],
    howToAccess: 'Sidebar › Operations › PPR. On mobile, More menu › Operations › PPR.',
    workflow: {
      title: 'Triaging a public PPR request',
      steps: [
        'Open PPR; the Awaiting Review pill shows new public submissions.',
        'Click any row to open the detail editor.',
        'Coordinate with required agencies (Tower, Base Ops, etc.) using the coordination log.',
        'Once coordinated, move to Approval and decide — the requestor gets an email.',
        'Export the PPR PDF for the approved arrival.',
      ],
    },
    screenshots: [],
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
      'Species picker curated per base in Base Setup › Wildlife Species (270+ species available)',
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
    screenshots: [],
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
    tagline: 'AF Form 483 escort tracking with credential expirations',
    roles: OPS_CORE,
    overview:
      'AF Form 483 contractor escort logs. Track who is on the airfield, what facility they are visiting, who is escorting them, and credential expirations. Active personnel show on the Airfield Status page so the duty AMOPS controller has a constant read on who\'s out there.\n\n' +
      'Templates speed up recurring contractors — define a template once, apply it for repeat visits. Filter tabs (Active / All / Completed) and a search bar narrow the list. Credential expiration dates color-code red when imminent.',
    keyFeatures: [
      'AF Form 483 lifecycle — entry / exit logging with escort assignment',
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
        'Fill in company, contact, location, escort, credential expiry.',
        'Submit — the entry logs and the contractor appears on Airfield Status.',
        'When they leave, click their row and mark exit time — they move to Completed.',
      ],
    },
    screenshots: [],
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
      'Plan transient and resident parking with wingtip and taxilane clearance envelopes per UFC 3-260-01. Drag aircraft, set heading, and the engine ray-tests against runways, taxiways, and adjacent spots in real time. Plans persist per base — multiple drafts plus one Active that drives ARFF and ATC views.\n\n' +
      'The floating panel has four tabs: Aircraft (placed silhouettes grouped by type), Environment (obstacles + taxilanes + apron boundaries), Clearance (live UFC evaluation with violations + warnings), and Settings (per-plan apron context that flips which UFC table the engine reads).',
    keyFeatures: [
      'UFC 3-260-01 wingtip + taxilane clearance evaluation, live as you drag',
      'To-scale aircraft silhouettes from a 200+ airframe library',
      'Multiple plans per base — Draft / Active / Template states',
      'Active plan drives ARFF readiness and transient parking views',
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
        'Set the plan Active when ready — it drives ARFF + transient board across the app.',
      ],
    },
    screenshots: [],
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
      'Required Actions section numbers FAA + leadership notification steps',
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
    screenshots: [],
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
      'Map view of every NAVAID component on the field — edge lights, PAPI, MALSR, ALSF, threshold bars, taxiway lighting. Each fixture has a status; the Outage Engine classifies outages into four tiers per DAFMAN 13-204v2 Table A3.1 and detects bar-out conditions across grouped fixtures.\n\n' +
      'Click any fixture marker to inspect or report inop — the engine immediately re-evaluates the system tier and shows the outage ring (green / yellow / red / black). Reporting an outage auto-creates a discrepancy and routes it to the Electrical Light shop based on your base setup.',
    keyFeatures: [
      'DAFMAN 13-204v2 Table A3.1 outage engine — green / yellow / red / black tiers',
      'Bar-level analysis flags bar inop when 3+ fixtures in the group are down',
      'Click any fixture to inspect or report inop — auto-creates discrepancy',
      'Lighting Status panel rolls up per-system status (PAPI, MALSR, ALSF, edge, threshold)',
      'Edit Mode (admin): drag fixtures to correct positions, bulk-shift, box-select, place new bars',
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
    screenshots: [],
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
    screenshots: [],
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
      'Reference data on 200+ airframes. Silhouettes, dimensions (wingspan / length / height), ARFF CAT category, and parking clearance requirements. Used by the parking module (silhouettes + clearance envelopes), the ARFF readiness panel (CAT mapping), and as a quick reference when fielding transient requests.\n\n' +
      'Search by aircraft type or manufacturer; sort by MTOW, wingspan, length, or height. The ACN/PCN calculator lets you compare aircraft pavement requirements against your airfield\'s PCN. Favorites persist per browser via localStorage.',
    keyFeatures: [
      '200+ airframes — military and commercial',
      'Silhouettes rendered to-scale (used by /parking)',
      'Wingspan / length / height / MTOW per airframe',
      'ARFF CAT category mapping (used by ARFF readiness)',
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
    screenshots: [],
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
      'Searchable PDF library of 70+ DAFMAN, UFC, AFMAN, and AF Form documents that govern airfield management. The IAW Compliance callouts elsewhere in the app point you back to specific paragraphs here. Full-text search works across PDF content + titles.\n\n' +
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
    screenshots: [],
    faq: [],
    relatedModules: ['training'],
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
      'Live FAA feed of NOTAMs for your ICAO. Filter by source (FAA / LOCAL), status (Active / Expired), or free text. The red dot on the sidebar fires when one or more NOTAMs are within their expiration window (24h warning).\n\n' +
      'Local NOTAMs created by base users blend with the FAA feed for the same ICAO. Effective dates render in compact Zulu format. Expiring-within-24h NOTAMs get a red AlertCircle glow so they\'re unmissable. PDF + Email export the current filtered view.',
    keyFeatures: [
      'Live FAA NOTAM feed by ICAO (auto-refreshable)',
      'Local NOTAMs created by base users blend with FAA feed',
      'Filter by source (FAA / LOCAL), status (Active / Expired), or free text',
      'Expiration warning glow within 24h window',
      'Sidebar red dot fires while any NOTAM is within expiration window',
      'Compact Zulu effective-date format (e.g., "Today 1430Z")',
      'PERM (permanent) NOTAMs never expire',
      'PDF + Email export of current filtered view',
    ],
    howToAccess: 'Sidebar › Reference › NOTAMs. On mobile, More menu › Reference › NOTAMs.',
    workflow: {
      title: 'Reviewing today\'s NOTAMs',
      steps: [
        'Open NOTAMs.',
        'Set the ICAO to your airfield (pre-filled from base config).',
        'Click Refresh to pull the latest FAA feed.',
        'Scan the Active filter for new or expiring entries.',
        'Add a Local NOTAM if you have an in-base condition not in the FAA feed.',
      ],
    },
    screenshots: [],
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
        'Email it from the modal or download for the daily binder.',
      ],
    },
    screenshots: [],
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
    screenshots: [],
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
      'Invite users via branded email (Resend) — sets pending status',
      'Role assignment from the permission matrix (12 roles, ~86 permission keys)',
      'Per-user permission overrides for fine-grained adjustments',
      'Status: pending › active › deactivated (soft delete, reactivatable)',
      'System admins see all users; base admins see their installation only',
      'Self-signup requests show as pending for admin approval',
      'Operating initials + rank capture for audit-trail signatures',
      'Per-user password reset (admin-triggered, branded email)',
    ],
    howToAccess: 'Sidebar › Admin › Users (admin role required). On mobile, More menu › Admin › Users.',
    workflow: {
      title: 'Inviting a new user',
      steps: [
        'Open Users.',
        'Click + Invite User.',
        'Fill in name, email, rank, role.',
        'Submit — invitation email sends via Resend; status is pending.',
        'User clicks the email link, sets a password, and lands as active.',
      ],
    },
    screenshots: [],
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
    tagline: 'Triage inbox for the public QR feedback form',
    roles: OPS_CORE,
    overview:
      'Inbox for the public QR-code feedback form (configured in Base Setup › Customer Feedback Form). Triage submissions, reply, and route to the right module owner. The QR code is designed for posting at base ops or transient parking so anyone can scan and submit feedback without a login.\n\n' +
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
        'Click any low-rating row to read full comment + custom fields.',
        'Reply via your normal email if a contact email was provided.',
        'Export the monthly PDF for command-level rollup.',
      ],
    },
    screenshots: [],
    faq: [],
    relatedModules: ['reports', 'settings'],
    readMinutes: 3,
  },
]
