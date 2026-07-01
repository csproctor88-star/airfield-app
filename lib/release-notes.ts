/** Release notes shown in the What's New modal. Newest release first.
 *
 *  When cutting a release:
 *   1. Bump `version` in package.json
 *   2. Prepend a new entry to RELEASE_NOTES here
 *   3. The modal will pop for every existing user on next sign-in.
 *
 *  Each `highlights` bullet is plain prose — no Markdown. Keep bullets
 *  to one sentence so the modal stays scannable on mobile.
 */
export type ReleaseSection = { title: string; items: string[] }

export type ReleaseNote = {
  version: string       // "2.32.0" — compared lexicographically against profiles.last_seen_release_version
  date: string          // "2026-04-21" (Zulu)
  headline: string      // one-line tagline
  // Provide ONE of the following. `highlights` is the legacy flat list (older
  // entries); `sections` groups bullets under headers so a large release reads
  // as scannable groups in the What's New modal instead of one long list.
  highlights?: string[]
  sections?: ReleaseSection[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2.35.0',
    date: '2026-06-30',
    headline: 'Glidepath 2.35 is live!',
    sections: [
      {
        title: 'Customizable Dashboard',
        items: [
          'Customizable dashboard — the dashboard is now a drag-and-drop, resizable grid of widgets you build yourself, with an Edit mode and an add-widget palette, replacing the old fixed KPI page.',
          'Multiple dashboards — create, name, and switch between several personal boards, and set one of them as your default.',
          'Share a dashboard with your base — sharing copies the widgets you built, and admins can assign a shared board as the starting template for a role.',
          'Eight configurable list widgets (Discrepancies, PPR, Personnel on Airfield, NOTAMs, CES Work Orders, Events Log, Waivers, Daily Reviews) — pick your own columns, apply filters, click to sort, search within the widget, and drag to resize columns.',
          'Table widgets wrap their text when you resize a column, keep their headers sticky while you scroll, and their rows deep-link straight into the module.',
          'The PPR widget shows your base-defined PPR columns with live values and readable status labels, and clicking a row opens the real PPR detail dialog — even for a PPR outside the current date range.',
          'Rename any widget and tint it with a per-widget color that stays readable in both the light and dark themes.',
          'Richer widgets — Wildlife recent sightings & strikes, a User Management roster with deep-link, AMTR currency status, and an Infrastructure widget with a per-system light/outage selector.',
          'Five report-summary widgets put Discrepancy, Trends, Aging, Lighting, and Daily Operations KPIs on the dashboard at a glance.',
          'Build-your-own analytics widget — a guided chart builder over six datasets (discrepancies, inspections, checks, wildlife, PPR, feedback) with metric, bar, line, donut, and table chart types.',
          'Utility widgets — a multi-timezone Zulu clock with large readable slices, Notes with an inline add button, customizable Quick Actions (module picker plus your own buttons), a Links bookmarks widget with descriptions and search, and a web-embed widget with a safe scrollable frame.',
          'Five AMTR dashboard widgets — the existing one is now "AMTR — Currency", joined by Unit KPIs, Overdue Training, Due Soon (30 days), and Inspection Status — each addable on its own from the palette and gated to AMTR-access roles.',
          'Duplicate to my dashboards — one click copies any board (including a read-only shared one) into your own editable personal copy.',
          'Copy a widget to another dashboard — a "Copy to…" menu on every widget copies it, with its exact column/filter/color setup, onto another of your boards or a brand-new one.',
          'Status Board widget — surface any Airfield Status board (a custom status board, NAVAIDs, runway status, or ARFF) on the dashboard, rendered with the same chips and status colors as the Airfield Status page: G/Y/R letter chips for NAVAID and custom boards, status-tinted cards for runway and ARFF.',
          'Airfield Lighting widget — put lighting health on the dashboard scoped to a runway, taxiway, or apron area, a single system, or one light type, with each component shown as a tidy column (name, count, status) and exceeded thresholds flagged red. An airfield-wide Status scope rolls lighting up by category.',
          'Per-device dashboard layouts — arrange your widgets separately for desktop, tablet, and phone, each saved on its own; resize a widget by dragging any corner; and your moves batch up and save once when you press Done.',
          'Set any board as your default — make any dashboard you can see your personal default, including a board shared with you, with a check marking your current default in the board picker.',
          'The Discrepancy Trends, Aging, and Report widgets render the full Reports & Analytics views — opened-vs-closed trend bars and top areas/types, an interactive aging tier/shop cross-filter, and a By Area / Type / Shop breakdown that now reads as clean tables on both the report page and the widget.',
          'The Events Log widget matches the main Events Log — a color-coded Action column alongside Details, Zulu, operating initials, type, and entity — and each row\'s entity deep-links straight to the underlying record.',
          'More ways to chart your data — analytics can group wildlife by specific species, and inspections analytics adds Result (pass / fail / in-progress), Completed By, and Discrepancies Found dimensions.',
        ],
      },
      {
        title: 'FLIP Management',
        items: [
          'FLIP Management — a new module that replaces the paper FLIP continuity binder (DAFMAN 13-204V2 ¶2.5.2.18.1), tracking FLIP product accountability, edition reviews, and non-procedural change coordination.',
          'FLIP home — an account overview with the appointment letter and primary/alternate custodians, your local FLIP list, the ordering-process and manager-responsibilities sections, and an uploadable references library.',
          'FLIP Changes pipeline — coordinate a non-procedural change through a three-stage board (Coordination → Submitted → Completed) with AFM approval, publish, and reject actions, FAA-format change fields, and an append-only coordination history with remarks.',
          'FLIP Reviews — document each edition review (cycle, date, per-FLIP discrepancies, corrective action, and date corrected) and sign it off sequentially Custodian → NAMO → AFM.',
          'One-click signed FLIP review PDF, plus a Changes Report view with its own PDF export.',
        ],
      },
      {
        title: 'Read File',
        items: [
          'Read File — a new read-and-initial continuity file where airfield management posts documents and operational users acknowledge them, replacing the paper read-and-initial binder.',
          'Managers add, replace, and archive files (PDF, image, or Office, up to 25 MB) with a title and description, kept in a private per-base store with a PII/CUI handling notice.',
          'One-click "I have reviewed this file" acknowledgment that stamps your name, operating initials, time, and the exact file version you signed.',
          'A manager review report PDF lists every required reader for each file with REVIEWED / OUTSTANDING status and acknowledgment times.',
        ],
      },
      {
        title: 'PPR Coordination',
        items: [
          'PPR calendar — a month-grid view of arrivals alongside the log, with status chips that open the detail card.',
          'Transient Aircraft board — an approved PPR stays visible from its arrival day until staff mark it Departed.',
          'Calendar invites — a PPR approval email can carry a standards-compliant .ics calendar invite, per coordinating agency (toggled in Base Setup), with the full request detail in the invite body.',
          'Information-only recipients — notify groups on final approval (and the calendar invite) without putting them in the coordination gate.',
        ],
      },
      {
        title: 'AMTR — Airfield Management Training Record',
        items: [
          'The AMTR monthly record self-inspection was overhauled — readable findings with a per-item comment box, every discrepancy listed (no "+N more" cap), a floating minimizable checklist that frees the full page width, and several more checklist lines auto-evaluated.',
          'AMTR signature notifications — a daily fleet-wide reconcile surfaces each person\'s due training and the items awaiting their signature as an amber sidebar badge, scoped so you only see your own items and the ones that need your countersignature.',
          '623A comment templates are now an editable per-base catalog — edit the label, citation, and body, add your own, or restore the shipped DAFMAN standards.',
          'Manager-addable DAF 803 sections — a NAMT can add a custom evaluation section with its own tasks, rename sections, and delete custom ones. Custom sections render as chips on a member record like the built-ins, are graded by the record self-inspection engine, and export to their own DAF 803-format sheet placed right after the built-in AFM 803 tab.',
          'Completing a record inspection now writes a detailed 623A entry — built from the DAFMAN records-inspection template and citation and listing every discrepancy by item number, finding detail, and corrective action, instead of a one-line gap count.',
          'Signing as Certification Official completes the 1098 item — it stamps the completion, recomputes the next due date from the task frequency, and rolls the item to Complete on the spot, with no manual due-date edit or page refresh.',
        ],
      },
      {
        title: 'Daily Reviews',
        items: [
          'Certification log PDF — export a Last 7 / Last 30 / month-to-date or custom-range report showing every day\'s slot sign-offs and certification status, with a certified-vs-pending tally.',
        ],
      },
      {
        title: 'Exports & Integrations',
        items: [
          'Export for C2IMERA — a one-click Excel workbook with Events Log, PPR, and Discrepancies sheets formatted for the C2IMERA command-and-control system (Zulu times, operating-initials suffixes, and a configurable unit).',
        ],
      },
      {
        title: 'QRC — Quick Reaction Checklists',
        items: [
          'QRC steps now record who completed them and when, with an optional per-step remark, plus a Remarks field on the whole execution that prints in the closed-QRC PDF.',
        ],
      },
      {
        title: 'Visual NAVAIDs & Infrastructure',
        items: [
          'The Visual NAVAIDs map rendering was rebuilt — airfield lights are now true meter-based circles, signs and markers scale smoothly with zoom without jank, and all feature layers default to visible on load.',
        ],
      },
      {
        title: 'Navigation & Search',
        items: [
          'Inline navigation search — a search box in the sidebar and the More menu jumps you to any destination, with keyword aliases so terms like BASH, lights/PAPI, TALPA, and form numbers all find the right page.',
        ],
      },
      {
        title: 'Across the App',
        items: [
          'Obstruction Evaluation now builds a copy-ready obstacle NOTAM — FAA DDMMSS coordinates, MSL height, and distance and bearing from the nearest runway threshold — in the NOTAM Reference card.',
          'Parking diagrams and PDFs now show your entered Aircraft Label on each spot.',
        ],
      },
      {
        title: 'Reliability — Offline & Sync',
        items: [
          'More of the app keeps working offline — airfield status, the NAVAID status grid, new discrepancies, and Report Outage now go through the offline write queue and sync when you reconnect.',
        ],
      },
    ],
  },
  {
    version: '2.34.0',
    date: '2026-06-01',
    headline: 'Glidepath 2.34 is live!',
    sections: [
      {
        title: 'AMTR — Airfield Management Training Record',
        items: [
          'A fully digital AF 1098, 623A, JQS, and DAF 803 training record with tracking, sign-off, and reporting, replacing the standalone AFFSA training-record workbook.',
          'Auto-623A documentation — completing a 1098 task drafts the matching AF 623A entry automatically, through a multi-stage trainee → trainer → certifier sign-off flow.',
          'Twelve DAFMAN comment templates — one-click standardized 623A narrative entries keep documentation language consistent and compliant.',
          'Per-year 1098 catalog with archive — open and lock training years explicitly; prior years are preserved read-only with a clear archived treatment.',
          'Import and export round-trip with the standard HAF/AFFSA Excel training record — transcribe an existing record into Glidepath and export back to the official format.',
          'Transcribe — bulk-capture handwritten initials and dates from an imported record straight into the live form, across every form tab.',
          'Files tab — attach supporting documents to a training record with title and date metadata and a PII/CUI handling notice.',
          'Monthly training-record self-inspections — automatically detect discrepancies using the AFFSA monthly records inspection checklist (missing signatures, overdue training, missing initials, etc.).',
          'Shared, editable catalogs — Qualifications, Skill Levels, SEIs, the standard DAF 803 task list, and 623A entry types, with one-click populate and version-aware HAF updates.',
          'For instructions on importing records, visit the AMTR guide under Glidepath Training.',
        ],
      },
      {
        title: 'Records Export',
        items: [
          'One-click Records Export (Settings → Records Export) packages all of your airfield\'s records into a single organized ZIP for Air Force records disposition or migration — generated entirely in your browser, so record data never leaves the device.',
        ],
      },
      {
        title: 'FAA Part 139 — Civilian Commercial Airport Mode',
        items: [
          'Glidepath now runs civilian FAA Part 139 commercial airports as well as USAF airfields — airport type is chosen at base setup, and civilian bases automatically see Part 139 modules and FAA terminology.',
          'Safety Management System (SMS) — 14 CFR §139.401 / AC 150/5200-37A hazard register, risk matrix, and safety performance indicators with automated monthly measurement.',
          '§139.303 Training — 13 seeded topics, per-user records with automatic expiry and renewal chains, AAAE/ACE certificates, a compliance matrix, and a 30-day expiry email digest.',
          'Airport Emergency Plan (AEP) — versioned plan with FAA acceptance tracking, response-agency roster, monthly communications checks, and triennial/annual drill program logging.',
          'Part 77 obstruction surfaces — FAA §77.19 imaginary-surface evaluation across all six approach types alongside the existing UFC 3-260-01 engine, with FAA Form 7460-1 waiver guidance.',
          'Field Conditions / TALPA — per-runway RwyCC assessment per AC 150/5200-30D with an automatic FICON NOTAM generator, ready to paste into FAA NOTAM Manager.',
          'Wildlife Hazard Management Plan (WHMP) — annual §139.337 assessment with an AE sign-off countdown, hazardous-species register, and one-click promotion of findings into the SMS hazard register.',
        ],
      },
      {
        title: 'PPR Coordination',
        items: [
          'Multi-agency coordination — coordinating agencies are notified by email automatically on approve, deny, and cancel, and can be added to a request after it is created.',
          'Keep coordinating agencies current on changes — editing a PPR after agencies have coordinated prompts you to send them the updated details (what changed, plus the full current request). Informational only; it doesn\'t reset coordination.',
        ],
      },
      {
        title: '.mil Email Deliverability',
        items: [
          'Email deliverability hardened for .mil inboxes — invite, signup, password-reset, and PPR emails were reworked to clear Microsoft Defender filtering, using plain links and PDF attachments instead of tracked deep-link buttons.',
        ],
      },
      {
        title: 'Parking Plans',
        items: [
          'Parking plan PDF capture rebuilt — reliable satellite-imagery export with a WYSIWYG capture frame, multi-apron support, rotation, and a heading slider.',
          'Edit a parking plan\'s name and description after creation, and toggle aircraft labels on the diagram.',
        ],
      },
      {
        title: 'QRC — Quick Reaction Checklists',
        items: [
          'Build Quick Reaction Checklists from scratch with a full step-type editor ("QRC Templates" is now simply "QRCs").',
          'Per-user QRC reviews — monthly or quarterly per base, with a consolidated compliance PDF.',
        ],
      },
      {
        title: 'Across the App',
        items: [
          'Events Log is no longer capped at 500 entries — infinite scroll, server-side search, and a full PDF export across the whole log.',
          'Per-base satellite provider toggle for OCONUS bases where Google imagery is thin.',
          'In-app Help & Training now covers every module — new step-by-step guides, with screenshots, for Training Records (AMTR), Records Export, and the FAA Part 139 modules. The guide list automatically shows only the modules that apply to your airport type.',
        ],
      },
      {
        title: 'Navigation & Layout',
        items: [
          'Cleaner navigation — the sidebar and mobile menu are reorganized into four focused sections (Daily Operations, Airfield Management, Reference, Admin) with the secondary sections collapsed by default, so the resting view is short and scannable.',
          'Training Records (AMTR) is now in the navigation — previously reachable only by direct link, it\'s surfaced for Airfield Managers, NAMO, AMOPS, and Base Admins.',
        ],
      },
      {
        title: 'Refreshed App Design',
        items: [
          'A new Refreshed look — a readability and hierarchy overhaul: a distinctive type pairing with a monospace face for operational data (Zulu time, ICAO, counts), clearer headings, calmer neutral chrome so the green/amber/red status colors stand out, brighter dark-mode text, and a warm cream light theme instead of stark white.',
        ],
      },
    ],
  },
  {
    version: '2.33.0',
    date: '2026-05-02',
    headline: 'Glidepath Training rebuilt, permission matrix overhaul, PPR module, offline reads + writes',
    highlights: [
      'Glidepath Training rebuilt at /training — role-filterable module hub plus per-module deep-dive pages with overview, key features, workflow, screenshots, and a Mark Reviewed toggle so you can track what you have learned across sessions.',
      'Permission matrix replaces ad-hoc role checks — 77 permission keys, per-user overrides, and three new roles (kiosk-only Airfield Status, PPR-only, MAJCOM/RFM read-only).',
      'PPR module — public QR-coded request form at /<icao>/ppr-request, AMOPS triage queue, multi-agency coordination log, branded approve / deny emails, single-page PPR PDF.',
      'Offline reads + writes — Workbox runtime caching for QRC, Discrepancies, Library, Aircraft, Waivers, plus an offline write queue for inspections, checks, and discrepancies with auto-sync on reconnect.',
      'Daily Reviews — per-shift sign-off with events_hash freezing the daily rollup; the Events Log shows an AMENDED pill on entries that arrived after certification.',
      'Forgot-password and invite emails now send the branded Glidepath template (was Supabase default) and land users on the correct screen.',
      'Events Log refresh — tertiary header with inline counts, compact shift-review bar, single search bar across actor / OI / action / details, chip-cluster date range, Today / Yesterday relative-date headers.',
      'ACSI per-member signature support, ARFF status log mirrors the runway log, iOS PWA polish, airfield diagram upload rewrite.',
    ],
  },
  {
    version: '2.32.0',
    date: '2026-04-21',
    headline: 'Modular onboarding, Secondary Crash Net, and a cleaner dashboard',
    highlights: [
      'Modules page (Settings → Manage Modules) lets each base pick which Glidepath features to show. Disabled modules hide from navigation and the setup wizard without losing their data.',
      'Secondary Crash Net (SCN) daily check log — per-agency Loud & Clear / No Response / Out of Service badges, automatic Events Log summary, and monthly PDF export. Configure agencies in Base Setup → SCN Agencies.',
      '"Close for the Day" button on the dashboard — posts a banner and clears runway status, RSC, and BWC so tomorrow\'s opening check starts fresh.',
      'Dashboard rebuilt as a quick-action launcher with compact tiles for Checks, Discrepancy, Personnel, Shift Checklist, QRCs, SCN, PPR, BASH, Out of Office, and Close Airfield.',
      'New Admin group in the sidebar holds Activity Log, Daily Reviews, Waivers, Reports & Analytics, Training, PDF Library, and User Management.',
      'Events Log collapses the Action column on mobile; Review Shift bar now lives on the Events Log page.',
      'Training page has a search bar that spans Quick Start, Modules, and Base Setup guides.',
      'Discrepancy status changes in the Events Log now show the user who actually made the change, not the original reporter.',
    ],
  },
  {
    version: '2.31.0',
    date: '2026-04-07',
    headline: 'Full Google Maps migration, Custom Status Boards, and PPR Log',
    highlights: [
      'Every interactive map moved from Mapbox to Google Maps for government-network compatibility.',
      'Custom Status Boards on the Airfield Status page — configurable G/Y/R panels for arresting systems, comm, ARFF, and more.',
      'New PPR (Prior Permission Required) log with auto-generated PPR numbers, configurable columns per base, and dashboard integration.',
      'Parking plans gain templates, duplicate, and auto-space placement with a heading preset.',
      'Weather advisory numbers persist through edit, cancel, and expiry, and appear on activity log entries.',
      'Tile pre-cache — Settings → Data & Storage → Cache Map Tiles pre-downloads base area imagery for offline viewing.',
    ],
  },
]

/** Lexicographic compare that treats null/undefined as "never seen". */
export function isNewerVersion(current: string, lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return true
  return compareVersions(current, lastSeen) > 0
}

/** Semver-ish compare — returns -1, 0, or 1. Handles up to three-part versions. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

/** Returns all release notes the user hasn't yet acknowledged. */
export function unseenReleaseNotes(lastSeen: string | null | undefined): ReleaseNote[] {
  return RELEASE_NOTES.filter(n => isNewerVersion(n.version, lastSeen))
}
