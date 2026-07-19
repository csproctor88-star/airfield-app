# Modifications & Exemptions — civilian Part 139 record tracker

**Date:** 2026-07-18
**Status:** Design — awaiting owner review. No code started.
**Module:** new civilian module at `/modifications-exemptions`,
`appliesTo: ['faa_part139']`, default-on recommended (open question 2)
**Site tie-in:** the authored-but-gated marketing page
`glidepath-site/lib/modules/civilian/modifications-exemptions.ts` describes
exactly this feature; it gets registered when this ships.
**Binding regulatory source:** `docs/references/part139-mos-exemptions-verified.md`
(gitignored; transcribed 2026-07-18 from the owner's four PDFs — 14 CFR
Part 139 & Part 11 eCFR prints current as of 2026-07-16, FAA Order 5300.1G,
FAA Order 5280.5D). **Every regulatory statement below cites that file;
nothing is encoded from model memory.**

## Goal

One record system for the two formal "we differ from the standard" tracks a
Part 139 airport runs, from submission to a documented decision and beyond
it (expirations, annual reviews):

- **Modification of Standards (MOS)** — deviations from FAA airport design /
  construction / material / equipment standards under FAA Order 5300.1G.
  FAA's system of record is the Airports GIS MOS Tool; this module is the
  **airport's own tracking record** (status, letters, expirations, the ALP
  table, what an inspector asks for). We never claim to file anything.
- **Part 139 exemption petitions** (§139.111 via 14 CFR Part 11) — including
  the §139.111(b) small-airport ARFF path with its extra required contents.

"Ready before an inspector asks" is literal: Order 5280.5D's pre-inspection
document request list includes item **33. "Modifications to Standards and
exemptions"**, and the Form 5280-4 audit our civilian `/acsi` module encodes
has the `p139-exempt` item **"Justification Still Valid (139.111) — No. on
record"** — this module supplies both answers.

## Why these are one module, not two

Order 5280.5D §2.12.4 draws the line explicitly: "An exemption is not a
'Modification of Standards'" — but the same paragraph binds them: a MOS that
impacts Part 139 requirements **must be addressed in the approved ACM**, and
the ACM must carry **each current exemption** (§139.203(b) elements 2 & 17)
plus a **current Exemptions List** (5280.5D §2.12.6). Same audience, same
inspector moment, same lifecycle shape → one module with a `record_type`
discriminator, mirroring how `/waivers` (the USAF sibling, AF Form 505)
already models this lifecycle: main row + attachments + annual reviews.

## Data model

### `mods_exemptions` (main table)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `base_id` | uuid FK bases NOT NULL | RLS anchor |
| `record_type` | text CHECK `('mos','exemption')` | +`'deviation'` if open question 1 = yes |
| `title` | text NOT NULL | short human name |
| `status` | text CHECK, default `'draft'` | see status model |
| `standard_reference` | text NOT NULL | the exact standard: "AC 150/5300-13B — Taxiway Safety Area (TSA)" or "14 CFR §139.319(h)(1)" |
| `baseline_summary` | text | what the standard requires |
| `relief_summary` | text | what differs / extent of relief sought (§11.81(c)) |
| `justification` | text | reason for relief (§11.81(c); 5300.1G ¶11.a certifications) |
| `public_interest` | text | §11.81(d) — exemption only |
| `safety_justification` | text | §11.81(e) equivalent-safety / 5300.1G "acceptable level of safety" |
| `mos_category` / `mos_subcategory` | text nullable | Appendix A taxonomy, seeded as constants from the verified doc; MOS only |
| `approval_authority` | text CHECK `('ado','regional','headquarters')` nullable | 5300.1G ¶10; MOS only |
| `agis_tracking` | text nullable | AGIS MOS id + NRA airspace case number (¶11.c, ¶12.b) |
| `docket_number` | text nullable | exemption; arrives with the FAA letter (§11.91) |
| `arff_small_airport` | boolean default false | §139.111(b) path — UI reveals the (b)(2) checklist |
| `date_submitted` / `date_decided` / `effective_date` / `expiration_date` | date nullable | expiration from the decision letter; design MOS ≤5 yr (¶8.f); exemptions time-limited (5280.5D §2.12.2 — the module records the letter's date, never hardcodes a term; 5280.5D internally disagrees 3 yr vs 2 yr) |
| `decision_summary` | text | grant/denial reasoning |
| `decision_conditions` | text | ¶9 approval-letter conditions |
| `last_reviewed_date` / `next_review_due` | date nullable | annual review cadence (5280.5D §2.12.2); auto-suggest +1 yr on review save |
| `notes` | text | |
| `saved_by_id` / `updated_by_id` | uuid FK profiles nullable | "Former user" fallback pattern |
| `created_at` / `updated_at` | timestamptz | |

**Status model** (one enum, per-type display labels):
`'draft' → 'submitted' → 'under_review' → 'approved' | 'partially_granted' |
'denied' | 'withdrawn'`, plus `'expired'`.

- Exemption labels: Granted / Partially granted / Denied (5280.5D §8.6:
  "grant, deny, or partially grant"). `partially_granted` is
  exemption-only (UI-enforced).
- MOS labels: Approved / Disapproved (5300.1G ¶8.h language). An approved
  MOS **cannot be modified** (¶8.g) — the edit form locks
  standard/relief fields once status is approved; changes require a new
  record (UI copy cites ¶8.g).
- "Expired" also renders as a **computed chip** whenever
  `expiration_date < today` on a decided record, independent of the stored
  status (no cron; same pattern as NOTAM/waiver expiry displays). Denied
  exemptions show the §11.101 60-day reconsideration hint while inside the
  window.

### `mods_exemption_reviews`

`id, record_id FK CASCADE, review_date NOT NULL, reviewed_by_id FK profiles
nullable, justification_still_valid boolean NOT NULL, recommendation CHECK
('retain','resubmit','terminate') nullable, notes, created_at`.
This is the §2.12.2 annual currency review and answers Form 5280-4's
"Justification Still Valid". Saving a review sets the parent's
`last_reviewed_date` and suggests `next_review_due = review_date + 1 year`
(local date strings — the session-6 UTC± boundary lesson applies to tests).

### `mods_exemption_attachments`

`id, record_id FK CASCADE, file_path, file_name, file_size, mime_type, kind
CHECK ('petition','decision_letter','srm','airspace_review','correspondence',
'other'), caption, uploaded_by_id, created_at`.
Private storage bucket `mods-exemptions`, path
`<base_id>/<record_id>/<uuid>.pdf`, 25 MB, PDF-only — byte-for-byte the
`local-regulations` bucket pattern (path-scoped policies). 5300.1G ¶11.c
explicitly expects airspace/SRM findings "in a non-editable format such as
PDF", which is exactly our constraint.

### RLS

Matrix pattern, nothing novel: SELECT = `user_has_base_access(auth.uid(),
base_id)`; INSERT/UPDATE/DELETE = base access AND
`user_has_permission(auth.uid(), 'mods_exemptions:write')`. Child tables
inherit via the record's `base_id` (denormalized `base_id` column on
children, pinned equal to parent — the local-regs base-pin hardening).
Storage policies path-scoped per the local-regs storage migration.

