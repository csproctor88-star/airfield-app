# Training Guide Coverage for v2.34 Modules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the seven missing in-app training guides (AMTR, Records Export, SMS, §139.303 Training, AEP, Field Conditions, WHMP) and airport-type gating to the Help & Training page so each base type sees exactly the guides for the modules it has.

**Architecture:** The guide page (`app/(app)/help/page.tsx`) is data-driven from the `MODULES: ModuleRef[]` array in `lib/training/modules.ts`. We add an optional `appliesTo?: AirportType[]` field to `ModuleRef` (mirroring `lib/modules-config.ts`), a `moduleRefAppliesToAirport()` helper, the seven new entries (text-only — `screenshots` omitted; the user wires PNGs later), and a filter on the help page keyed off `currentInstallation.airport_type`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript (strict), lucide-react icons, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-01-training-guide-coverage-design.md`

**Standing constraints (from project memory):**
- **No fabricated regulatory text** — every reg reference in the new guides is one already present in the codebase (verified via the module reads that fed this plan).
- Verify **both** `npx tsc --noEmit` AND `npx vitest run`; gate the final commit on `npm run build` (vitest can pass while the build fails).
- Use `Array.from(...)`, never `[...set]`/`for...of` over a Map/Set (tsc target rejects it).

---

## File Structure

- **Modify** `lib/training/modules.ts` — add `AirportType` import, `appliesTo` field on `ModuleRef`, `moduleRefAppliesToAirport()` helper, `appliesTo: ['usaf']` on existing `acsi`/`scn`, five new icon imports, and seven new `ModuleRef` entries.
- **Modify** `app/(app)/help/page.tsx` — import `useInstallation` + the helper, compute `airportModules`, gate `filteredModules`, the counts, the tab count pill, and the Module Reference PDF off the airport-type-filtered set.
- **Create** `tests/training-modules-gating.test.ts` — guard the `appliesTo` assignments + helper behavior.

---

## Task 1: Add `appliesTo` field + helper to `ModuleRef`

**Files:**
- Modify: `lib/training/modules.ts` (type block ~lines 47-63; add helper after the `MODULES` array, near the existing exports)

- [ ] **Step 1: Add the `AirportType` import**

At the top of `lib/training/modules.ts`, add below the existing lucide import block:

```ts
import type { AirportType } from '@/lib/airport-mode'
```

- [ ] **Step 2: Add the `appliesTo` field to the `ModuleRef` type**

In the `ModuleRef` type (after `roles: TrainingRole[]`), add:

```ts
  /**
   * Which airport_type modes this guide applies to. Omitted = both modes.
   * Mirrors lib/modules-config.ts: ['usaf'] for USAF-only modules (ACSI, SCN,
   * AMTR), ['faa_part139'] for civilian-only modules (SMS, §139.303 Training,
   * AEP, Field Conditions, WHMP). The help page filters the guide grid by the
   * current installation's airport_type so each base sees only relevant guides.
   */
  appliesTo?: AirportType[]
```

- [ ] **Step 3: Add the `moduleRefAppliesToAirport` helper**

Immediately after the `MODULES` array closes (after the final `]` of `export const MODULES`), add:

```ts
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
```

- [ ] **Step 4: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: exit 0 (no errors). The `AirportType` import resolves from `@/lib/airport-mode`; the new optional field doesn't break the existing entries.

- [ ] **Step 5: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): add appliesTo + airport-type helper to training ModuleRef

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Gate existing USAF-only guides (ACSI, SCN)

**Files:**
- Modify: `lib/training/modules.ts` (the `acsi` entry ~line 443, the `scn` entry ~line 283)

- [ ] **Step 1: Add `appliesTo` to the `acsi` entry**

In the `acsi` `ModuleRef` (id `'acsi'`), add the field after its `roles:` line:

```ts
    appliesTo: ['usaf'],
```

- [ ] **Step 2: Add `appliesTo` to the `scn` entry**

In the `scn` `ModuleRef` (id `'scn'`), add the field after its `roles:` line:

```ts
    appliesTo: ['usaf'],
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): mark ACSI + SCN guides USAF-only

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add the five new icon imports

**Files:**
- Modify: `lib/training/modules.ts` (the lucide-react import block, lines 2-8)

- [ ] **Step 1: Add the new icons to the lucide import**

Append `GraduationCap, Download, ShieldAlert, Siren, Snowflake` to the existing `lucide-react` import (the multi-line `import { ... } from 'lucide-react'` block). The `Bird` icon (used by WHMP) and `ShieldCheck` are already imported; do not duplicate them.

Resulting last import line should include the additions, e.g.:

```ts
  MessageSquare, GraduationCap, Download, ShieldAlert, Siren, Snowflake,
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0 (unused-import warnings are fine at this step; the entries in Tasks 4-10 consume them). If `noUnusedLocals` is enabled and errors, proceed directly to Task 4 before re-running.

- [ ] **Step 3: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): import icons for new module guides

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: AMTR guide entry

**Files:**
- Modify: `lib/training/modules.ts` (append as the last entry before the closing `]` of `MODULES`)

- [ ] **Step 1: Append the AMTR `ModuleRef`**

Insert immediately before the closing `]` of the `MODULES` array (after the `feedback` entry's closing `},`):

```ts
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): add AMTR training guide

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Records Export guide entry

