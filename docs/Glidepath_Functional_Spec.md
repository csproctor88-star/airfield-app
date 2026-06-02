# Glidepath — Functional Specification

Glidepath is a Progressive Web App for airfield management. It replaces paper logs, shared spreadsheets, and phone-based status reporting with a single real-time platform that holds the daily operational rhythm of an airfield, the compliance records that prove it was done, and the engines that evaluate it against regulation. It is used day-to-day by **Airfield Managers** and **AMOPS personnel** at USAF airfields, and — in its second mode — by airport operations staff at FAA Part 139 commercial-service airports. It solves the problem of operational state being scattered across artifacts that don't enforce currency, don't audit who did what, and can't be evaluated against DAFMAN / UFC / FAA criteria automatically.

**How to read this:** this document is the developer-handoff spine. It describes platform-wide capabilities, the cross-cutting compliance engines, and the integration surface — enough to reimplement. Every statement is derived from live code (file paths are given inline); regulatory mappings come from the maintained `CLAUDE.md`. Module-by-module specs live in their own parts.

## 1. Overview

Glidepath is a Next.js App Router application backed by Supabase. Functionally it is a multi-tenant ("multi-installation") system where one user account can hold access to several bases, each base self-describes its airfield (runways, taxiways, NAVAIDs, ARFF, shops, facilities) through a setup wizard, and a per-base module set governs which features are active. All operational data is row-level-security scoped to the base, and a permission matrix governs every action.

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (server components + route handlers) |
| Language | TypeScript (strict) · React 18 |
| Data / Auth | Supabase — Postgres + Row-Level Security + Auth + Realtime + Storage |
| PDF | jsPDF + jspdf-autotable, generated client-side (never sent to a third party) |
| Excel | SheetJS (`xlsx`) · ExcelJS |
| Maps | Google Maps JS API (every interactive map); Mapbox GL (wildlife BASH heatmap only) |
| Email | Resend (branded transactional) |
| Styling | Tailwind CSS with a `[data-theme]` CSS-variable swap |
| PWA | `@ducanh2912/next-pwa` — service worker, installable, offline |

### Dual-mode (`airport_type`)

A base is exactly one of two types, stored in `bases.airport_type`: `'usaf'` (default) or `'faa_part139'` (civilian commercial-service). The single source of truth for translating between the two vocabularies is `lib/airport-mode.ts`:

- `getAirportType(base)` resolves any base-like input to a type, defaulting to `'usaf'` (never surface civilian terminology unless the base explicitly opts in).
- `isCivilian(base)` / `isUsaf(base)` are the boolean gates.
- `getRoleLabel(role, base)`, `getTerm(key, base)`, `getDiscrepancyStatusLabel(...)`, and `getSlotLabel(...)` relabel the same underlying keys per mode (e.g. role `airfield_manager` → "Airfield Manager" vs "Airport Operations Manager"; `form_3616` → "AF Form 3616 (Daily Events Log)" vs "Daily Ops Log"). An empty-string label means "hide this role in this mode."
- `getRegSource(base)` decides which `regulations.source` rows surface (`usaf/ufc/icao/both` vs `faa/icao/both`).
- `getSurfaceSet(base)` picks the obstruction imaginary-surface set (`ufc_3_260_01` vs `faa_part77`).

Modules are gated by an optional `appliesTo: AirportType[]` field on each `ModuleDef` (`lib/modules-config.ts`). A module with no `appliesTo` applies to both modes. USAF-only modules are ACSI, SCN, and AMTR; civilian-only modules are SMS, AEP, §139.303 Training, Field Conditions / TALPA, and WHMP. `moduleAppliesToAirport(key, type)` fails open when the type is unknown.

### Per-base module enablement

`bases.enabled_modules` is a string array of `ModuleKey`s. The full catalog of toggleable modules and their metadata (label, category, description, setup steps, default-enabled flag, airport applicability) lives in `MODULES` in `lib/modules-config.ts`. `isModuleEnabled(href, enabledModules, airportType)` is the gate every navigation/route check runs through:

