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
export type ReleaseNote = {
  version: string       // "2.32.0" — compared lexicographically against profiles.last_seen_release_version
  date: string          // "2026-04-21" (Zulu)
  headline: string      // one-line tagline
  highlights: string[]  // 3–8 bullets
}

export const RELEASE_NOTES: ReleaseNote[] = [
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