**Files:**
- Modify: `lib/training/modules.ts` (append as the last entry before the closing `]`)

- [ ] **Step 1: Append the Records Export `ModuleRef`**

```ts
  {
    id: 'records-export',
    name: 'Records Export',
    icon: Download,
    color: 'var(--color-cyan)',
    path: '/settings/exports',
    tagline: 'One-click records-disposition export — PDFs, Excel, photos, and an offline viewer in one ZIP',
    roles: ['sys_admin', 'base_admin', ...OPS_CORE],
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): add Records Export training guide

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: SMS guide entry

**Files:**
- Modify: `lib/training/modules.ts` (append as the last entry before the closing `]`)

- [ ] **Step 1: Append the SMS `ModuleRef`**

```ts
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): add SMS training guide

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: §139.303 Training guide entry

**Files:**
- Modify: `lib/training/modules.ts` (append as the last entry before the closing `]`)

- [ ] **Step 1: Append the §139.303 Training `ModuleRef`**

```ts
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): add §139.303 Training guide

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: AEP guide entry

**Files:**
- Modify: `lib/training/modules.ts` (append as the last entry before the closing `]`)

- [ ] **Step 1: Append the AEP `ModuleRef`**

```ts
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): add AEP training guide

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Field Conditions / TALPA guide entry

**Files:**
- Modify: `lib/training/modules.ts` (append as the last entry before the closing `]`)

- [ ] **Step 1: Append the Field Conditions `ModuleRef`**

```ts
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): add Field Conditions / TALPA guide

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: WHMP guide entry

**Files:**
- Modify: `lib/training/modules.ts` (append as the last entry before the closing `]`)

- [ ] **Step 1: Append the WHMP `ModuleRef`**

```ts
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0. With all seven entries in place, the icons imported in Task 3 are now all consumed.

- [ ] **Step 3: Commit**