1. A fixed set of always-on routes (`ALWAYS_ON_HREFS`: dashboard, activity, reports, settings, reference data, etc.) is always permitted.
2. A direct or sub-path href maps to its module key; the module must be **both** present in `enabled_modules` **and** applicable to the base's airport type.
3. Unknown hrefs fail open (so unrelated pages aren't accidentally hidden).

A critical operational nuance lives in `lib/installation-context.tsx`: if `enabled_modules` is **any array** (including empty) it is trusted as a deliberate admin choice; only a missing/non-array value falls back to "all toggleable modules." This is why a newly-added `defaultEnabled` module is invisible on existing bases that have a non-null `enabled_modules` — each new module needs a backfill migration. Setup-wizard steps are similarly gated by `isWizardStepEnabled`, with `CORE_WIZARD_STEPS` (runways, taxiways, areas, ARFF, facilities) always required.

## 2. Platform-wide capabilities

### Multi-installation context

`lib/installation-context.tsx` provides `InstallationProvider` / `useInstallation()`. On mount it loads the user's role from `profiles`, fetches the installations they're a member of (for privileged roles), and loads the configuration for their primary base. The context exposes, among other things: `installationId`, `currentInstallation` (the full base row including `timezone` and `checklist_reset_time`), `allInstallations`, `runways`, `areas`, `ceShops`, `typeShopMap` (discrepancy type → CE shop), `arffAircraft`, `facilities`, `userRole`, `enabledModules`, `setupProgress`, `mapProvider`, and `defaultPdfEmail`.

`switchInstallation(id)` loads the new base's config and persists the choice to `profiles.primary_base_id`. Only the roles in `MULTI_INSTALL_ROLES` (`airfield_manager`, `sys_admin`, `base_admin`, `namo`, `majcom_rfm`) get a populated `allInstallations` list. Because every map and data view keys its effect on `[token, installationId]`, a base switch destroys and recreates map instances rather than early-returning — there is no stale-base state. The provider does not render children until initial load completes (`loaded` gate).

### Roles & permissions

The role set (`UserRole` in `lib/supabase/types.ts`): `airfield_manager`, `namo`, `amops`, `ces`, `safety`, `atc`, `read_only`, `base_admin`, `sys_admin`, `ppr`, `airfield_status`, `majcom_rfm`, plus the civilian Part 139 roles `accountable_executive`, `sms_manager`, `aep_coordinator`, `ops_supervisor`, `arff_chief`.

Permissions use a `<resource>:<action>` key scheme. The canonical key constants live in `PERM` in `lib/permissions.ts` (kept in sync with the SQL permission-matrix migration) — see Appendix A. The effective permission set for a user is computed by `resolveEffectivePermissions(rolePresetKeys, overrides)`: start from the role's preset (`role_permissions`), then apply per-user `user_permission_overrides` where `granted=TRUE` adds and `granted=FALSE` revokes — **the override always wins.** Client code calls `usePermissions()` and gates UI with `.has(PERM.X)`, `.hasAny([...])`, `.hasAll([...])`.

Enforcement is layered. The client hook governs what UI renders; the database enforces the truth via RLS. The only RLS helpers that exist are `user_has_base_access(uid, base_id)`, `user_has_permission(uid, '<resource>:<action>')`, and `user_is_sys_admin(uid)`. Write policies follow the pattern `user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), '<resource>:write')`. Narrow, column-scoped writes (CES status updates, public PPR submit, public feedback submit) go through SECURITY DEFINER RPCs.

### Audit / Activity Log + Daily Reviews

**Events Log** (`lib/supabase/activity.ts`): `logActivity(action, entity_type, entity_id, displayId?, metadata?, baseId?, createdAt?)` writes a row to `activity_log`. `entity_id` must be a UUID. The optional `createdAt` preserves the original action time when an entry is replayed from the offline queue (so a "AFLD3 off airfield at 1432Z" entry that drains an hour later still shows the right time). `logManualEntry(text, baseId?, category?, templateLabel?)` writes a free-text "noted" entry. `updateActivityEntry` / `deleteActivityEntry` edit/remove and return a friendly error if RLS denied the row. Display formatting is centralized in `lib/activity-format.ts`.

**Daily Reviews** (`lib/supabase/daily-reviews.ts`) is the digital substitute for the AF Form 3616 daily shift sign-off (per DAFMAN 13-204 §2.5.2.10; a T-3 waiver covers the CAC-signature requirement of §2.5.2.10.3/10.4). One `daily_reviews` row exists per `(base_id, review_date)` with five signing slots: `day_amsl`, `swing_amsl`, `mid_amsl`, `namo`, `afm`. Each slot stores `signed_by` / `signed_at` / `notes` / `events_hash`. Key behaviors:

- **Required slots vary by shift count.** `requiredSlotsForShifts(shiftCount)` returns 2 or 3 AMSL slots (`bases.shift_count`) plus `namo` + `afm`.
- **Effective review date honors the base's reset time.** `getEffectiveReviewDate(timezone, resetTime)` rolls "today" back to yesterday before the reset hour (default 0600 local), matching the shift-checklist / inspection convention. `getReviewWindowUtc` converts a review date to a UTC `[start, end)` window using `Intl.DateTimeFormat` (host-timezone-independent — matters on Vercel/UTC).
- **Events hash.** `computeEventsHash(ids)` SHA-256s the sorted, pipe-joined entity IDs visible in the day's rollup (first 8 bytes). Stored per slot at sign time; the Events Log shows an "AMENDED" pill when a row's `created_at` is later than `fully_certified_at`.
- **Full certification.** `signDailyReview(...)` upserts the slot, then — if all required slots are now filled (`isFullyCertified`) and `fully_certified_at` is still null — stamps `fully_certified_at`.
- **Slot signing is permission-gated.** `SLOT_PERMISSION` maps each slot to its key (`daily_reviews:sign:amsl|namo|afm`); `canUserSignSlot(has, slot)` is the check. Slot labels are mode-aware via `getSlotLabel(slot, base)`.
- **Current shift.** `currentAmslSlot(timezone, shiftCount)` resolves which AMSL slot owns the current wall-clock hour (3-shift: day 0600–1359, swing 1400–2159, mid 2200–0559; 2-shift: day 0600–1759, swing 1800–0559).

### Photos model

Photos use entity-specific foreign-key columns rather than a generic `entity_id`/`entity_type` pair: `discrepancy_id`, `check_id`, `inspection_id`, `acsi_inspection_id`, `acsi_item_id`, plus an `issue_index` for per-issue linking. Public URLs are produced with `getPublicUrl()`; `storage_path` does **not** include the bucket prefix. Storage RLS on the `photos` bucket is path-scoped: INSERT requires `photos:write` plus base access derived from the UUID segment of the path (discrepancy / check / inspection / acsi / airfield-diagram). Obstruction photos are prefix-scoped only (no entity UUID); email-temp uploads are auth-only.

### Offline PWA + write queue

`lib/sync/write-queue.ts` implements a durable, single-device write queue. `enqueueOrExecute(type, payload, meta)` runs the registered handler inline when online and committed, otherwise persists to storage and returns `{status:'queued'}`. A `drain()` pass (single-flight) walks pending writes oldest-first, respects exponential backoff (`lib/sync/backoff.ts`), and on success fires a `glidepath:write-committed` window event so feature pages re-fetch (Realtime only fires on INSERT, so queued UPDATEs would otherwise be invisible). Failures are classified: `ConflictError` → `'conflict'` status (needs user resolution), `NonRetriableError` or exhausted retries → `'failed'`, everything else → retried. `attach()` wires `online` + `visibilitychange` events to trigger drains.

Network-error sniffing (`lib/sync/handlers.ts`) is necessary because Supabase JS v2 surfaces fetch failures structurally, not as throws — recognized network messages stay transient; other structured errors become `NonRetriableError` (retry won't fix RLS/FK/schema errors). The registered handlers (the modules with offline **write** support) are: `inspection_file`, `check_file`, `acsi_submit`, `daily_review_sign` (with a conflict guard refusing to overwrite an already-signed slot — daily reviews are regulatory records), `airfield_status_update`, `infrastructure_feature_status_update`, `outage_event_create`, `activity_log_insert`, `discrepancy_create`, `inspection_save_draft` (which treats duplicate-key as success). Pending photo uploads queue via `lib/sync/pending-photos.ts`. Workbox runtime caching provides offline **reads** on QRC, PPR, Contractors, Discrepancies, Library, Aircraft, and Waivers.

### Zulu time

All app timestamps render in Zulu (UTC) via helpers in `lib/utils.ts`: `formatZuluTime` (`HHMM`, e.g. `1432`), `formatZuluDate` (`Mon D, YYYY`), `formatZuluDateTime` (date + `HHMMZ`), and `formatZuluDateShort` (`Mon D`). The one deliberate exception is the daily-ops date picker, which uses base-local time. Time inputs use HHMM text fields, never `<input type="time">` (locale forces AM/PM).

### PDF generation + branded email

Every PDF generator runs client-side and returns `{ doc, filename }` (20 generators — see Appendix C). They are never sent to a third party. For distribution, `sendPdfViaEmail()` base64-encodes the document and POSTs to `/api/send-pdf-email`, which sends it through Resend with the branded template. (Operational note: `.mil` recipients quarantine external HTTP links, so emails lead with `mailto:` + PDF attachments rather than `https://` links.)

### Public / kiosk forms

Several routes live outside the authenticated `(app)` group and submit through SECURITY DEFINER RPCs (no login):

- **Public PPR request** — `app/[icao]/ppr-request/page.tsx` (ICAO-addressed) with a legacy `app/ppr-request/[baseId]/page.tsx` shim. Transient aircrew submit a PPR request that lands in the AMOPS triage queue.
- **Public SMS safety report** — `app/[icao]/sms-report/page.tsx` (civilian Part 139): anonymous public safety reporting into the SMS module.
- **Customer feedback QR form** — `app/feedback/[baseId]/page.tsx`: no-login feedback channel for transient aircrew / contractors, with a printable QR code.
- **Kiosk** — gated by a per-base `kiosk_token` minted via `/api/admin/kiosk-token` (24-byte random → base64url; rotate via POST, clear via DELETE; caller needs `base_setup:write` + base membership).

### Base setup wizard

`app/(app)/base-config/setup/page.tsx` is the ~6k-LOC configuration wizard (~15 steps; `/settings/base-setup` redirects here). Steps capture the physical airfield (runways, taxiways, areas, ARFF, facilities — the always-required core), then module-specific setup (NAVAID/lighting, shops, templates, QRC, SCN/AEP agencies, wildlife, status boards, PPR columns, feedback). It includes ICAO lookup and FAA survey-grade coordinate ingestion. Per-step progress is stored in `bases.setup_progress` (`complete`/`skipped`/`in_progress` with attribution) and advanced via `markSetupStep`. Companion config pages: `base-config/modules` (module selector, scoped to airport type), `base-config/diagram` (airfield diagram upload), `base-config/templates`.

### Exports

- **Records Export** (`/settings/exports`, `lib/export/*`) — AF records-disposition and survivability export. `run-export.ts → buildExportFiles(records, opts)` is a pure (network-free) orchestrator: it dispatches each selected module to its builder (uniform table modules, full-form inspections, rich generators for events-log / PPR / SCN, civilian multi-kind SMS/AEP specs, per-record Waivers/ACSI/Training), produces PDF + Excel (per-module + a master workbook) + an optional raw-JSON sidecar + an offline HTML viewer, and tracks per-module record/file counts and "gaps" (selected modules that produced nothing). Output is packaged and downloaded. Gated by `exports:read` / `exports:write`.
- **C2IMERA export** (`lib/export/c2imera-export.ts`) — `exportC2imera({baseId, from, to, unit})` builds a single Excel workbook with Events Log, PPR Log, and Discrepancies sheets for a date range, for the USAF C2IMERA system.
- **QRC export** (`lib/export/qrc-export.ts`) — `exportQrc(...)` produces one Excel workbook with a sheet per active QRC (sheet name = QRC title), each sheet a single "Step Descriptions" column with every step (sub-steps depth-first flattened). Sheet names are sanitized for Excel's name limit and forbidden characters.


## 3. Modules

Glidepath delivers its functionality as per-base modules — enabled per installation and gated by airport type (USAF vs FAA Part 139). Each module below documents its purpose, regulatory basis, data entities, workflows and states, inputs, outputs, and roles.

### Core Operations Modules

This section specifies the day-to-day operational modules that make up the rhythm of airfield management. Each module is gated by the per-base `enabled_modules` set (`lib/modules-config.ts`), the airport-type (`appliesTo`), and the permission matrix (`lib/permissions.ts` `PERM` keys resolved via `user_has_permission` RLS). All operational tables carry `base_id` and are protected by base-scoped, permission-matrix RLS.

---

#### Airfield Checks

- **Purpose** — Captures the recurring, event-driven airfield condition checks that an Airfield Manager performs throughout the day (FOD, runway surface condition, emergency response sweeps, heavy-aircraft, BASH), with photos, location, and signatures, and pushes the operationally significant results (RSC/RCR, BWC) straight onto the live Airfield Status.

- **Applies to** — Both (no `appliesTo`; `defaultEnabled: true`).

- **Regulatory basis** — DAFMAN 13-204 Vol 1–3 (airfield checks / daily operations). Results that set the runway surface condition and bird-watch condition feed the DAFMAN-governed Airfield Status board.

- **Data entities** —

| Table | Key fields |
|---|---|
| `airfield_checks` | `display_id` (`AC-` complete / `DC-` draft), `check_type`, `areas[]`, `data` JSONB (per-type answers), `status` (`draft`\|`completed`), `started_at`, `completed_by`/`completed_at`, `latitude`/`longitude`, `photo_count`, `draft_data` JSONB, `saved_by_name`/`saved_by_id`/`saved_at` |
| `check_comments` | `check_id`, `comment`, `user_name`, `created_at` |
| `photos` | `check_id`, `storage_path`, `thumbnail_path`, `issue_index` (per-issue linking), `mime_type` |

- **Workflows & states** — Two statuses: `draft` and `completed`. `started_at` is set when the user picks a check type (`CheckDraft.startedAt`) so a check can be resumed cross-device. Draft persistence is dual: a manual Save upserts a `draft`-status row (`saveCheckDraftToDb`) with a `DC-` display id, plus a localStorage fallback; `loadCheckDraftFromDb` reloads the most recent draft for the base. Filing (`createCheck`) inserts a `completed` row with an `AC-` display id and records `saved_by_id` for ownership. `fetchChecks` only returns `completed` rows. Deletion (`deleteCheck`) cascades comments, photos, and any `activity_log` rows for the check. The seven configured check types (`CHECK_TYPE_CONFIG` + `CheckType`): `fod` (FOD Check), `rsc` (RSC/RCR Check), `ife` (In-Flight Emergency), `ground_emergency` (Ground Emergency), `heavy_aircraft` (Heavy Aircraft Check), `bash` (BASH Check), `construction` (Construction Check), plus `other`.

- **Inputs** — Check type selection, affected areas, per-type data (e.g. RSC condition Dry/Wet, RCR value + condition code, BASH condition code LOW/MODERATE/SEVERE/PROHIBITED), free-text notes/remarks, GPS coordinates, photos (per issue), and threaded comments.

- **Outputs** — Completed check record + `AC-` id; check PDF via `lib/check-pdf.ts` (`{ doc, filename }`); photos in the `photos` bucket. Side effects: an `rsc` check writes `rsc_condition`/`rcr_*` to `airfield_status`; a `bash` check maps the condition code to a BWC value (`LOW/MOD/SEV/PROHIB`), writes `bwc_value`, and logs a BWC history change for wildlife analytics (`logBwcChange`). Activity logging (AFLD3/{OI} format) is performed by the page.

- **Roles & permissions** — `checks:view` to read, `checks:write` to create/edit, `checks:delete` to remove (`PERM.CHECKS_WRITE`/`CHECKS_DELETE` gate the detail page actions). Photo upload requires `photos:write`.

- **Notable logic / integrations** — Direct writes into `airfield_status` (RSC/RCR/BWC) via `updateAirfieldStatus`; BWC history bridge into the wildlife module; offline-write-queue support (draft + pending photos).

---

#### Inspections

- **Purpose** — Structured daily airfield and lighting inspections that step the inspector through a configured template section-by-section, capturing pass/fail/NA per item and turning failures into trackable discrepancies, satisfying the recurring inspection requirement.

- **Applies to** — Both (`defaultEnabled: true`).

- **Regulatory basis** — DAFMAN 13-204v2 §5.1 (daily airfield inspection). Templates clone from DAFMAN-derived defaults (`AIRFIELD_INSPECTION_SECTIONS`, e.g. "Section 1 — Obstacle Clearance Criteria") and are customized per local OI.

- **Data entities** —

| Table | Key fields |
|---|---|
| `inspections` | `display_id` (`AI`/`LI`/`CM`/`JM`-`YYYY`-suffix), `inspection_type`, `inspector_id`/`inspector_name`, `inspection_date`, `status` (`in_progress`\|`completed`), `items` JSONB, `total_items`/`passed_count`/`failed_count`/`na_count`/`completion_percent`, `construction_meeting`, `joint_monthly`, `personnel[]`, `bwc_value`/`rsc_condition`/`rcr_value`/`rcr_condition`, `weather_conditions`/`temperature_f`, `notes`, `daily_group_id`, `completed_by_*`, `filed_by_*`/`filed_at`, `draft_data` JSONB, `saved_by_*`, `started_at` |
| `photos` | `inspection_id`, `inspection_item_id`, `issue_index` (per-discrepancy), `latitude`/`longitude` |

- **Workflows & states** — Two statuses: `in_progress` and `completed`. Inspection types (`InspectionType`): `airfield`, `lighting`, `construction_meeting`, `joint_monthly`. Lifecycle: draft created (`saveInspectionDraft` / `createInspectionDraftWithId` for the offline queue, with `started_at` + `daily_group_id`) → autosaved as `in_progress` → filed (`fileInspection` sets `status='completed'`, stamps `completed_*`/`filed_*`, and clears `draft_data`/`saved_*`). A completed inspection can be reopened (`reopenInspection` → back to `in_progress`, clears `filed_*`). Hard rule: one airfield + one lighting inspection per day with a 0600L reset (installation timezone); the two halves of a daily inspection share a `daily_group_id` (`fetchDailyGroup`). Cross-user draft isolation: sync skips other users' in-progress inspections. `items[]` carries each item's `response` (`pass`/`fail`/`na`/null), notes, photo links, and optional location.

- **Inputs** — Inspector name (auto-filled "Rank Name"), per-item pass/fail/NA + notes + photos, weather/temperature, BWC/RSC/RCR readings, personnel list, free-text notes; construction-meeting and joint-monthly variants.

- **Outputs** — Filed inspection record; failures become discrepancies (photos linked by `inspection_id`+`issue_index`, then re-FK'd to the new discrepancy). On create/file, BWC/RSC/RCR values are written into `airfield_status` (clearing RCR when only RSC is set). Activity logging handled by the page.

- **Roles & permissions** — `inspections:view`, `inspections:write` (create/edit), `inspections:delete`, and `inspections:file` (finalize). The detail page gates edit/delete on `PERM.INSPECTIONS_WRITE`/`INSPECTIONS_DELETE`.

- **Notable logic / integrations** — Template sections defined per-base (setup step `templates`); `airfield_status` write-through; discrepancy creation with photo re-linking; offline-write-queue (client-supplied UUID so downstream queued writes can FK the row).

---

#### Discrepancies

- **Purpose** — Tracks airfield deficiencies from initial report, through routing to the owning CE shop, through CES work, to AFM verification and closure — the airfield's work-order backbone.

- **Applies to** — Both (`defaultEnabled: true`).

- **Regulatory basis** — DAFMAN 13-204 (airfield discrepancy management / coordination with CE).

- **Data entities** —

| Table | Key fields |
|---|---|
| `discrepancies` | `display_id` (`D-YYYY-suffix`), `type`, `status`, `current_status`, `title`/`description`/`location_text`, `latitude`/`longitude`, `assigned_shop`, `reported_by` (+ `reporter` profile join), `work_order_number` (defaults `'Pending'`), `notam_reference`/`linked_notam_id`, `inspection_id`, `resolution_notes`/`resolution_date`, `estimated_completion_date`, `project_number`, `estimated_cost`, `risk_control_measure`, `facility_number`, `infrastructure_feature_id`, `lighting_system_id`, `photo_count` |
| `status_updates` | `discrepancy_id`, `old_status`/`new_status`, `notes`, `updated_by` (+ profile join), `created_at` — append-only audit trail |
| `photos` | `discrepancy_id`, `storage_path`, `thumbnail_path` |

- **Workflows & states** — Two orthogonal state fields. `status` (`DiscrepancyStatus`): `open` → `completed` / `cancelled` (any-to-any transitions allowed per `ALLOWED_TRANSITIONS`; reaching `completed`/`resolved` stamps `resolution_date`). `current_status` (`CurrentStatus`) is the workflow chain (`CURRENT_STATUS_OPTIONS`): `submitted_to_afm` → `submitted_to_ces` → `awaiting_action_by_ces` → `waiting_for_project` → `work_completed_awaiting_verification`. New discrepancies default to `current_status='submitted_to_afm'`, `status='open'`, `work_order_number='Pending'`. Every `current_status` change inserts an attributed `status_updates` audit row. The "pending verification" badge counts `status='open'` + `current_status='work_completed_awaiting_verification'` (`fetchPendingVerificationCount`).

- **Inputs** — Title, description, location (TWY/RWY/Apron/etc. from `LOCATION_OPTIONS`), one or more types (`DISCREPANCY_TYPES`: FOD Hazard, Pavement, Lighting, Marking, Signage, Drainage, Vegetation, Wildlife, Obstruction, NAVAID, Other — each with a `defaultShop`), assigned shop, NOTAM reference, ECD, project number/cost, risk control measure, facility number, photos, status notes.

- **Outputs** — Discrepancy record + `D-` id; discrepancy PDF (`lib/discrepancy-pdf.ts`); audit-trail notes; auto-routing to a CE shop by type. Auto-created upstream by Inspections (failures) and Visual NAVAIDs (Report Outage).

- **Roles & permissions** — `discrepancies:view`, `discrepancies:write`, `discrepancies:delete`, `discrepancies:close`, `discrepancies:cancel`, `discrepancies:add_note`, `discrepancies:update:resolution_notes`, and the CES-scoped `discrepancies:transition:ces_statuses`. Detail page gates delete on `PERM.DISCREPANCIES_DELETE`.

- **Notable logic / integrations** — Type→shop routing (default shop per type, unmapped → "Airfield Management" dispatcher); CES write path goes through the `ces_update_discrepancy` SECURITY DEFINER RPC (see CES Work Orders); FK links to `infrastructure_features`/`lighting_systems`/`inspections`/NOTAMs; civilian mode can promote a discrepancy into the SMS hazard register (`PERM.SMS_WRITE`).

---

#### CES Work Orders

- **Purpose** — A focused work-order dashboard for Civil Engineering shops to action the discrepancies routed to them, without exposing the full Airfield Management application.

- **Applies to** — Both (`defaultEnabled: true`). `roleRestrictions: ['ces']` — this is the landing module for the `ces` role.

- **Regulatory basis** — Supports the DAFMAN 13-204 AFM↔CE discrepancy workflow.

- **Data entities** — Reads `discrepancies` (filtered to CES-owned states with an `assigned_shop`); writes a narrow field set plus `status_updates` audit rows. Shop list comes from `bases.discrepancy_type_shop_map` JSONB / installation `ceShops`.

- **Workflows & states** — The board shows only `status='open'` discrepancies whose `current_status` is one of `submitted_to_ces`, `awaiting_action_by_ces`, `waiting_for_project`, `work_completed_awaiting_verification`, and that have an `assigned_shop`. Tabs filter by shop with per-shop counts; KPIs split Submitted / In Work / Waiting-for-Project / Awaiting-Verification / Overdue (>30 days open) plus a recently-completed (last 7 days) list. The CES role's status modal is limited to In Work / Project / Work Completed; verification/closure remains with AMOPS.

- **Inputs** — Status transition selection, resolution notes, and an optional free-form note.

- **Outputs** — Updated discrepancy `current_status`/`resolution_notes` and an audit note in `status_updates`.

- **Roles & permissions** — `ces:view` to see the board; the CES write is column-scoped and runs through the `ces_update_discrepancy` SECURITY DEFINER RPC (`cesUpdateDiscrepancy`) because the `ces` role is blocked by the general RLS write gate. The RPC enforces that `current_status` is one of `awaiting_action_by_ces`, `waiting_for_project`, `work_completed_awaiting_verification` and only touches `current_status`, `resolution_notes`, and the audit note (`discrepancies:transition:ces_statuses`).

- **Notable logic / integrations** — SECURITY DEFINER RPC for narrow CES writes; type→shop mapping (`bases.discrepancy_type_shop_map`); flat sidebar / no dropdowns for the CES role; CES sees only Work Orders / Discrepancies / Visual NAVAIDs / Settings.

---

#### Visual NAVAIDs / Infrastructure

- **Purpose** — A mapped inventory of every runway/taxiway light, sign, and visual NAVAID, grouped into lighting systems and components, with an outage engine that automatically detects when failures exceed DAFMAN allowable thresholds and auto-creates the tracking discrepancy.

- **Applies to** — Both (`defaultEnabled: true`).

- **Regulatory basis** — DAFMAN 13-204 Vol 2 Table A3.1 (allowable visual-NAVAID outages); bar-out logic per DAFMAN 13-204v2.

- **Data entities** —

| Table | Key fields |
|---|---|
| `infrastructure_features` | `feature_type` (~23 types: runway/taxiway/threshold/end lights, approach lights, PAPI, REIL, sequenced flasher, bar lights, signs, beacon, windcone, distance markers, etc.), `label`, `latitude`/`longitude`, `layer`, `status`, `system_component_id`, `bar_group_id` |
| `lighting_systems` | per-runway/taxiway system (`name`, system type — ALSF-1/2, SSALR, MALSR, SALS, REIL, edge/centerline/TDZ, taxiway edge, …), precision flag |
| `lighting_system_components` | component breakdown of a system (incl. an `overall` rollup component) used by the outage engine |
| `outage_events` | per-feature outage history (`event_type`, `discrepancy_id`, `notes`) |

- **Workflows & states** — Features carry an operational `status` (operational / `inoperative`). Edit mode lets authorized users place/move/relabel features on the Google Map. Report Outage on a feature: sets `status='inoperative'`, builds a rich display name from system/component context, detects a "bar out" condition when ≥3 lights in a `bar_group_id` are inoperative, auto-creates a `lighting` discrepancy (assigned to "Airfield Management", FK'd via `infrastructure_feature_id`, with an auto-matched facility number), logs an `outage_events` row, then recomputes the component + system outage status and raises an alert if the A3.1 threshold is exceeded or being approached.

- **Inputs** — Feature placement/edit (type, label, location), system/component configuration (setup steps `navaids` + `lighting`), and Report Outage / restore-operational actions.

- **Outputs** — Auto-created discrepancy on outage; `outage_events` history; outage alerts (4-tier); NOTAM template text and Q-codes from the engine; lighting report (`/reports/lighting`).

- **Roles & permissions** — `infrastructure:view`, `infrastructure:write` (edit/report outage — page gates on `PERM.INFRASTRUCTURE_WRITE`), `infrastructure:delete`. The CES role can view this module.

- **Notable logic / integrations** — Cross-cutting **Outage Engine** (`lib/outage-rules.ts`): implements DAFMAN 13-204v2 Table A3.1 allowances per component (percent / count / consecutive / no-adjacent / zero-tolerance), computes per-component and system-rollup `OutageStatus`, the 4-tier `AlertTier` (green/yellow/red/black via `getAlertTier`), bar-out detection (`BAR_INOP_THRESHOLD = 3`), and required actions (NOTAM, notify CE/TERPS, system shutoff). This module is the only page that auto-creates a discrepancy on Report Outage. Google Maps rendering; feature fetch paginates past the 1000-row Supabase cap.

---

#### Aircraft Parking

- **Purpose** — Lets planners draft to-scale aircraft parking diagrams on the airfield map and validates wingtip / taxilane clearances against UFC criteria, for transient or exercise operations.

- **Applies to** — Both (`defaultEnabled: true`).

- **Regulatory basis** — UFC 3-260-01 (Ch. 6 Table 6-1a A/AF wingtip / taxilane clearances; ADG classification Table 3-1).

- **Data entities** —

| Table | Key fields |
|---|---|
| `parking_plans` | `plan_name`, `description`, `is_active`, `is_template`, `created_by`/`updated_by` |
| `parking_spots` | `plan_id`, `spot_name`, `spot_type` (apron/ramp/transient), `aircraft_name`, `tail_number`, `unit_callsign`, `longitude`/`latitude`, `heading_deg`, `clearance_ft`, `status` (occupied/available/reserved), `sort_order` |
| `parking_taxilanes` | `plan_id`, `taxilane_type` (interior/peripheral), `design_aircraft`, `design_wingspan_ft`, `line_coords[]`, `is_transient` |
| `parking_apron_boundaries` | `plan_id`, `polygon_coords[]` |
| `parking_obstacles` | `obstacle_type` (point/building/line/circle), geometry (`width_ft`/`length_ft`/`rotation_deg`/`radius_ft`/`height_ft`/`line_coords`) |

- **Workflows & states** — Plans are persistent (not ephemeral): full CRUD over 5 tables, with one `is_active` plan per base and reusable `is_template` plans. Spots are placed/dragged on the map (multi-select + group drag), aircraft assigned from the silhouette library, and a live clearance overlay flags violations. Spot statuses: occupied / available / reserved.

- **Inputs** — Plan name/description, aircraft + tail/callsign per spot, spot heading and position, taxilanes (type + design aircraft/wingspan + polyline), apron boundary polygons, obstacles.

- **Outputs** — Parking diagram PDF via `lib/parking-pdf.ts` (`generateParkingPdf`) — captures the map through an html2canvas warm-up + capture cycle, with selected-spot scoping; clearance pass/fail annotations.

- **Roles & permissions** — `parking:view`, `parking:write`, `parking:delete`.

- **Notable logic / integrations** — Clearance engine `lib/calculations/parking-clearance.ts` (UFC 3-260-01 Table 6-1a): ADG from wingspan, context-specific wingtip clearances (parked, interior/peripheral taxilane, transient apron), with the 110 ft (33.5 m) large-aircraft threshold. PDF capture pipeline has documented gotchas (warm-up cycle, `position: fixed` resize trick, Mercator icon scale, tilt locked at 0).

---

#### Shift Checklist

- **Purpose** — A per-shift turnover checklist that gives AMOPS personnel per-task accountability across Day / Swing / Mid shifts, with daily / weekly / monthly cadence and a clean daily reset.

- **Applies to** — Both (`defaultEnabled: true`).

- **Regulatory basis** — DAFMAN 13-204 (shift operations / turnover).

- **Data entities** —

| Table | Key fields |
|---|---|
| `shift_checklist_items` | template item: `label`, `shift` (`day`/`mid`/`swing`), `frequency` (`daily`/`weekly`/`monthly`), `sort_order`, `is_active` |
| `shift_checklists` | per-day instance: `checklist_date`, `status` (`in_progress`\|`completed`), `completed_by`/`completed_at` |
| `shift_checklist_responses` | per-item: `checklist_id`, `item_id`, `completed`, `is_na`, `completed_by`/`completed_at`, `notes` |

- **Workflows & states** — `fetchOrCreateTodayChecklist` resolves the current checklist for the base using the installation timezone + `checklist_reset_time` (default 0600L). Items are filtered to those that apply today (`itemAppliesToday` evaluates the weekly/monthly frequency against the reset day) and grouped by shift. Each item is a 3-state toggle — not done / done / N/A — persisted per response (`upsertResponse`). The checklist can be completed (`completeChecklist`) and reopened (`reopenChecklist`). History is browsable per past day.

- **Inputs** — Per-item toggle (done / N/A) and optional notes; admin-configured template items (setup step `shiftchecklist`).

- **Outputs** — Per-day completion record with per-item attribution; history view.

- **Roles & permissions** — `shift_checklist:view`, `shift_checklist:write`.

- **Notable logic / integrations** — Timezone-aware 0600L reset; frequency engine for weekly/monthly recurrence; per-response profile name resolution ("Rank Name").

---

#### NOTAMs

- **Purpose** — Surfaces the live FAA NOTAM feed for the base's ICAO so the team can see active and expired NOTAMs in-app, without maintaining a parallel local NOTAM store.

- **Applies to** — Both (`defaultEnabled: true`).

- **Regulatory basis** — DAFMAN 13-204 (NOTAM awareness); data sourced from the FAA NOTAM Search service.

- **Data entities** — No persistent NOTAM table for the live feed. The sync route returns normalized in-memory NOTAM objects: `notam_number`, `source: 'faa'`, `status` (`active`/`expired`), `notam_type`, `title`, `full_text`, `effective_start`, `effective_end`. (Discrepancies may reference a NOTAM via `notam_reference`/`linked_notam_id`.)

- **Workflows & states** — `GET /api/notams/sync?icao=KXXX` POSTs to the FAA public NOTAM Search backend (`notams.aim.faa.gov`, no API key), validates the 3–4 letter ICAO, and is rate-limited per IP (120/hour, fails open) to protect the upstream. Each item is normalized; expiry is derived by parsing the FAA `MM/DD/YYYY HHMM` end date (or `PERM`) against now, also honoring the FAA `cancelledOrExpired` flag → `status` is `active` or `expired`. The page filters active vs expired. There is no "Add Local NOTAM" workflow — the feed is FAA-only.

- **Inputs** — Base ICAO (from installation config); active/expired filter.

- **Outputs** — Rendered live NOTAM list; 5-minute server cache on the FAA fetch.

- **Roles & permissions** — `notams:view` (read). `notams:write`/`notams:cancel` keys exist in the matrix but the live feed is read-only.

- **Notable logic / integrations** — External FAA NOTAM Search integration; Postgres-backed rate limiter (`lib/rate-limit.ts`); `use-expiring-notams` hook for expiry awareness.

---

#### Field Conditions / TALPA

- **Purpose** — Lets civilian Part 139 airports issue auditable, per-third runway condition reports (RwyCC) whenever surface conditions degrade, and generates the FICON NOTAM text for the FAA NOTAM Manager.

- **Applies to** — FAA Part 139 only (`appliesTo: ['faa_part139']`, `defaultEnabled: true`). Replaces ad-hoc winter spreadsheets.

- **Regulatory basis** — 14 CFR §139.313, AC 150/5200-30D (TALPA / Runway Condition Assessment Matrix).

- **Data entities** —

| Table | Key fields |
|---|---|
| `field_condition_reports` | `runway_id`, `generated_at`/`generated_by`/`generated_by_oi`, `valid_until`, `temperature_f`, `treatments[]`, `conditions_unchanged_since`, `superseded_by_id` (revision chain), `notes`, `ficon_text` (materialized at insert) |
| `field_condition_thirds` | `report_id`, `third`, `contaminant`, `depth_in`, `coverage_percent`, `rwycc`, `rwycc_derived`, `rwycc_manual_override`, `override_reason`, `sort_order` |

- **Workflows & states** — Reports are append-only. Each runway has at most one active FCR; revising a report is **always** a new superseding row, and UPDATE is reserved for back-filling `superseded_by_id` on the prior row. Per third (touchdown / midpoint / rollout), the operator selects a contaminant + depth + coverage and the engine derives the RwyCC code; the operator may override the derived code with a required reason. `ficon_text` is built and stored at insert (no recompute on read). The page shows active reports per runway plus a trailing 30-day Zulu-dated history; the New Report modal is a single screen tuned for cold-weather gloved entry.

- **Inputs** — Runway, per-third contaminant / depth / coverage / optional RwyCC override + reason, temperature, treatments, valid-until, notes.

- **Outputs** — Active FCR card + per-third RwyCC matrix; FICON NOTAM text for the FAA NOTAM Manager; CSV export.

- **Roles & permissions** — `field_conditions:read`, `field_conditions:write` (page gates write actions on `PERM.FIELD_CONDITIONS_WRITE`).

- **Notable logic / integrations** — RwyCC engine `lib/calculations/rwycc.ts` (`deriveRwycc`, `buildFiconNotamText`, contaminant/treatment/third dictionaries); operating-initials capture on the actor; activity logging.

### Compliance Modules

This section specifies the nine compliance modules of Glidepath. Each module is gated by `enabled_modules` on the base and by the permission matrix (`lib/permissions.ts`, `PERM` keys). Module airport-type applicability is declared in `lib/modules-config.ts` via `appliesTo` (defaults to both USAF and FAA Part 139 when omitted). All operational tables carry `base_id UUID REFERENCES bases(id)` and Row-Level Security keyed on `user_has_base_access(uid, base_id)` plus `user_has_permission(uid, '<resource>:<action>')`. PDF generators return `{ doc, filename }`.

---

#### ACSI (Annual Compliance)

**Purpose**
Airfield Compliance and Safety Inspection — the annual airfield inspection per DAFMAN 13-204v2 Para 5.4.3. A multi-section checklist that records pass/fail/N-A per item, captures discrepancies (with photos, risk-control measures, and project/work-order tracking) on failed items, builds an inspection team roster, and collects risk-management certification signatures.

**Applies to**
USAF (`appliesTo: ['usaf']`).

**Regulatory basis**
DAFMAN 13-204 Vol 2, Para 5.4.3. The bundled checklist (`ACSI_CHECKLIST_SECTIONS` in `lib/constants.ts`) cites per-section references: UFC 3-260-01, UFC 3-260-03, TSPWG M 3260-01.09-2, AFMAN 32-1041, AFI 32-1015, AFH 32-7084, and the HQ AFCEC pavement evaluation/PCI/friction reports.

**Data entities**

| Table | Key fields |
|---|---|
| `acsi_inspections` | `display_id` (`ACSI-YYYY-XXXX`), `base_id`, `airfield_name`, `inspection_date`, `fiscal_year`, `status` (AcsiStatus), `items` JSONB (`AcsiItem[]`), `total_items`/`passed_count`/`failed_count`/`na_count`, `inspection_team` JSONB (`AcsiTeamMember[]`), `risk_cert_signatures` JSONB (`AcsiSignatureBlock[]`), `notes`, `draft_data` JSONB, `inspector_id`/`inspector_name`, `completed_*`, `filed_*`, `saved_*` audit columns |
| `photos` | ACSI photos via `acsi_inspection_id` (+ `acsi_item_id`, which encodes `{itemId}:{discIndex}` for per-discrepancy linking); discrepancy detail rows reference photos by `photo_ids[]` |

`AcsiItem` = `{ id, section_id, item_number, question, response: 'pass'|'fail'|'na'|null, discrepancy, discrepancies[] }`. `AcsiDiscrepancyDetail` carries `comment`, `work_order`, `project_number`, `estimated_cost`, `estimated_completion`, `risk_control_measure` (required on N items), `photo_ids[]`, `areas[]`, `pins[]`, and an optional `linked_discrepancy_id`.

**Workflows & states**
`AcsiStatus = 'draft' | 'in_progress' | 'completed' | 'staffed'`. Lifecycle: create draft (`saveAcsiDraft` inserts with status `draft`) → autosave/resume across devices (`draft_data` JSONB + `loadAcsiDraftFromDb`, latest draft by `saved_at`) → file (`fileAcsiInspection` sets `completed`, stamps `completed_*`/`filed_*`, clears `draft_data`). Filed inspections can be reopened (`reopenAcsiInspection` → `in_progress`, rebuilds `draft_data` from filed items). `staffed` is a post-completion state (treated as filed alongside `completed`). The list page filters by `all|draft|in_progress|completed|staffed`.

**Inputs**
Per-item Y/N/N-A responses; discrepancy details on failures (comment, areas, map pins, work order, project number, cost, ECD, risk-control measure, photos); inspection team members (role/name/rank/title, optional `signature_required`); risk-cert signature blocks (label/org/name/rank/title); general notes.

**Outputs**
`generateAcsiPdf` (`lib/acsi-pdf.ts`) — letter-portrait report: header (`AIRFIELD COMPLIANCE & SAFETY INSPECTION`, DAFMAN cite), info box, KPI summary, per-section checklist tables with parent/sub-field rows and inline discrepancy detail rows (text + embedded photo thumbnails resolved from `photo_ids` and `acsi_inspection_id`), Inspection Team signature blocks, Risk Management Certification blocks, and General Notes. Activity-log events on reopen. Offline submit drains via the write queue (`acsi_submit`).

**Roles & permissions**
`ACSI_VIEW` (`acsi:view`), `ACSI_WRITE` (`acsi:write`), `ACSI_DELETE` (`acsi:delete`), `ACSI_FILE` (`acsi:file`). Page gating: edit/reopen requires `acsi:write` or being the filer (`filed_by_id`/`saved_by_id`/`inspector_id`); delete requires `acsi:delete`, or `acsi:write` on a non-filed record, or filer on a non-filed record.

**Notable logic / integrations**
Sub-field items (`5.5.1.a`/`.b`/`.c`) render as indented rows under a synthesized parent header in both the form and the PDF. Photos resolve by ID in a single round-trip and fall back to `fetchAcsiPhotos`. The Records Export passes `skipPhotos` so it renders text-only and embeds images in its own photo phase.

---

#### Obstructions

**Purpose**
Evaluate a point obstruction against airfield imaginary surfaces and (taxiway) object-free areas, returning per-surface clearance/violation with the controlling surface, max allowable height (MSL/AGL), penetration, and a verifiable calculation breakdown. Persists evaluations with photos and a NOTAM-ready bearing/distance reference.

**Applies to**
Both (USAF + FAA Part 139). Surface set is selectable per evaluation: `ufc_3_260_01` (UFC) or `faa_part77` (civilian); the default comes from the base mode (`getSurfaceSet`).

**Regulatory basis**
UFC 3-260-01, Chapter 3 & Appendix B (imaginary surfaces, clear zone, graded area, primary, approach-departure, etc.); DoD Instruction 4165.57 (APZ I/II land-use zones); 14 CFR §77.19 (FAA Part 77 civilian surfaces). The cross-cutting engine lives in `lib/calculations/obstructions.ts` (with `geometry.ts`, `surface-criteria.ts`, `taxiway-criteria.ts`) — geodesic, multi-runway, runway-class aware (`B` / `Army_B`); this spec references it rather than re-deriving the math.

**Data entities**

| Table | Key fields |
|---|---|
| `obstruction_evaluations` | `display_id` (`OBS-YYYY-XXXX`), `base_id`, `runway_class`, `surface_set` (pinned at create-time), `object_height_agl`, `object_distance_ft`/`distance_from_centerline_ft`, `object_elevation_msl`, `obstruction_top_msl`, `latitude`/`longitude`, `description`/`notes`, `photo_storage_path` (JSON array string), `results` JSONB (per-surface, per-runway), `controlling_surface`, `violated_surfaces[]`, `has_violation`, `evaluated_by` |

**Workflows & states**
No status enum — each row is a completed evaluation (boolean `has_violation`). Flow: select point on the Google map (or "Use My Location") → fetch ground elevation → enter height + description + photos → pick surface set → Evaluate (`evaluateObstructionAllRunways` + `evaluateObstructionTaxiways`) → Save (`createObstructionEvaluation`) or Update (`updateObstructionEvaluation`, surface set locked in edit mode). History list at `/obstructions/history`; detail at `/obstructions/[id]`.

**Inputs**
Map point/GPS coordinate, obstruction height (ft AGL), description, photos, surface-set selection. Ground elevation auto-fetched (falls back to base elevation).

**Outputs**
On-screen per-runway and per-taxiway surface analysis (CLEAR / VIOLATION / WITHIN ZONE / WITHIN OFA), controlling-surface banner, NOTAM reference (NM + cardinal bearing from nearest threshold), and a PDF via `lib/obstruction-pdf.ts`. Saving a violation writes an activity-log event.

**Roles & permissions**
`OBSTRUCTIONS_VIEW` (`obstructions:view`), `OBSTRUCTIONS_WRITE` (`obstructions:write`), `OBSTRUCTIONS_DELETE` (`obstructions:delete`).

**Notable logic / integrations**
Surface set is persisted per evaluation so the detail-page legend stays accurate even if the base later flips `obstruction_surface_set`. Photos are compressed to data URLs (or uploaded to the `photos` bucket via `uploadObstructionPhoto`, `obstruction-photos/` prefix-scoped). Per-runway `faa_approach_type` drives Part 77 dimensions.

---

#### Wildlife / BASH

**Purpose**
Capture wildlife sightings and bird/wildlife strikes, track the Bird Watch Condition (BWC), and surface trend analytics and a BASH heatmap for the Bird/Wildlife Aircraft Strike Hazard program.

**Applies to**
Both (USAF + FAA Part 139).

**Regulatory basis**
DAFMAN 91-212 (BASH program); strike fields align with USAF/FAA strike reporting conventions.

**Data entities**

| Table | Key fields |
|---|---|
| `wildlife_sightings` | `display_id` (`WS-XXXX`), `species_common`/`species_scientific`/`species_group`, `size_category`, `count_observed`, `behavior`, lat/lng + `location_text`/`airfield_zone`, `observed_at`, `time_of_day`, `sky_condition`/`precipitation`, `bwc_at_time`, `action_taken`/`dispersal_method`/`dispersal_effective`, `observed_by`(+id), `check_id`/`inspection_id`/`discrepancy_id` cross-links, `photo_count`, `notes` |
| `wildlife_strikes` | `display_id` (`WX-XXXX`), species fields, `number_struck`/`number_seen`, lat/lng, `strike_date`, `aircraft_type`/`aircraft_registration`/`engine_type`, `phase_of_flight`, `altitude_agl`/`speed_ias`, `pilot_warned`, `parts_struck[]`/`parts_damaged[]`, `damage_level`, `engine_ingested`/`engines_ingested[]`, `flight_effect`, `repair_cost`/`other_cost`/`hours_out_of_service`, `remains_collected`/`remains_sent_to_lab`/`lab_identification`, `reported_by`(+id), `sighting_id` link, `photo_count`, `notes` |
| `bwc_history` | `bwc_value`, `set_at`, `set_by`, `source`/`source_id`, `notes` |

**Workflows & states**
No formal status enum. Sightings and strikes are append-only logs (CRUD with create/fetch/update/delete). BWC changes are appended to `bwc_history` (`logBwcChange`). Sightings can be promoted/linked to strikes (`sighting_id` on the strike). Both can be created in-line from checks/inspections (cross-link FK columns). Filters by date range, species, zone, damage level.

**Inputs**
Species (common/scientific/group/size), counts, observation conditions, location (map pin + zone), behavior/action/dispersal effectiveness; for strikes: aircraft + flight data, parts struck/damaged, damage level, ingestion, costs, remains/lab disposition.

**Outputs**
Analytics (`fetchWildlifeAnalytics`: totals, top species, sightings/strikes by month, species-group breakdown, dispersal effectiveness); heatmap point feed (`fetchHeatmapData`, strikes weighted ×3) rendered on the Mapbox BASH heatmap (the one remaining Mapbox map); activity-log events on create. WHMP draws on this capture for its annual narrative.

**Roles & permissions**
`WILDLIFE_VIEW` (`wildlife:view`), `WILDLIFE_WRITE` (`wildlife:write`), `WILDLIFE_DELETE` (`wildlife:delete`).

**Notable logic / integrations**
Deleting a sighting/strike also clears its `activity_log` rows by `entity_id`. The `/wildlife/whmp` sub-route (Part 139) is the annual plan layer over this capture (see WHMP).

---

#### Waivers

**Purpose**
Manage airfield criteria waivers (AF Form 505) across their full lifecycle: classification, hazard rating, criteria impact, multi-office coordination, attachments, and annual review with facilities-board tracking.

**Applies to**
Both (USAF + FAA Part 139).

**Regulatory basis**
AF Form 505 (Request for Waiver). Criteria sources reference UFC 3-260-01, UFC 3-260-04, UFC 3-535-01.

**Data entities**

| Table | Key fields |
|---|---|
| `waivers` | `waiver_number` (`{P/T/C/E/X/A}-CODE-YY-XXXX`), `classification`, `status`, `hazard_rating`, `action_requested`, `description`/`justification`/`risk_assessment_summary`/`corrective_action`/`criteria_impact`, `proponent`, `project_number`/`program_fy`/`estimated_cost`/`project_status`, `faa_case_number`, `period_valid`, `date_submitted`/`date_approved`/`expiration_date`, `last_reviewed_date`/`next_review_due`, location (`location_description`/lat/lng), `photo_count`/`attachment_count`, `created_by`/`updated_by` |
| `waiver_criteria` | `criteria_source` (`ufc_3_260_01`/`ufc_3_260_04`/`ufc_3_535_01`/`other`), `reference`, `description`, `sort_order` |
| `waiver_attachments` | `file_path` (`waiver-attachments` bucket), `file_name`, `file_type` (photo/site_map/risk_assessment/ufc_excerpt/faa_report/coordination_sheet/af_form_505/other), `caption`, `uploaded_by` |
| `waiver_reviews` | `review_year`, `review_date`, `reviewed_by`, `recommendation`, `mitigation_verified`, `project_status_update`, `presented_to_facilities_board`/`facilities_board_date` |
| `waiver_coordination` | `office` (civil_engineer/airfield_manager/airfield_ops_terps/base_safety/installation_cc/other), `office_label`, `coordinator_name`, `coordinated_date`, `status` (pending/concur/non_concur), `comments` |

**Workflows & states**
`WaiverClassification = permanent | temporary | construction | event | extension | amendment`. `WaiverStatus = draft | pending | approved | active | completed | cancelled | expired`. `updateWaiverStatus` stamps `date_submitted` on `pending` and `date_approved` (+ optional `expiration_date`) on `approved`. `WaiverHazardRating = low | medium | high | extremely_high`. Annual review: creating a `waiver_reviews` row sets the waiver's `last_reviewed_date` and `next_review_due` (= `{review_year+1}-02-01`); the annual-review page is keyed by year (`/waivers/annual-review/[year]`). Coordination + criteria are managed as delete-then-reinsert batches.

**Inputs**
Classification, description, justification, risk assessment, corrective action, criteria impact + criteria rows, hazard rating, project/cost/FY, FAA case number, validity period, location, attachments, coordination per office, annual review recommendation + facilities-board status.

**Outputs**
`lib/waiver-pdf.ts` (AF Form 505-style waiver document). Annual-review roll-up by year. Auto-generated `waiver_number` from classification prefix + installation code + 2-digit year.

**Roles & permissions**
`WAIVERS_VIEW` (`waivers:view`), `WAIVERS_WRITE` (`waivers:write`), `WAIVERS_DELETE` (`waivers:delete`), `WAIVERS_REVIEW` (`waivers:review`).

**Notable logic / integrations**
`WaiverReviewRecommendation = retain | modify | cancel | convert_to_temporary | convert_to_permanent`. Records Export pulls all criteria/reviews/coordination/attachments per base via the `fetchAll*` joins (avoid N+1).

---

#### Contractors / Personnel on Airfield

**Purpose**
Log personnel and contractors operating on the airfield with escort/credential tracking and credential-expiry warnings. The credential field is the on-airfield paperwork reference: AF Form 483 on USAF airfields, SIDA badge on civilian Part 139 (label resolved by `getTerm('form_483', …)`).

**Applies to**
Both (USAF + FAA Part 139).

**Regulatory basis**
AF Form 483 (Personnel on Airfield); civilian SIDA badge equivalent.

**Data entities**

| Table | Key fields |
|---|---|
| `airfield_contractors` | `company_name`, `contact_name`/`contact_phone`, `location`, `work_description`, `status` (`active`/`completed`), `start_date`/`end_date`, `radio_number`/`flag_number`/`callsign`, `af_form_483`/`af_form_483_expiration`, `notes`, `created_by` |
| `bases.contractor_templates` | JSONB array of reusable contractor templates (name/company/contact/callsign/notes/AF 483 + expiration/phone) shared across base users |

**Workflows & states**
Two-state lifecycle: `active` | `completed`. Create/edit via the on-page form; reusable templates persist to `bases.contractor_templates` (read-then-write to avoid clobbering concurrent edits). Filter tabs: `active | all | completed`. Active list ordered by start date.

**Inputs**
Company, point of contact + phone, work location, work description, start date, radio/flag/callsign, AF Form 483 number + expiration, notes.

**Outputs**
`generatePersonnelPdf` (`lib/personnel-pdf.ts`, landscape) — "PERSONNEL ON AIRFIELD" roster with active/completed/total stat boxes and a credential column whose header switches between "AF Form 483" and "SIDA Badge" by airport type; expiry annotated inline (`(EXPIRED Nd)` / `(exp Nd)` within 30 days). Email distribution via `sendPdfViaEmail`.

**Roles & permissions**
`CONTRACTORS_VIEW` (`contractors:view`), `CONTRACTORS_WRITE` (`contractors:write`), `CONTRACTORS_DELETE` (`contractors:delete`).

**Notable logic / integrations**
Credential-expiry computed client-side (`af483Status`). The module title stays "Personnel on Airfield" (broader than credentialed contractors); only the credential field carries the form/badge label.

---

#### AMTR (Airfield Management Training Record)

**Purpose**
The electronic Airfield Management Training Record for 1C7X1 personnel: a unit roster plus a per-member record covering AF Forms 623A / 797 / 803 / 1098, the JQS-CFETP, QTP/PCG milestones, formal courses, qualifications, and Ready Airman Training. Role-based hierarchical signatures, an auto-generated multi-stage 623A, per-base configurable catalogs with standard-catalog sync, supporting-file uploads, AFFSA Excel import, transcription, and due-date notifications.

**Applies to**
USAF (`appliesTo: ['usaf']`).

**Regulatory basis**
DAFI 36-2670, CFETP 1C7X1; AF Forms 623A, 797, 803, 1098. Bundled standard catalogs are versioned (`CATALOG_VERSION = '2026.06 (1C7X1)'`).

**Data entities**

| Table | Key fields / purpose |
|---|---|
| `amtr_members` | roster: `full_name`, `grade`, `dafsc`, `unit`, `installation`, `date_assigned`, `status` (`Active`/`Reserve`/`Guard`/`Civilian`/`Contractor`/`Separated`), `tsc`, `duty_position`, `supervisor`/`utm`/`commander`, `user_id` link |
| `amtr_member_exclusions` | base users excluded from auto-roster sync |
| `amtr_role_assignments` | the AMTR role layer: `user_id` + `role` (`trainee`/`trainer`/`certifier`/`namt`/`afm`) |
| `amtr_623a` | DAF 623A entries with `source_table`/`source_row_id` (auto-623A link) + trainee/trainer/namt/afm signature slots |
| `amtr_797`, `amtr_803`, `amtr_jqs_progress`, `amtr_1098_progress`, `amtr_milestone_progress` | per-member signable progress tables |
| `amtr_rat_progress`, `amtr_qual_progress`, `amtr_formal_progress` | per-member RAT / qualification / formal-course progress |
| Catalogs (per base): `amtr_jqs_catalog`, `amtr_1098_catalog` (per-year via `amtr_1098_years`/`year_label`), `amtr_formal_catalog`, `amtr_rat_catalog`, `amtr_milestone_catalog`, `amtr_inspection_checklist`, `amtr_623a_entry_types`, `amtr_623a_comment_templates`, `amtr_803_catalog`, `amtr_qual_catalog` | base-editable training reference catalogs (`managed` flag) |
| `amtr_catalog_version` | the standard-catalog version a base is synced to |
| `amtr_files` | supporting-document metadata (`amtr-files` private bucket, path `{member_id}/{ts}-{name}`); `document_title`, `document_date`, `status` |
| `amtr_notifications` | per-recipient due/sign-off notifications (deduped on `recipient_user_id,dedupe_key`) |
| `amtr_audit_log` | per-action audit trail (actor/action/table/row/detail) |

**Workflows & states**
Member status enum above. Roster auto-populates from the base's airfield-management personnel (`syncAmtrRosterFromBase`, eligibility via `isAmtrRosterRole`, skipping excluded/already-present users; requires `amtr:write`). The member record is tabbed: Cover, JQS-CFETP, DAF 1098, RAT, DAF 623A, DAF 797, Qualifications, Formal Training, DAF 803, Milestones, Files, History (RAT tab hidden for Contractor/Civilian/Separated).

Signing is the core lifecycle. The **AMTR role layer** is separate from app-permissions: app-perms decide module access; AMTR roles decide what you can do inside a record. Authority is hierarchical and per-block — `trainee→trainee`, `trainer→trainer`, `certifier→{trainee,trainer,certifier}`, `namt→{…,namt}`, `afm→all` (`SLOT_AUTHORITY`). On your **own** record you may only ever sign the Trainee block (self-certification guard). The `evaluator` slot (DAF 803) is granted to any non-trainee role. NAMT/AFM may enter data on their own record (one-person-shop carve-out) but still only sign Trainee. NAMT/AFM may reopen locked blocks (`amtr_reopen`). Signatures lock per block once present (`locked_at`).

**Auto-623A multi-stage flow** (`components/amtr/auto-623a-dialog.tsx`): a sign-off against a source row (1098/JQS/797/803/milestone) opens the dialog, which finds-or-creates the matching `amtr_623a` row (by `source_table`+`source_row_id`), shows prior signers' comments read-only, and locks the current signer's slot via the `amtr_sign` RPC. Trainee → trainer → (if the source requires certification, e.g. JQS `core_cert` contains `^`, or 1098 always) certifier into the 623A NAMT slot. AFM endorsement remains a manual 623A-tab action. Slot mapping: certifier/namt → 623A `namt`; evaluator → 623A `trainer`.

**Inputs**
Member demographics; per-task completion dates + signatures; 623A comments (templated, with DAFMAN `cite` triples); file uploads (title + document date); AFFSA workbook import; JSON round-trip import/export; transcription (bulk back-dated stamping).

**Outputs**
`generateAmtrRosterPdf` (`lib/amtr-pdf.ts`, landscape unit roster: JQS %, Formal %, recurring status, KPIs) and `generateAmtrInspectionPdf` (`lib/amtr-inspection-pdf.ts`, per-member record-inspection report). Notifications + audit log. Records Export inclusion.

**Roles & permissions**
App-perms: `AMTR_VIEW` (`amtr:view`), `AMTR_WRITE` (`amtr:write`), `AMTR_DELETE` (`amtr:delete`), `AMTR_MANAGE` (`amtr:manage`), `AMTR_EXPORT` (`amtr:export`). View gates the module; users with a non-trainee AMTR role or `amtr:manage` see the whole roster, others see only their own record. Catalog editing is gated on the NAMT/AFM AMTR role or `amtr:manage`.

**Notable logic / integrations**
Catalog seeding (`seedBaseCatalogs`) adopts the bundled 1C7X1 catalogs per base, skipping any catalog that already has rows and tagging the 1098 catalog with the current year. Version-aware **standard-catalog sync** (`CATALOG_SYNC_META` natural keys + synced field lists) diffs bundled-or-uploaded catalogs against the base's current rows (added/updated/retired with samples) before applying — JQS `required`/`training_refs` are deliberately not synced so NAMT edits survive re-uploads. The signature RPCs (`amtr_sign`, `amtr_transcribe`, `amtr_reopen`) enforce authority + self-cert guards server-side. The `amtr_*` tables are not in the generated DB types, so CRUD routes through an untyped client.

---

#### Safety Management System (SMS)

**Purpose**
A full FAA Part 139 Safety Management System: Safety Policy, a hazard register with 5×5 risk matrix and mitigations, Safety Performance Indicators with target/warning/alert bands, internal audits, Management of Change, and anonymous public safety reporting — surfaced through an Accountable Executive dashboard.

**Applies to**
FAA Part 139 (`appliesTo: ['faa_part139']`).

**Regulatory basis**
14 CFR §§139.401–415 (Part 139 SMS Final Rule); AC 150/5200-37A four pillars (Policy, Safety Risk Management, Safety Assurance, Safety Promotion).

**Data entities**

| Table | Key fields / status enum |
|---|---|
| `sms_policies` | versioned policy; `status` = `draft`/`active`/`superseded`/`retired`; effective + review-due dates; signature |
| `sms_safety_objectives` | objectives under the active policy |
| `sms_hazards` | `status` = `open`/`under_review`/`controlled`/`closed`/`duplicate`; `source_type`; `current_band`/`residual_band` (`low`/`medium`/`high`/null) |
| `sms_risk_assessments` | `likelihood` + `severity` (1–5 each), rationales, residual L/S + band |
| `sms_mitigations` | `status` = `planned`/`in_progress`/`completed`/`rejected`/`superseded`; control type; due date; evidence |
| `sms_spis` | safety performance indicators with target/warning/alert thresholds |
| `sms_spi_measurements` | periodic readings; `status` = `on_target`/`warning`/`alert`/`no_data` |
| `sms_audits` | `status` = `scheduled`/`in_progress`/`completed`/`closed`/`canceled`; findings (severity low/med/high, open/closed) |
| `sms_mocs` | Management of Change; `status` = draft … `approved`/`rejected`/`implemented`/`closed` |
| `sms_safety_reports` | public/anonymous reports; `category`; `triage_status` |
| `sms_communications` | safety-promotion communications |

**Workflows & states**
Policy is single-active, versioned via supersession. Hazards move open → under_review → controlled → closed (closure auto-stamps `closed_at`). Risk is assessed L×S (1–5), `classifyRiskBand` maps the product to low/medium/high; mitigations drive residual band and auto-stamp completion. SPIs are measured per period and auto-classified into bands. MOCs require an approval step (`sms:approve_moc`). Public reports land for triage (`sms:triage_reports`).

**Inputs**
Policy text + signature; hazards + 5×5 assessments + mitigations; SPI definitions + measurements; audits + findings; MOC requests; public report intake (anonymous, no login).

**Outputs**
AE dashboard (policy currency, hazards-by-band, SPIs in alert/warning, open/pending MOCs, reports to triage); one-click **SMS Manual PDF** (`lib/sms-pdf.ts`, `buildSmsManualPdf`) aggregating policy/hazards/assessments/mitigations/SPIs/measurements/audits/MOCs/reports for FAA cert-inspector visits; public report URL `/{icao}/sms-report`.

**Roles & permissions**
`SMS_READ` (`sms:read`), `SMS_WRITE` (`sms:write`), `SMS_SIGN_POLICY` (`sms:sign_policy`), `SMS_APPROVE_MOC` (`sms:approve_moc`), `SMS_TRIAGE_REPORTS` (`sms:triage_reports`). Sub-pages: `/sms/policy`, `/hazards`, `/spis`, `/audits`, `/moc`, `/reports`, `/communications`.

**Notable logic / integrations**
WHMP findings deep-link into the SMS hazard register (`/sms/hazards/new` prefill). AEP drill completions feed SMS SPIs. Public submit uses a SECURITY DEFINER RPC; the public endpoint is rate-limited.

---

#### Training (§139.303)

**Purpose**
§139.303 personnel-training records: a topic catalog (the 13 mandatory topics seeded system-wide plus base-custom topics), per-user completion records with stored expiry and 24-month retention, AAAE/ACE professional certificates, a compliance matrix, and an expiry digest.

**Applies to**
FAA Part 139 (`appliesTo: ['faa_part139']`). A USAF base can opt in per-topic, but AMTR remains the canonical 1C7X1 record.

**Regulatory basis**
14 CFR Part 139 §139.303 (and §139.303(e) — the 13 topics; 24-month record retention).

**Data entities**

| Table | Key fields |
|---|---|
| `training_topics` | `base_id` NULL = system seed; `code` (e.g. `139.303(e)(5)`), `title`, `source`, `applies_to[]`, `initial_required`, `recurrent_frequency_months`, `retention_months` (default 24), `material_url`, `active`, `sort_order` |
| `training_records` | append-only completion log: `user_id`, `topic_id`, `completed_at`, `training_type` (`initial`/`recurrent`/`remedial`), `instructor_user_id`/`instructor_name_external`, `evidence_url`, `expires_at` (set by trigger from topic frequency), `notes` |
| `training_renewals` | explicit supersession chains (`previous_record_id` → `renewed_record_id`) |
| `training_certificates` | professional credentials: `credential` (`AAAE-CM`/`ACE-Ops`/`ACE-Comm`/`ACE-Sec`/`ACE-WHC`), `issued_at`, `expires_at` (NULL = lifetime), `certificate_url` |

**Workflows & states**
`TrainingStatus = current | expiring | expired | not_started`, derived by `classifyTrainingStatus` from the latest record's `expires_at`: >90 d = current, 30–90 d = expiring, <30 d or past = expired, no record = not_started (a record with no expiry = one-time training stays current). Records are append-only; renewals link supersessions. The landing page (`/training`) links Topics, Roster, and Compliance Matrix sub-pages.

**Inputs**
Topic catalog edits (frequency/retention/material); per-user training completions (date, type, instructor, evidence); professional certificate entries.

**Outputs**
Roster (current/expiring/overdue per user), users × topics compliance matrix, CSV/PDF roster export (`lib/training-part139-pdf.ts`, `lib/training-pdf.ts`) for FAA inspections, and a 30-day expiry digest. Activity-log events.

**Roles & permissions**
`TRAINING_PART139_READ` (`training_part139:read`), `TRAINING_PART139_WRITE` (`training_part139:write`), `TRAINING_PART139_EXPORT` (`training_part139:export`).

**Notable logic / integrations**
The 13 §139.303(e) topics seed as system rows (`base_id` NULL) on every civilian base; base-custom topics layer on top with per-base overrides (frequency/retention). The `/training` slug is the §139.303 module on civilian bases (distinct from `/help` Help & Training).

---

#### WHMP (Wildlife Hazard Management Plan)

**Purpose**
The annual Wildlife Hazard Management Plan artifact per FAA Part 139: a versioned WHMP record with FAA acceptance, Accountable-Executive sign-off, an annual-review cadence, a hazardous-species register, a mitigation summary, and findings that deep-link into the SMS hazard register.

**Applies to**
FAA Part 139 (`appliesTo: ['faa_part139']`).

**Regulatory basis**
14 CFR §139.337; AC 150/5200-33C; AC 150/5200-32B. (§139.337(c) annual-review obligation.)

**Data entities**

| Table | Key fields |
|---|---|
| `wildlife_hazard_assessments` | `assessment_year`, `performed_at`, `performed_by_external`, `report_url`/`storage_path` (uploaded PDF), `faa_accepted_at`/`faa_acceptance_ref`, `ae_signed_at`, review fields (`review_notes`, last-review anchor), `hazardous_species` JSONB, `mitigation_summary`, `findings` JSONB, `replaced_by_id` (supersession), `notes` |

`WhmpHazardousSpecies` = `{ species, hazard_level: low|medium|high|severe, attractants[], mitigations[] }`. `WhmpFinding` = `{ finding, category (habitat/…), recommended_action, sms_hazard_id|null }`.

**Workflows & states**
Active record = `replaced_by_id IS NULL` (latest, mirrors `sms_policies`/`aep_plans`). Flow: File First Assessment / New Year (optionally prefilling from prior) → upload WHMP PDF + record FAA acceptance + species + findings + mitigation summary → Sign + Activate (`recordWhmpAnnualReview` stamps `ae_signed_at` the first time) → annual Record Annual Review thereafter. Amend/Supersede creates a new row and back-fills `replaced_by_id` on the prior. Annual-review due status (`nextWhmpReviewDue`): `current` / `due_soon` (≤60 d) / `overdue` / `never`.

**Inputs**
Assessment year, performed date + external performer (e.g. USDA Wildlife Services), FAA acceptance date/reference, uploaded WHMP PDF, repeatable hazardous-species rows, mitigation summary, repeatable findings, notes, review notes.

**Outputs**
Active-assessment card (FAA acceptance, AE sign-off, annual-review countdown, species register, findings), prior-years history, and compliance copy ("IAW 14 CFR §139.337(c), an annual review recorded here satisfies the requirement to maintain the WHMP current"). Activity-log events on file/amend/review.

**Roles & permissions**
Gated on `WILDLIFE_WRITE` (`wildlife:write`) for create/amend/sign-review; read follows wildlife view access. (The WHMP route lives under the wildlife module: `/wildlife/whmp`.)

**Notable logic / integrations**
SMS linkage is the headline integration: each finding offers "Promote to SMS Hazard" (`buildSmsHazardPromoteUrl` → `/sms/hazards/new` prefilled) and a "Mark Linked" action storing the resulting `sms_hazard_id` (e.g. `HZ-2026-014`) back on the finding. The strike/sighting capture in the `/wildlife` module feeds the annual assessment narrative.

### Emergency & Optional Modules

#### QRC (Quick Reaction Checklists)

**Purpose**

Quick Reaction Checklists drive step-by-step emergency and contingency response (aircraft mishap, hung ordnance, fuel spill, severe weather, etc.). Each execution captures a full audit trail of who acknowledged which step and when, with a per-template progress meter and a Zulu timestamp on every completed step.

**Applies to**

Both airport types (no `appliesTo` in `lib/modules-config.ts` → defaults to `['usaf', 'faa_part139']`). Category `emergency`, `defaultEnabled: true`, setup step `qrc`.

**Regulatory basis**

AFMAN 91-203 (emergency/contingency checklists) and DAFMAN 13-204v2 §2.5.2.8 per the module description. 25 default templates seed from `lib/qrc-seed-data.ts` (`QRC_SEED_DATA`) during base setup.

**Data entities**

| Table | Key fields |
|---|---|
| `qrc_templates` | `base_id`, `qrc_number`, `title`, `notes`, `steps` (JSONB array of `QrcStep`), `references`, `has_scn_form`, `scn_fields` (JSONB `{fields:[{key,label,type}]}`), `is_active`, `sort_order`, `last_reviewed_at`, `last_reviewed_by`, `review_notes` |
| `qrc_executions` | `base_id`, `template_id` (FK), `qrc_number`, `title`, `status` (`open`/`closed`), `opened_by`/`opened_at`/`open_initials`, `closed_by`/`closed_at`/`close_initials`, `step_responses` (JSONB map of stepId → `QrcStepResponse`), `scn_data` (JSONB) |
| `qrc_monthly_reviews` | `base_id`, `template_id`, `user_id`, `reviewed_at`, `template_updated_at_at_review`, `notes` — per-user periodic-review acknowledgements (migration `2026050300`) |

`QrcStep` carries `id`, `type`, `label`, optional `note`, `agencies[]`, `field_label`, `cross_ref_qrc`, and nested `sub_steps[]`. The eight step types (`QrcStepType`): `checkbox`, `checkbox_with_note`, `notify_agencies`, `fill_field`, `time_field`, `conditional`, `text`, `textarea`. `QrcStepResponse` is tri-state: `completed` boolean plus an optional `status` of `completed | not_applicable` (legacy rows only set `completed`; `lib/qrc-step-status.ts` bridges the two), plus `value`, `agencies_checked[]`, `agencies_na[]`, `notes`, `completed_by`, `completed_at`.

**Workflows & states**

Execution lifecycle: `open` → `closed`, with `reopen` (clears close fields back to `open`) and a hard `cancel` (deletes the execution row and its `activity_log` entries). Starting a template inserts a `qrc_executions` row and logs an Events Log entry — `SECONDARY CRASH NET ACTIVATED — QRC #N TITLE` when the template `has_scn_form`, otherwise `QRC #N INITIATED — TITLE`. During execution each step is toggled completed / N/A; `notify_agencies` steps track per-agency completion/N-A; `fill_field`/`time_field` capture a value (a "Now (Z)" button stamps current Zulu HHMM); `conditional`/`text`/`textarea` are non-checkable display steps and are excluded from the progress denominator. Progress = completed / (checkable − N/A). Closing logs `QRC #N COMPLETED` (or the SCN-activated string with filled SCN field values appended). Closed executions expose Export PDF / Email PDF.

Per-template annual review: `reviewQrcTemplate` stamps `last_reviewed_at`/`last_reviewed_by`/`review_notes`; the UI flags a template overdue after 365 days (or "Never reviewed"). A separate per-user monthly/quarterly review flow (`qrc_monthly_reviews`, `ReviewsTab`, `useMonthlyReviews`) tracks individual acknowledgements; the interval is read from `bases.qrc_review_interval` (`monthly | quarterly`).

**Inputs**

Template definitions and SCN-form field config (created in Base Configuration); step toggles, free-text/time field values, optional step notes, opening/closing initials, and SCN form field entries during execution; review notes.

**Outputs**

Per-execution PDF via `lib/qrc-pdf.ts` (`generateQrcPdf` → `{ doc, filename }`), emailed via `sendPdfViaEmail` → `/api/send-pdf-email`. Periodic-review roster PDF via `lib/qrc-monthly-review-pdf.ts` (`generateQrcMonthlyReviewPdf`), which supports both `monthly` and `quarterly` intervals and renders a per-member completion grid for the selected period. Events Log entries on open/close. Sidebar badge count of open executions (`fetchActiveQrcCount`).

**Roles & permissions**

`qrc:view`, `qrc:write`, `qrc:execute` (`PERM.QRC_VIEW/_WRITE/_EXECUTE`). Template create/edit and review live behind write; running/closing executions behind execute (gated by the permission matrix via `user_has_permission` + `user_has_base_access`).

**Notable logic / integrations**

The SCN-form toggle on a QRC (`has_scn_form` + `scn_fields`) repurposes a QRC as a Secondary Crash Net activation record, changing the Events Log verbiage to "SECONDARY CRASH NET ACTIVATED" and surfacing a fillable SCN field block above the steps. This is distinct from the standalone SCN module below. Step status bridging (legacy `completed` boolean vs. tri-state `status`) is centralized in `lib/qrc-step-status.ts` (`getStepStatus`, `getAgencyStatus`).

---

#### Secondary Crash Net (SCN)

**Purpose**

A daily (and monthly back-up) Secondary Crash Net communications-check log. AMOPS personnel poll each emergency response agency and record per-agency line status, producing an Events Log summary and a monthly PDF for the record.

**Applies to**

USAF only (`appliesTo: ['usaf']`). Category `emergency`, `defaultEnabled: true`, setup step `scnagencies`. Civilian Part 139 bases use the AEP module instead.

**Regulatory basis**

DAFMAN 13-204v2 §4.2.2.3.7 (daily SCN check for emergency coordination), per the module description.

**Data entities**

| Table | Key fields |
|---|---|
| `scn_checks` | `base_id`, `check_date` (Zulu YYYY-MM-DD), `check_type` (`primary`/`backup`), `started_at`, `completed_at`, `completed_by`, `completed_by_oi`, `notes` |
| `scn_check_results` | `check_id` (FK), `agency_id` (nullable FK — denormalized name preserved), `agency_name`, `status` (`loud_clear`/`no_response`/`oos`), `notes`, `sort_order` |
| `scn_agencies` | per-base configurable agency roster (`agency_name`, `sort_order`, active flag) — managed in Base Setup via `lib/supabase/scn-agencies.ts` |

`ScnCheckType = 'primary' | 'backup'`; `ScnAgencyStatus = 'loud_clear' | 'no_response' | 'oos'` (labels/colors in `SCN_STATUS_LABELS`/`SCN_STATUS_COLORS`).

**Workflows & states**

Two daily cards: "Daily SCN Check" (`primary`) and "Monthly Back-up SCN Check" (`backup`). `saveCheck` upserts by `(base_id, check_date, check_type)` — re-running clears and rewrites the result rows (edit/re-run path). Each agency is set Loud & Clear / No Response / Out of Service; an OOS agency requires a notes entry (save is blocked otherwise) captured via a dedicated OOS dialog. "Mark All Loud & Clear" is a one-tap quick-fill. The daily check shows opening/closing radio scripts. On save, `summarizeCheck` writes an Events Log entry (`scn` for daily, `scn_backup` for monthly), e.g. "DAILY SCN CHECK COMPLETE — ALL AGENCIES LOUD & CLEAR" or "...EXCEPT Fire Dept (No Response), ATC (Out of Service: radio fault)". A 30-day rolling history panel lists prior checks; checks can be edited or deleted.

**Inputs**

Per-agency status + OOS notes, optional overall notes, operating initials (auto-pulled from the user's `profiles.operating_initials`). Agency roster from Base Setup.

**Outputs**

Monthly Back-up SCN PDF via `lib/scn-pdf.ts` (`generateScnMonthlyPdf`) for a selected `YYYY-MM` (downloads a per-day × per-agency grid). Events Log summary per check.

**Roles & permissions**

`scn:view`, `scn:write`, `scn:manage_agencies` (`PERM.SCN_VIEW/_WRITE/_MANAGE_AGENCIES`). Page write actions (start/edit/delete) gate on `scn:write`; agency roster management gates on `scn:manage_agencies`.

**Notable logic / integrations**

Checks are keyed by Zulu date (`todayZuluDate`) to align with the activity log and the rest of the app. Result rows denormalize `agency_name` so that deleting an agency from the roster does not erase historical check results.

---

#### Airport Emergency Plan (AEP)

**Purpose**

The civilian Part 139 Airport Emergency Plan: a versioned plan document with Accountable Executive (AE) annual sign-off, a response-agency roster, periodic comms checks against that roster, and a drill program (triennial full-scale + annual tabletop/functional). It is the civilian replacement for the USAF SCN module.

**Applies to**

FAA Part 139 only (`appliesTo: ['faa_part139']`). Category `emergency`, `defaultEnabled: true`, setup step `aepagencies`. Routes: `/aep`, `/aep/plan`, `/aep/agencies`, `/aep/comms-checks`, `/aep/drills`.

**Regulatory basis**

14 CFR §139.325 and AC 150/5200-31C. §139.325(d) annual operator review; §139.325(h) triennial full-scale exercise; §139.325(j) tabletop/functional. Drill completions feed SMS Safety Performance Indicators.

**Data entities**

| Table | Key fields |
|---|---|
| `aep_plans` | `base_id`, `version`, `effective_date`, `document_url`/`storage_path`, `approved_by_faa_at`, `faa_acceptance_ref`, `ae_user_id`/`ae_signed_at`, `last_reviewed_at`/`reviewed_by_user_id`/`review_notes`, `replaced_by_id` (supersession pointer), `notes` |
| `aep_response_agencies` | `agency_name`, `agency_role` (`AepAgencyRole`), primary/backup contact name/phone/radio, `sort_order`, `is_active` |
| `aep_drills` | `drill_date`, `drill_type` (`AepDrillType`), `scenario`, `status` (`scheduled`/`completed`/`cancelled`), `participants` (JSONB `AepDrillParticipant[]` w/ `attended`), `after_action_notes`, `findings`, `evidence_url`/`storage_path`, `next_due_at_override`, `completed_at`/`completed_by` |
| `aep_comms_checks` | `check_date` (Zulu), `check_period` (`monthly`/`quarterly`/`ad_hoc`), `completed_at`/`completed_by`/`completed_by_oi`, `notes` |
| `aep_comms_check_results` | `check_id` (FK), `agency_id`, `agency_name`, `agency_role`, `status` (`AepCommsCheckStatus`), `notes`, `sort_order` |

`AepAgencyRole`: `arff`, `mutual_aid_fire`, `ems`, `police`, `hospital`, `atc`, `faa_ro`, `ntsb`, `fbi`, `public_works`, `utility`, `other`. `AepDrillType`: `full_scale`, `tabletop`, `functional`, `orientation`, `arff_familiarization`. `AepCommsCheckStatus`: `loud_clear`, `no_response`, `oos`, `not_reached`.

**Workflows & states**

Plan: a base has one active plan (`replaced_by_id IS NULL`). New versions are issued via the `supersede_aep_plan` SECURITY DEFINER RPC, which atomically inserts the new row and points the prior row's `replaced_by_id` at it (no transient two-active-rows window). `recordAnnualReview` stamps `last_reviewed_at`/`reviewed_by_user_id` and, on first review, also sets `ae_signed_at`/`ae_user_id`. Due-status math is pure and tested (`tests/aep.test.ts`): `nextAnnualReviewDue` (12-month cadence, 60-day amber window) and `nextFullScaleDue` (36-month triennial, 180-day amber window), both returning `current | due_soon | overdue | never`.

Drills: `createDrill` (defaults `scheduled`) → `completeDrill` (sets `completed`, records participants/attendance, after-action notes, findings, optional evidence upload) or `cancelled`. Comms checks: `saveCommsCheck` upserts by `(base_id, check_date, check_period)`, rewriting result rows on re-run; `summarizeCommsCheck` writes an Events Log entry (`aep_comms`) mirroring the SCN summary format.

**Inputs**

Plan version/effective-date/FAA acceptance ref + uploaded plan document; response-agency roster with contacts; drill scenario/date/type/participants/after-action; per-agency comms-check status + notes; operating initials.

**Outputs**

AEP PDF via `lib/aep-pdf.ts`. Plan documents stored at `aep-plans/<base>/<plan>/plan-<ts>.<ext>` and drill after-action reports at `aep-drills/<base>/<drill>/aar-<ts>.<ext>` in the `photos` bucket (storage RLS migration `2026060705`, path-segment base scoping). Events Log entries on plan create/update/supersede/review, agency CRUD, drill create/complete, and comms checks. Dashboard due chips + SMS SPI feed.

**Roles & permissions**

`aep:read`, `aep:write`, `aep:sign` (`PERM.AEP_READ/_WRITE/_SIGN`). RLS write policies require `aep:write`; the AE sign button is UI-gated on `aep:sign` but `recordAnnualReview` is soft-enforced (callable by any `aep:write` user) — matched to AEP's lighter review cadence vs. the SMS policy chain.

**Notable logic / integrations**

Cross-base writes are blocked at the RPC layer (`supersede_aep_plan` derives `base_id` from the prior plan and ignores the client-supplied value). Calendar-day truncation (`daysBetween`, midnight-UTC on both sides) prevents the off-by-half-day errors documented in the Phase 3a daysToExpiry lesson.

---

#### PPR (Prior Permission Required)

**Purpose**

A Prior Permission Required log with per-base configurable columns, a public no-login request form, AMOPS triage, multi-agency coordination, final approval/denial/cancellation, server-minted PPR numbers, and a remarks timeline. Email notifications keep the requester and coordinating agencies in the loop.

**Applies to**

Both airport types (no `appliesTo`). Category `optional`, `defaultEnabled: true`, setup step `pprcolumns`. Internal log at `/ppr`; public form at `app/[icao]/ppr-request` (ICAO path) and legacy `app/ppr-request/[baseId]`.

**Regulatory basis**

DAFMAN 13-204 (PPR for transient aircraft) per CLAUDE.md's regulatory table; otherwise a base-policy workflow rather than a single-paragraph mandate.

**Data entities**

| Table | Key fields |
|---|---|
| `ppr_columns` | `base_id`, `column_name`, `column_type` (`PprColumnType`), `sort_order`, `is_required`, independent visibility flags `show_on_status`/`show_on_form`/`show_on_log`, `time_display` (`zulu`/`local`/null), `info_text` (for `info_only`) |
| `ppr_entries` | `base_id`, `ppr_number`, `arrival_date`, `column_values` (JSONB map colId→string), `notes`, `status` (`PprStatus`), `approver_oi`, requester `name`/`email`/`phone`, `triaged_by`/`triaged_at`, `approval_user_id`/`approval_at`, `denial_reason`, `cancellation_reason`, `public_submission`, `created_by`/`updated_by` |
| `ppr_coordination` | `entry_id` (FK), `agency_id` (nullable), `agency_name` (denormalized), `status` (`pending`/`concur`/`non_concur`), `comment`, `coordinated_by`/`coordinated_at` |
| `ppr_remarks` | `entry_id`, `base_id`, `remark`, `created_by` (joined to `profiles` for name/rank display) |
| `ppr_agencies` | per-base coordinating-agency roster (`lib/supabase/ppr-agencies.ts`) |

`PprColumnType`: `text`, `date`, `time`, `yes_no_na`, `phone`, `number`, `email`, `info_only`. `PprStatus`: `pending_amops_triage`, `pending_coordination`, `pending_amops_approval`, `approved`, `denied`, `canceled`.

**Workflows & states**

Status chain for public submissions: `pending_amops_triage` → (triage routes to N agencies) `pending_coordination` → (all coord rows resolved) `pending_amops_approval` → `approved` / `denied`. Triage with zero agencies ("pre-coordinated") jumps straight to `approved`. Internal AMOPS create (`createPprEntry`) has three landing states: empty `agencyIds` → `approved`; `agencyIds[...]` → `pending_coordination` (triage stamped at create); `manualCoordPending` → `pending_amops_approval` (external coordination). Coordination (`coordinatePprEntry`) records each agency's concur/non-concur + comment, mirrors the comment into `ppr_remarks` (prefixed `[Agency — CONCUR/NON-CONCUR]`), and advances the entry once no `pending` coord rows remain (idempotent guard on the prior status). `addPprCoordinationAgencies` can add agencies mid-flow, reverting `pending_amops_approval` back to `pending_coordination`. `cancelPprEntry` (any non-terminal, any `ppr:write` user) and `denyPprEntry` (gated on `ppr:approve`) are soft terminal states keeping the row. `isActivePpr` treats everything except `denied`/`canceled` as counting toward the day's operational PPR count (header/status-board chips).

**Inputs**

Per-base column config (Base Setup). Public form: requester name (required), email (validated), commercial phone, plus dynamic columns flagged `show_on_form`. Internal: column values, arrival date, approver OI, agency selection, coordination decisions/comments, remarks, denial/cancellation reasons.

**Outputs**

PPR log PDF via `lib/ppr-pdf.ts`. Notification emails through `/api/send-ppr-confirmation` (public submit acknowledgement, no number yet), `/api/send-ppr-coordination-request` (to agency coordinators), `/api/send-ppr-approval`, `/api/send-ppr-denial`, `/api/send-ppr-cancellation` — all best-effort/fire-and-forget so email failure never rolls back a status flip. Events Log entries on every transition. `formatPprColumnValue` is the single display source of truth for rendering a stored value across the log table, detail dialog, PDF, and emails (handles `yes_no_na` mapping, locale date, and Zulu-vs-local time formatting per `time_display`).

**Roles & permissions**

`ppr:view`, `ppr:write`, `ppr:delete`, `ppr:triage`, `ppr:coordinate`, `ppr:approve` (`PERM.PPR_VIEW/_WRITE/_DELETE/_TRIAGE/_COORDINATE/_APPROVE`). Triage gates on `ppr:triage`, agency concur/non-concur on `ppr:coordinate`, final approve/deny on `ppr:approve`, remarks read/add on `ppr:view` with edit/delete on `ppr:write`. Public submission is unauthenticated.

**Notable logic / integrations**

Public submit goes through the `submit_public_ppr_request` SECURITY DEFINER RPC (ICAO-resolved variant on the `/[icao]` path; base-id variant on the legacy path), which inserts the entry at `pending_amops_triage` with `public_submission = true`. The `/api/send-ppr-confirmation` endpoint is rate-limited (per-email + per-IP via `checkRateLimits`/`getClientIp`, → 429); the form surfaces a cooldown message on rate-limit. PPR numbers are minted server-side by the atomic `_ppr_generate_number` RPC (counter table, migration `2026042803`) to serialize concurrent submits; public submissions carry an `XX` OI placeholder that `rewritePprOiSegment` replaces with the approver's actual initials on approval (and on approver-OI edits via `updatePprEntry`). `isSummaryColumn` selects which configured columns surface in the slim `/ppr` log and the Airfield Status "Today's PPRs" panel (matched on `callsign`/`aircraft type`).

---

#### Customer Feedback

**Purpose**

A public, no-login feedback channel (QR-code reachable) for transient aircrew and contractors. Admins configure the form (title, description, custom fields, optional name/email/organization/overall-rating), and submissions land in the Feedback module for AFM review with inline display.

**Applies to**

Both airport types (no `appliesTo`). Category `optional`, **`defaultEnabled: false`** (the only module in this set that is off by default), setup step `feedback`. Staff view at `/feedback`; public form at `app/feedback/[baseId]`.

**Regulatory basis**

None — a base-service/customer-experience tool, not a regulatory requirement.

**Data entities**

| Table / store | Key fields |
|---|---|
| `customer_feedback` | `base_id`, `name`, `email`, `organization`, `overall_rating` (nullable int), `comments`, `responses` (JSONB map of custom-field id → value), `submitted_at` |
| `bases.feedback_form_config` (JSONB) | `FeedbackFormConfig`: `enabled`, `title`, `description`, `fields[]` (`FeedbackFormField`: `id`, `label`, `type`, `required`, `options[]`), `show_name`, `show_email`, `show_organization`, `show_overall_rating`, `thank_you_message` |

`FeedbackFormField.type`: `text`, `textarea`, `rating`, `yes_no`, `dropdown` (dropdown uses `options[]`).

**Workflows & states**

No status lifecycle — a submission is a single immutable row. Public visitor scans the QR, the form renders from `fetchPublicFeedbackConfig` (anon-callable SECURITY DEFINER RPC `get_public_feedback_config`, since `bases` has authenticated-only RLS), and `submitFeedback` inserts the row (anon key). If the base has disabled the `feedback` module in `enabled_modules`, the config fetch short-circuits and the form shows a closed message instead of accepting submissions. Staff list submissions newest-first; there is **no detail view** — each row shows the comment plus its custom-field `responses` inline. Submissions can be deleted.

**Inputs**

Form config (Base Setup). Public submission: optional name/email/organization, overall rating, comments, and custom-field responses. The QR target URL is `${origin}/feedback/${installationId}` (rendered via the `api.qrserver.com` QR image service in Base Setup).

**Outputs**

Feedback PDF via `lib/feedback-pdf.ts` (`generateFeedbackPdf`). Analytics rollup via `fetchFeedbackStats` (total, average rating, rating distribution, recent count). No outbound notification emails.

**Roles & permissions**

`feedback:view`, `feedback:configure`, `feedback:delete` (`PERM.FEEDBACK_VIEW/_CONFIGURE/_DELETE`). Staff page reads gate on `feedback:view`; row delete on `feedback:delete`; form configuration on `feedback:configure`. Public submit is unauthenticated.

**Notable logic / integrations**

The public read path deliberately uses a SECURITY DEFINER RPC (not a direct `bases` select) so an anon QR-scan visitor gets only base name, module-on flag, and form config. `DEFAULT_FEEDBACK_CONFIG` is merged over any stored partial config so older/partial configs always render a complete form.

## 4. Cross-cutting engines

### NAVAID outage engine (`lib/outage-rules.ts`)

Evaluates lighting-system component status against DAFMAN 13-204v2 Table A3.1 allowable thresholds and produces a 4-tier alert. The engine is pure (takes `LightingSystem` + `LightingSystemComponent` + `InfrastructureFeature[]`).

- **Per-component evaluation** (`calculateComponentOutage`): computes outage percentage (always from individual light counts), outage count, and adjacent/consecutive violations. A component is **exceeded** if it is zero-tolerance and any light is inop, OR `outagePct > allowable_outage_pct`, OR `outageCount > allowable_outage_count`, OR an adjacent/consecutive rule is violated. It is **approaching** when within 5 percentage points of the percent limit, or at the count limit, with at least one inop light.
- **Bar-level analysis** (`analyzeBarOutages`): for components whose features carry a `bar_group_id`, a bar is considered out when ≥ `BAR_INOP_THRESHOLD` (3) of its lamps are inoperative. Count-based thresholds then use bars-out rather than individual lights ("3 barrettes out" = 3 bars with 3+ inop lamps); adjacent/consecutive checks use synthetic per-bar units positioned at each bar's centroid.
- **Spatial ordering** (`sortByPosition`): features are ordered geodesically along the axis of greater lat/lon spread (using bar centroids when grouped) so adjacency/consecutiveness is meaningful.
- **System health** (`calculateSystemHealth`): rolls components into a status of `operational` / `degraded` / `exceeded` / `inoperative` (an "overall" component being exceeded forces `inoperative`).
- **Alert tier** (`getAlertTier` → `AlertTier`): `green` operational, `yellow` approaching limit, `red` exceeded, `black` system inoperative. `DAFMAN_NOTES` 1–5 encode the required actions (issue NOTAM, notify CE electrical, system shutoff + command-chain notification with waiver authority, notify TERPs, obstruction-NOTAM attributes per FAAO JO 7930.2). Reporting an outage auto-creates a discrepancy; marking operational prompts to close linked discrepancies.

### Obstruction evaluation (`lib/calculations/obstructions.ts` + `geometry.ts`)

Evaluates a point + height against imaginary surfaces using geodesic math (`offsetPoint`, `distanceFt`, `bearing`, `pointToRunwayRelation`, `pointToSegmentDistanceFt` in `geometry.ts`).

- **USAF mode** — `evaluateObstruction(point, heightAGL, groundElevMSL, runway, airfieldElevMSL, runwayClass)` walks all UFC 3-260-01 Ch. 3 surfaces (primary, approach-departure 50:1, transitional 7:1, inner/outer horizontal, conical 20:1) plus the runway clear zone, graded area, and APZ I/II land-use zones (per DoD Instruction 4165.57). Surface dimensions are looked up by runway class. The approach-departure surface rises from the **nearer threshold's** elevation when per-threshold elevations are provided.
- **Civilian mode** — `evaluateObstructionPart77(point, heightAGL, groundElevMSL, runway, airfieldElevMSL, approachType)` walks the 5 FAA Part 77 §77.19 surfaces (primary, approach, transitional, horizontal, conical). Dimensions are selected from a per-approach-type table (`FaaApproachType`: utility/non-utility × visual/non-precision/precision); precision encodes the 50:1-then-40:1 two-segment approach. `getSurfaces(surfaceSet, approachType)` picks the right set per base.
- Each `SurfaceEvaluation` carries whether the point is within bounds, max allowable height AGL/MSL, penetration depth, the controlling surface (lowest allowable height among in-bounds surfaces), the UFC/CFR reference, and a human-readable `calculationBreakdown` for transparency. Violations emit `waiverGuidance` (work order to CES, ATC/RAPCON coordination per DAFMAN 13-204 §1.14, airspace-criteria-waiver request).

### Parking clearance (`lib/calculations/parking-clearance.ts`)

Implements UFC 3-260-01 Table 6-1a wingtip/taxilane clearance. ADG group is derived from wingspan (`getADGFromWingspan`). `getWingtipClearanceDetail(wingspan, context, aircraftName)` returns the required clearance + UFC item for each apron context: parking (10 ft for WS < 110 ft / 20 ft for ≥ 110 ft), transient C-5/C-17 (25 ft), KC-10/KC-46/KC-135 refueling (25 ft, auto-detected by aircraft name), interior taxilane Item 5(I) (20 ft), peripheral taxilane Item 6(T) (30/50 ft, 25 ft transient). The full 16-item Table 6-1a reference is encoded in `TABLE_6_1A_ITEMS` (with a `applicable_to_2d` flag).

Clearance checks sample perimeter points of each aircraft's bounding rectangle and measure to the other aircraft's rect (`checkWingtipClearance`), to obstacles by shape — point/building/circle/line (`checkObstacleClearance`), and to taxilane envelopes (`checkTaxilaneClearance`, envelope half-width = `0.5 × designWingspan + clearance`). Status is `ok` / `warning` (within 110% of required) / `violation` (below required); the more restrictive of two aircraft governs. `findAllViolations(...)` / `getAllClearanceResults(...)` batch all pairwise + obstacle + taxilane checks and sort violations first. Aircraft center is offset from the stored nose-gear block position by half-length minus pivot distance (`getAircraftCenter`).

### Field conditions / TALPA (civilian)

`/field-conditions` implements runway condition assessment per AC 150/5200-30D: a per-third Runway Condition Code (RwyCC) matrix, a treatment log, and a FICON NOTAM text generator for the FAA NOTAM Manager. Required for Part 139 airports issuing winter / wet-pavement field conditions. Gated by `field_conditions:read` / `field_conditions:write`.

### Rate limiting (`lib/rate-limit.ts`)

A Postgres-backed sliding-window limiter for unauthenticated/cost-bearing endpoints (Vercel serverless can't use in-memory). `checkRateLimits(admin, rules[])` where each rule is `{bucket, max, windowSeconds}`; it checks per-email and per-IP, short-circuits on first denial, and **fails open** on RPC error. `getClientIp(req)` reads `x-forwarded-for` / `x-real-ip`. Backed by the `rate_limit_hits` table and a SECURITY DEFINER `check_rate_limit` RPC (granted to `service_role`/`authenticated` only — never anon). Wired into forgot-password, signup-email, send-ppr-confirmation, and the Google elevation proxy (per-IP cap to cap the bill).

## 5. Integrations & external services

| Route | Purpose | External service |
|---|---|---|
| `app/api/notams/sync` | Sync live FAA NOTAMs for an ICAO | FAA public NOTAM Search (`notams.aim.faa.gov`, no key) |
| `app/api/airport-lookup` | ICAO/airport metadata + runway geometry on base setup | OurAirports open data + FAA NFDC supplement |
| `app/api/elevation` | Ground elevation for obstruction evaluations (rate-limited per IP) | Google Maps Elevation API (`GOOGLE_ELEVATION_API_KEY`) |
| Interactive maps (client) | Every map (status, infrastructure, parking, obstructions) | Google Maps JS API |
| Wildlife BASH heatmap (client) | Strike/sighting density heatmap only | Mapbox GL |
| `app/api/send-pdf-email` | Email a client-generated PDF (branded) | Resend |
| `app/api/send-ppr-*` (confirmation, approval, denial, cancellation, update, coordination-request) | PPR lifecycle notifications + multi-agency coordination | Resend |
| `app/api/admin/invite` | Admin invite with temp password (forces `/setup-account`) | Resend + Supabase admin API |
| `app/api/forgot-password` | Branded self-service reset link (enumeration-safe, rate-limited) | Resend + Supabase admin `generateLink` |
| `app/api/admin/reset-password` | Admin-triggered branded reset (email derived from userId) | Resend + Supabase admin API |
| `app/api/signup-email` | Self-signup; creates confirmed auth user, profile `pending` for admin approval (rate-limited) | Supabase admin API |
| `app/api/profile/email` | Self-service email change (own account only) | Supabase admin API |
| `app/api/user-emails` | Resolve user emails for PPR/notification recipients | Supabase (service role) + Resend |
| `app/api/training-expiry-digest` | Daily §139.303 training-expiry digest (cron, `CRON_SECRET`) | Resend |
| `app/api/annual-review-digest` | Daily AEP §139.325(d) + WHMP §139.337(c) annual-review digest (cron) | Resend |
| `app/api/admin/kiosk-token` | Mint/rotate/clear a base's kiosk token | Supabase |
| `app/api/admin/airfield-diagram` | Upload/delete a base's airfield diagram image | Supabase Storage |
| `app/api/infrastructure-import` | One-time bulk GeoJSON feature import | Supabase |
| `app/api/installations` | Add/remove a user's base membership | Supabase (service role) |
| `app/api/airfield-status` | Server-side airfield-status read/write | Supabase |
| `app/api/admin/users/[id]` | Admin user update/delete (profile FKs nullify on delete) | Supabase admin API |

## Appendix A — Permission keys & roles

**Roles** (`UserRole`): `airfield_manager`, `namo`, `amops`, `ces`, `safety`, `atc`, `read_only`, `base_admin`, `sys_admin`, `ppr`, `airfield_status`, `majcom_rfm`; civilian Part 139: `accountable_executive`, `sms_manager`, `aep_coordinator`, `ops_supervisor`, `arff_chief`.

**Permission keys** (`PERM`, `lib/permissions.ts`), grouped:

- **Airfield status:** `airfield_status:view` · `:write` · `:write:rsc_bwc_only`
- **Checks / Inspections / ACSI:** `checks:view|write|delete` · `inspections:view|write|delete|file` · `acsi:view|write|delete|file`
- **Discrepancies:** `discrepancies:view|write|delete|close|cancel|add_note` · `:transition:ces_statuses` · `:update:resolution_notes`
- **CES / Infrastructure / Parking / Obstructions:** `ces:view` · `infrastructure:view|write|delete` · `parking:view|write|delete` · `obstructions:view|write|delete`
- **QRC / Shift checklist / SCN:** `qrc:view|write|execute` · `shift_checklist:view|write` · `scn:view|write|manage_agencies`
- **Wildlife / Waivers / NOTAMs / Contractors:** `wildlife:view|write|delete` · `waivers:view|write|delete|review` · `notams:view|write|cancel` · `contractors:view|write|delete`
- **PPR:** `ppr:view|write|delete|triage|coordinate|approve`
- **Photos:** `photos:write|delete`
- **Daily reviews:** `daily_reviews:view` · `:sign:amsl|namo|afm` · civilian `:sign:supervisor|manager`
- **AMTR (USAF):** `amtr:view|write|delete|manage|export`
- **SMS (Part 139):** `sms:read|write|sign_policy|approve_moc|triage_reports`
- **AEP (Part 139):** `aep:read|write|sign`
- **Field conditions:** `field_conditions:read|write`
- **§139.303 Training:** `training_part139:read|write|export`
- **Reporting / activity:** `dashboard:view` · `reports:view|export` · `activity_log:view|write_manual|delete` · `recent_activity:view`
- **Feedback:** `feedback:view|configure|delete`
- **Reference:** `training:view` · `library:view|manage` · `regulations:view` · `aircraft:view`
- **Admin:** `users:view|manage` · `base_setup:view|write` · `settings:view` · `installations:switch`
- **Records export:** `exports:read|write`

## Appendix B — API route inventory

| Route | Purpose |
|---|---|
| `notams/sync` | Sync live FAA NOTAMs for an ICAO |
| `airport-lookup` | ICAO/airport metadata + runway geometry lookup |
| `elevation` | Ground-elevation proxy (Google, rate-limited) |
| `send-pdf-email` | Email a client-generated PDF via Resend |
| `send-ppr-confirmation` | PPR submission confirmation email (rate-limited) |
| `send-ppr-approval` / `-denial` / `-cancellation` / `-update` | PPR lifecycle notification emails |
| `send-ppr-coordination-request` | PPR multi-agency coordination request email |
| `admin/invite` | Admin invite (temp password, forced `/setup-account`) |
| `admin/reset-password` | Admin-triggered branded password reset |
| `admin/users/[id]` | Admin user update / delete |
| `admin/kiosk-token` | Mint / rotate / clear a base kiosk token |
| `admin/airfield-diagram` | Upload / delete a base airfield diagram |
| `forgot-password` | Self-service branded reset link (enumeration-safe, rate-limited) |
| `signup-email` | Self-signup → confirmed auth user, profile `pending` for approval |
| `profile/email` | Self-service email change (own account) |
| `user-emails` | Resolve user emails for recipients |
| `installations` | Add / remove a user's base membership |
| `airfield-status` | Server-side airfield-status read/write |
| `infrastructure-import` | One-time bulk GeoJSON feature import |
| `training-expiry-digest` | Daily §139.303 training-expiry digest (cron) |
| `annual-review-digest` | Daily AEP/WHMP annual-review digest (cron) |

## Appendix C — PDF generators

All return `{ doc, filename }` and run client-side (`lib/*-pdf.ts`).

| Generator | Output |
|---|---|
| `generateCheckPdf` | A completed airfield check (items, photos, signatures) |
| `generateDiscrepancyPdf` | A discrepancy record with status history |
| `generateObstructionPdf` | An obstruction evaluation (surfaces, penetrations, waiver guidance) |
| `generateParkingPdf` | An aircraft parking plan diagram + clearance results |
| `generatePersonnelPdf` | AF Form 483 Personnel-on-Airfield log |
| `generatePprPdf` | The PPR log (configurable columns) |
| `generateQrcPdf` | A Quick Reaction Checklist with execution audit trail |
| `generateQrcMonthlyReviewPdf` | QRC monthly review record |
| `generateScnMonthlyPdf` | Secondary Crash Net monthly check log |
| `generateEventsLogPdf` | The daily Events Log (AF Form 3616 substitute) |
| `generateWaiverPdf` | An AF Form 505 airfield-criteria waiver |
| `generateFeedbackPdf` | Customer-feedback submissions |
| `generateAcsiPdf` | Annual ACSI compliance inspection |
| `generateAmtrRosterPdf` | AMTR training roster |
| `generateAmtrInspectionPdf` | AMTR per-member inspection / record |
| `generateModuleReferencePdf` (`training-pdf.ts`) | Help & Training module reference |
| `generateTrainingTranscriptPdf` (`training-part139-pdf.ts`) | Per-user §139.303 training transcript |
| `buildSmsManualPdf` (`sms-pdf.ts`) | SMS manual / safety documentation |
| `generateAepPlanPdf` (`aep-pdf.ts`) | Airport Emergency Plan document |
| `email-pdf.ts` | Shared PDF-email helper (`sendPdfViaEmail`), not a standalone document generator |