## Access control

New keys `mods_exemptions:view` / `mods_exemptions:write` (category
`compliance`). Proposed grants (owner confirms at review):

| Role | view | write | Why |
|---|---|---|---|
| sys_admin, airfield_manager, namo, base_admin | ✓ | ✓ | admin tier, explicit re-grant per house pattern |
| ops_supervisor | ✓ | ✓ | civilian ops lead (holds sms:write, airfield_status:write) |
| accountable_executive | ✓ | — | signs the ACM these records feed |
| sms_manager, arff_chief | ✓ | — | SRM review interest; ARFF exemptions (§139.111(b), AAS-300) |
| aep_coordinator | ✓ | — | consistency with its qrc/wildlife view tier |
| amops, safety, read_only | ✓ | — | general read surface |
| **majcom_rfm** | ✓ | — | **every-`:view` contract — granted explicitly in the same migration (2026-07-18 drift lesson)** |
| atc, ppr, airfield_status, ces | — | — | out of scope (atc per today's ruling mood) |

## UI

Single page `app/(app)/modifications-exemptions/page.tsx` (waivers-style,
no sub-routes in v1):

- **Header + stat strip** — Active MOS · Active exemptions · Decisions
  pending · Reviews due / overdue · Expiring ≤ 90 days.
- **Records list** — filter by type / status / expiring; row shows type
  chip, title, standard reference, status (+ computed Expired chip), key
  dates, review-due badge.
- **Detail drawer/panel** — full record, attachments (upload/download),
  review history + "Log annual review" action, status changes with date
  prompts (decided → asks for decision date/summary/conditions/expiration;
  submitted → asks for submission date; exemption granted → docket number).
- **New record form** — type picker first; the form then shows only that
  type's fields. MOS: category/subcategory selector (Appendix A constants),
  authority, AGIS ref, the ¶11.a certification texts as guidance
  placeholders; a hint panel lists ¶8.i's "MOS is NOT applicable for" items
  (RSA dimensions, OFZ, approach/departure surfaces, matching existing
  equipment, RPZ land use) so nobody drafts a doomed request. Exemption:
  §11.81 (a)–(h) mapped to fields; toggling `arff_small_airport` reveals a
  §139.111(b)(2) contents checklist (itemized cost, staffing, financial
  report, 12-month enplanements, ops type/frequency, service history,
  anticipated changes) as a completeness aid, plus the 120-day advance
  notice hint.
- **Empty state** — explains both tracks in two sentences with the real
  citations.
- Sidebar entry under Compliance; `HREF_TO_MODULE` mapping; module tile on
  `/more`.

No Base Setup wizard step (records are created in-module; there is no
per-base template to configure). No Events Log writes (house rule). No
realtime badge in v1.

## PDF exports (client-side jsPDF, `{ doc, filename }`)

1. **Register PDF** — "Modifications & Exemptions Register", the
   inspector-handoff document (5280.5D item 33):
   - MOS section with the **¶12.b ALP-table columns**: standard modified,
     category, approval-letter date, effective period, airspace review case
     number, conditions, status.
   - Exemptions section = the **ACM current-exemptions list** (§139.203(b)(2),
     §2.12.6): CFR section(s), docket, effective/expiration, last annual
     review + justification-still-valid, status.
   - **Decided/expired history section included** — the Local Regs /
     Read File archived-report lesson; records never vanish from the
     register the UI promises they're in.
2. **Per-record detail PDF** — full record + review history + attachment
   list (names/dates, not contents).
   Em-dash sanitization per the scn-pdf/read-file lesson.

## Write path

Plain CRUD like `/waivers` — **not** routed through the offline queue.
Rationale: desk-side admin records, no natural-key collision risk, no
field-mobility story; matches waivers exactly. (Open question 5 if the
owner disagrees.) `updateModsExemption` must not reassign creator
attribution (the driving-checks lesson) and assembles returns from
insert/update responses (no re-fetch duplicate window).

## Migrations (staged, owner-applied)

1. `..._mods_exemptions_permissions.sql` — keys + grants table above
   (explicit majcom_rfm + read_only rows; test-parseable statement shapes).
2. `..._mods_exemptions_tables.sql` — three tables + RLS + indexes.
3. `..._mods_exemptions_storage.sql` — private bucket + path-scoped
   policies (local-regs mirror).
4. (If defaultEnabled=true ruling) `..._mods_exemptions_enable_module.sql`
   — enabled_modules backfill for civilian bases, owner-row UPDATE pattern.

## Testing

- Status/label maps incl. exemption-only `partially_granted` and per-type
  labels; approved-MOS field-lock rule.
- Register PDF **raw-content assertions** (read-file test pattern): decided
  and expired records present, ALP columns present, ACM list wording.
- Review save: `last_reviewed_date`/`next_review_due` local-date math with
  both-direction UTC± fixtures (session-6 lesson).
- Expired-chip computation at the date boundary.
- Static SQL guards: RLS shape, CHECK lists, grant expectations added to
  `permission-matrix-roles.test.ts` documented contracts.
- Appendix A constants: spot-assert count per category and a handful of
  exact subcategory strings against the verified doc.
- Attachment kind CHECK + path shape unit tests.

## glidepath-site follow-up (separate, after app ships)

Register the authored page: `modules-data.ts` entry + import, OG image gen,
tests (`related: ['obstructions','self-inspections']` already valid). Its
`regulation: null` can now become a real citation block (14 CFR §139.111 /
FAA Order 5300.1G) since the text is verified — terminology guards apply.
Owner reviews site copy at that point; no site work in this feature.

## Open questions for the owner

1. **§139.113 emergency deviations as a third record type in v1?**
   Recommend **yes, minimal shape**: fields `deviation_date`,
   nature/extent/duration text, `notified_date` (the 14-day duty to the
   RADM), written-notification-requested/provided booleans; statuses
   `notification_pending → notified → closed`. It's cheap here, it's a real
   §2.13 inspector topic, and there is nowhere else in the app to put it.
   If no: drop the type, CHECK stays two-valued.
2. **defaultEnabled on civilian bases?** Recommend **true** (like SMS /
   ACSI — it's core Part 139 compliance furniture; empty state is fine).
3. **Permission matrix** — confirm the table above, esp. ops_supervisor
   write, arff_chief/aep_coordinator view, and amops view.
4. **Attachments PDF-only at 25 MB** (local-regs parity) — or also images
   (site plans/photos)? Recommend PDF-only v1.
5. **Plain CRUD (no offline queue)** — confirm.
6. **Naming**: route `/modifications-exemptions`, module label
   "Modifications & Exemptions", sidebar label same (longest current
   sidebar entry is "Airfield Driving Spot Check", so it fits). Confirm or
   rename.

## Build order (single session, review-gated like FPR/DSC)

1. Migrations 1–3 staged + `lib/permissions.ts` keys + registry entries
   (modules-config, sidebar, HREF_TO_MODULE, /more).
2. `lib/mods-exemptions/constants.ts` (statuses, labels, Appendix A
   taxonomy from the verified doc) + `lib/supabase/mods-exemptions.ts` CRUD.
3. Page UI (list/detail/forms/reviews/attachments).
4. `lib/mods-exemptions-pdf.ts` (register + detail).
5. Manual page `docs/manual/27_modifications_exemptions.md` + Help entry.
6. Tests throughout; four-gate check per commit; adversarial final review
   before wrap; migration 4 pending ruling 2.