```bash
git add lib/training/modules.ts
git commit -m "feat(help): add WHMP training guide

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Gate the Help page by airport type

**Files:**
- Modify: `app/(app)/help/page.tsx`

- [ ] **Step 1: Add the imports**

At the top of `app/(app)/help/page.tsx`, add the installation hook and extend the modules import to include the helper:

```ts
import { useInstallation } from '@/lib/installation-context'
```

Change the existing modules import from:

```ts
import { MODULES, type TrainingRole } from '@/lib/training/modules'
```

to:

```ts
import { MODULES, moduleRefAppliesToAirport, type TrainingRole } from '@/lib/training/modules'
```

> Verification note: confirm `useInstallation` is the exported hook name in `lib/installation-context.tsx` and that it returns `currentInstallation` (the base-config modules page reads `currentInstallation?.airport_type` the same way). If the export differs, match it — do not invent a name.

- [ ] **Step 2: Compute the airport-scoped module set**

Inside `TrainingPage`, after the existing `const { isReviewed, reviewed } = useReviewedModules()` line, add:

```ts
  const { currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null
  const airportModules = useMemo(
    () => MODULES.filter(m => moduleRefAppliesToAirport(m, airportType)),
    [airportType],
  )
```

- [ ] **Step 3: Filter the visible modules off `airportModules`**

Change the `filteredModules` memo to iterate `airportModules` instead of `MODULES`, and add it to the dependency array:

```ts
  const filteredModules = useMemo(() => {
    return airportModules.filter(m => {
      if (selectedRoles.length > 0 && !m.roles.some(r => selectedRoles.includes(r))) return false
      if (searching) {
        const hay = `${m.name} ${m.tagline} ${m.overview} ${m.keyFeatures.join(' ')}`.toLowerCase()
        if (!hay.includes(trimmedQuery)) return false
      }
      if (reviewedFilter === 'reviewed' && !isReviewed(m.id)) return false
      if (reviewedFilter === 'unreviewed' && isReviewed(m.id)) return false
      return true
    })
  }, [airportModules, selectedRoles, searching, trimmedQuery, reviewedFilter, isReviewed])
```

- [ ] **Step 4: Point the counts at `airportModules`**

Change the total-count line:

```ts
  const totalCount = airportModules.length
```

In the Modules tab button, change the count pill from `{MODULES.length}` to:

```tsx
          <span style={countPillStyle(activeTab === 'modules')}>{airportModules.length}</span>
```

- [ ] **Step 5: Scope the Module Reference PDF to the base's modules**

In `handleDownloadModulePdf`, change `const data = MODULES.map(...)` to `const data = airportModules.map(...)` (the rest of the mapping is unchanged):

```ts
      const data = airportModules.map(m => ({
        name: m.name,
        tagline: m.tagline,
        overview: m.overview,
        keyFeatures: m.keyFeatures,
        howToAccess: m.howToAccess,
        screenshots: m.screenshots,
      }))
```

> Note: `airportModules` is referenced inside the `handleDownloadModulePdf` callback. Because it's read at call time from the component scope, no dependency wiring is needed; leave the function as-is otherwise.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/(app)/help/page.tsx
git commit -m "feat(help): gate training guide grid + counts by airport type

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Guard test for the gating

**Files:**
- Create: `tests/training-modules-gating.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'
import { MODULES, moduleRefAppliesToAirport } from '@/lib/training/modules'

// Locks the airport-type gating so a future edit can't silently un-gate a
// civilian guide onto USAF bases (or vice versa), and so the new guides keep
// their intended visibility.
describe('training guide airport-type gating', () => {
  const byId = (id: string) => {
    const m = MODULES.find(x => x.id === id)
    if (!m) throw new Error(`guide not found: ${id}`)
    return m
  }

  it('marks the USAF-only guides usaf-only', () => {
    for (const id of ['acsi', 'scn', 'amtr']) {
      expect(byId(id).appliesTo).toEqual(['usaf'])
    }
  })

  it('marks the civilian Part 139 guides faa_part139-only', () => {
    for (const id of ['sms', 'training-part139', 'aep', 'field-conditions', 'whmp']) {
      expect(byId(id).appliesTo).toEqual(['faa_part139'])
    }
  })

  it('leaves dual-mode guides ungated', () => {
    expect(byId('records-export').appliesTo).toBeUndefined()
    expect(byId('discrepancies').appliesTo).toBeUndefined()
  })

  it('helper hides USAF-only guides on civilian bases and vice versa', () => {
    const amtr = byId('amtr')
    const sms = byId('sms')
    const exp = byId('records-export')

    expect(moduleRefAppliesToAirport(amtr, 'usaf')).toBe(true)
    expect(moduleRefAppliesToAirport(amtr, 'faa_part139')).toBe(false)

    expect(moduleRefAppliesToAirport(sms, 'faa_part139')).toBe(true)
    expect(moduleRefAppliesToAirport(sms, 'usaf')).toBe(false)

    // Dual-mode guide shows on both; unknown airport type fails open.
    expect(moduleRefAppliesToAirport(exp, 'usaf')).toBe(true)
    expect(moduleRefAppliesToAirport(exp, 'faa_part139')).toBe(true)
    expect(moduleRefAppliesToAirport(amtr, null)).toBe(true)
  })

  it('every new guide id is present exactly once', () => {
    for (const id of ['amtr', 'records-export', 'sms', 'training-part139', 'aep', 'field-conditions', 'whmp']) {
      expect(MODULES.filter(m => m.id === id)).toHaveLength(1)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run tests/training-modules-gating.test.ts`
Expected: PASS (all 5 tests green). If `records-export` / `discrepancies` assertions fail, an entry was gated when it should be dual-mode — fix the entry, not the test.

- [ ] **Step 3: Commit**

```bash
git add tests/training-modules-gating.test.ts
git commit -m "test(help): guard training-guide airport-type gating

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all files pass, including the new `training-modules-gating` file (suite total = prior 723 + new file's tests).

- [ ] **Step 3: Production build (the real gate)**

Run: `npm run build`
Expected: "compiled successfully", exit 0. This catches import-cycle / dynamic-import / build-only failures that vitest doesn't.

- [ ] **Step 4: Confirm clean tree**

Run: `git status`
Expected: nothing uncommitted from this work (the per-task commits cover `lib/training/modules.ts`, `app/(app)/help/page.tsx`, and `tests/training-modules-gating.test.ts`).

---

## Self-Review (completed during planning)

- **Spec coverage:** appliesTo field + helper (Task 1); existing USAF guides gated (Task 2); seven new guides — AMTR (4), Records Export (5), SMS (6), §139.303 Training (7), AEP (8), Field Conditions (9), WHMP (10); help-page gating incl. counts + PDF (11); guard test (12); verification (13). All spec sections mapped.
- **Placeholder scan:** no TBD/TODO; every entry is complete code; screenshots intentionally omitted per spec (user wires later) — that is a stated design choice, not a placeholder.
- **Type consistency:** helper named `moduleRefAppliesToAirport` everywhere (modules.ts def, help page import, test import); all new ids referenced consistently across Tasks 4-12; `appliesTo` shape `AirportType[]` matches `modules-config.ts`.
- **Out of scope (per spec):** screenshots, and the old-guide nav-breadcrumb drift in the 27 existing guides + Quick Start.

## Screenshot shot-list (for the user's later capture pass)

Filename convention `public/training/<module-id>_N.png`; the entry's `screenshots` array is added later with captions written against the real images (caption-first):
- `amtr`: roster + KPI strip; a 1098 row signing → Auto-623A dialog; import/export round-trip.
- `records-export`: the export builder (period + output kinds + modules); the START-HERE cover / manifest; the offline viewer.
- `sms`: AE dashboard four pillar cards; hazard register with the 5×5 matrix; SPI sparklines.
- `training-part139`: compliance matrix grid; a user's records with expiry/renewal.
- `aep`: dashboard cards; comms-check modal; drills program.
- `field-conditions`: per-third RwyCC modal with live preview; generated FICON NOTAM text.
- `whmp`: active assessment with AE sign-off countdown; species register; finding → Promote to SMS Hazard.
