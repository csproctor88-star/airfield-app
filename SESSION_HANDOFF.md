# Session Handoff

**Date:** 2026-04-27 (extended same-day session)
**Branch:** `main`
**Build:** Clean — `npm run build` ✓, `npx tsc --noEmit` ✓, `npx vitest run` 247 pass
**HEAD:** `a06713c`

---

## What shipped this session

**9 commits** on `main`, **6 new migrations** introduced (all applied to prod by session end).
Two themes: continuing the PPR module hardening that started 2026-04-26, and cross-cutting
quality-of-life work (drag-and-drop reorder in base-setup, Events Log filter, info-only PPR
column type, sidebar pending-action dots). Plus a thread of bug fixes from real testing —
the email path had three independent failures, sidebar dots had a stale-state issue after
the realtime publication change, and pre-coordinated approval was silently skipping the
requester email.

### PPR remarks + coordinator routing + sidebar pending dots + base-setup drag-reorder (`4048d05`)

A single big commit covering four distinct features:

- **PPR remarks** — new `ppr_remarks` table (entry × user × text × Zulu timestamp). RLS
  gates SELECT/INSERT on `ppr:view` (so any viewer can post — matches the intent that
  anyone in the loop can leave context); UPDATE/DELETE on `ppr:write`. `coordinatePprEntry`
  mirrors coord comments into `ppr_remarks` with a `[Agency — CONCUR/NON-CONCUR]` prefix
  so the remarks thread is the single human-readable timeline. Detail card on `/ppr` renders
  the thread (zebra-striped rows with rank/name + Zulu timestamp) plus a textarea+Save row
  at the bottom. PDF export gains a REMARKS section after the main table — PPR # / User /
  When / Remark, one row per remark.

- **Sidebar PPR notification dots** — new hook `useSidebarBadgeCounts()` returns per-user
  pending counts gated by permission: `ppr:triage` → `pending_amops_triage`; `ppr:approve`
  → `pending_amops_approval`; `ppr:coordinate` → pending coord rows on agencies the user
  is a member of. Red circular badge on the `/ppr` nav item (with "X pending" text label
  when expanded; suppresses while viewing `/ppr`). Same red dot on the Operations section
  header. Aggregates across any items in the section that contribute counts (today: just
  `/ppr`).

- **PPR coordinator assignment + email-on-coordination** — new `ppr_agency_members` table
  (agency × user × base) bridging the free-text `ppr_agencies` list to the people
  responsible for it. Admin manages via Base Setup → PPR Columns → existing Coordinating
  Agencies section, which gains a "Coordinators" button per agency that opens a checkbox
  modal of base members. Coordinator count chip shows on each agency row; warning chip
  when zero ("No coordinators — emails won't fire"). New API route
  `/api/send-ppr-coordination-request` — Resend, one email per agency to its coordinators.
  `triagePprEntry` (multi-agency path) and `createPprEntry` (internal-with-agencies path)
  both fire-and-forget the new email API.

- **Base-setup drag-and-drop reorder** — new `hooks/use-drag-reorder.ts` generic hook with
  whole-row and split handle/drop modes. Applied to: Airfield Areas, NAVAIDs, Facilities,
  QRC Templates, Lighting Systems (☰ grip handle since rows expand on click), and PPR
  Columns (☰ handle alongside the existing up/down arrows). Migration
  `2026042701_lighting_systems_sort_order.sql` adds the missing `sort_order` column to
  `lighting_systems` and seeds existing rows by current alphabetical name so display is
  unchanged at deploy.

  Also: PPR public-form middleware fix. `/ppr-request` and `/api/send-ppr-confirmation`
  weren't in the unauthenticated allowlist, so anonymous QR-code visitors hit the
  /login redirect before the page could call its SECURITY DEFINER RPCs. The original test
  session was authenticated, so the gap surfaced only after the recent JWT rotation
  invalidated all sessions.

### Hide PPR + wildlife-sighting rows from the Events Log (`9d78785`)

The Events Log (`/activity`) is the AF Form 3616 operational log — PPR coordination /
triage / approval churn and high-volume wildlife sightings flood it and aren't what
tower / AMOPS scan that page for. Both still write to `activity_log`, so both still
appear on the Activity Log (`/recent-activity`) which is the full audit trail.
`fetchActivityLog` gains an optional `excludeEntityTypes` filter; `/activity` passes
`['ppr_entry', 'wildlife_sighting']`. Wildlife strikes stay on the Events Log — those
are real airfield events that warrant the AF 3616 entry.

### PPR info-only column type (`786a1b3`)

A new `column_type='info_only'` lets base admins surface static text on the PPR Request
form (and the internal create modal) without asking the requester for input. Used for
airfield hours, parking restrictions, fuel availability, hazardous-cargo procedures —
context every aircrew needs but that doesn't belong as a free-text field. Migration
`2026042800` adds `ppr_columns.info_text TEXT` and extends the `column_type` CHECK to
admit `'info_only'`. The `get_public_ppr_config` RPC is refreshed to project `info_text`.

`PprFieldInput` renders info-only as a labeled read-only block (column name as a small
uppercase heading, info_text below, with preserved line breaks). The `/ppr` table headers,
row cells, detail card "Request Details" section, SubmittedSummary preview, and the PDF
dynamic-column table all filter info_only columns out — these carry no per-PPR value.
Confirmation email (`/api/send-ppr-confirmation`) fetches public info_only columns and
renders each as a boxed section. Approval email splits the column fetch: regular columns
drive the value table; info_only columns render as boxed sections after.

Base Setup UX: "Required" toggle is replaced with "Edit Text" on existing info_only
column rows; new-column row hides the Required checkbox when the type selector is on
info_only and surfaces a textarea below the row.

### PPR Request short ICAO-based URL (`f9ce76d`)

QR codes now point to `https://glidepathops.com/kmtc/ppr-request` rather than a
UUID-shaped `/ppr-request/<uuid>`. New SECURITY DEFINER RPC
`get_public_ppr_config_by_icao(p_icao)` does case-insensitive ICAO lookup and returns
the same config shape plus the resolved `base_id` so the form can submit via the
existing `submit_public_ppr_request(p_base_id UUID)` RPC. Granted to anon.

The existing form was extracted into `components/ppr/public-request-form.tsx` and
accepts a `lookup` discriminated union `{kind:'baseId'|'icao'}`. Both routes
(`/ppr-request/[baseId]` legacy + `/[icao]/ppr-request` new) are now thin wrappers
around the shared component. Cooldown localStorage key is keyed on the resolved UUID
so a visitor hitting both URLs is rate-limited consistently.

Middleware: the long inline allowlist was replaced with a small `isPublicPath()` helper.
A regex (`/^\/[^/]+\/ppr-request(\/.*)?$/`) admits the ICAO route — the page itself
validates the ICAO and shows a not-found state, so a permissive prefix is fine. Base
Setup's `generatePublicQr()` now prefers the ICAO URL when the base has one.

### PPR public-form diagnostic logging (`61d3188`)

No behavior change. The form was swallowing the confirmation-email response, so a
4xx/5xx from `/api/send-ppr-confirmation` produced no signal on the client. Logs the
resolved base on RPC success and the API status text on failure so the next problem
report has something to attach.

### PPR emails: drop malformed replyTo (`e0fe8ac`)

Resend returned 422 `validation_error` and refused to send the entire email when the
replyTo field didn't match its email shape. The three PPR routes were passing
`bases.amops_email` through with just `|| undefined`, which catches null/empty but
not whitespace, typos, multi-recipient strings, or stray newlines. One bad row in
`bases.amops_email` was killing every confirmation/approval/coord email at that base.
Adds a small `validReplyTo()` helper to each of the three routes: trims, checks against
a permissive email regex, returns `undefined` if anything looks off. The email still
sends; the requester just can't reply directly to AMOPS until the admin fixes the bad
value. The "Contact AMOPS at <addr>" footer line is also gated on the validated value
rather than the raw column.

### Deny on review, sidebar realtime, email copy cleanup (`505c222`)

- **Sidebar dot stuck after approval** — `ppr_entries` and `ppr_coordination` weren't
  in the `supabase_realtime` publication, so `useSidebarBadgeCounts`'s listener never
  fired and the count only refreshed on full page reload. Migration `2026042802_ppr_realtime.sql`
  adds both tables to the publication.

- **Deny on review** — the triage modal had only "Route to Coordination" + "Pre-coordinated".
  AMOPS had no way to deny a public submission outright; the workaround was routing
  then deleting. Replaced the single pre-coordinated checkbox with three radio options:
  Route → coordination, Pre-coordinated → approve now, Deny → set status='denied' with
  a required reason. Submit button label and styling change with the selected mode (deny
  goes red).

- **Email copy** — removed the "via Glidepath" suffix on the from-line across all three
  PPR routes. Replaced "Sent from Glidepath Airfield Management." footer with "Do not
  reply to this email — replies are unmonitored." Replaced "Questions? Reply to this
  email or contact AMOPS at X" with "Contact AMOPS at X with any questions or concerns."
  Coord email's "Review in Glidepath" CTA → "Review the PPR".

- **Approval-email diagnostic** — `approvePprEntry` now logs API non-2xx status + body
  to console. The prior code only caught network throws.

### Approval email on pre-coordinated triage path (`eb39f85`)

The pre-coordinated review action (admin checks "Approve now" in the triage modal)
flips status straight to 'approved' but never fired the approval-email API. Only the
post-coord Decide path — `approvePprEntry` — was sending the email. Net effect: a
public submission AMOPS approved without coordination got no notification, no PPR
number, no info-only fields. Added the same fire-and-forget
`/api/send-ppr-approval` call to the skip path in `triagePprEntry`.

### Sidebar badge: refresh on tab focus / visibility change (`02bdb2e`)

When the realtime publication was extended after a tab was already open, that tab's
websocket subscription didn't auto-pick up the new table additions and the badge count
stuck at a stale value. Hard-refreshing fixed it, but the user shouldn't have to.
Adds a focus + visibilitychange listener that re-runs the count fetcher whenever the
user switches back to the tab. Cheap (one fetch per focus, against three small queries)
and recovers from any missed realtime event regardless of cause — temporary loss of
websocket, RLS hiccup, publication metadata staleness, etc.

---

## Same-day follow-up (2026-04-27 cont.)

Five commits closing P2 + tech-debt items. Two new migrations.

- **Denial email + AMOPS reply-to format validation on save** (`1de6e7a`) — new
  `/api/send-ppr-denial` route; `denyPprEntry()` fires it after the status flip,
  covering both deny call sites (triage-Deny radio + post-coord Decide-Deny).
  Base Setup `handleSaveAmopsEmail` rejects malformed input with a toast.
- **PPR PDF coordination + status section + no-coordinators warning at triage**
  (`ca23602`) — `lib/ppr-pdf.ts` gains a Status column on the main table and a
  COORDINATION section. Triage modal in route mode shows ⚠ on agency chips with
  zero coordinators and a banner when any selected agency would skip the email.
- **PPR cleanup: types backfill + OI refresh + date echo on public form**
  (`8993341`) — `ppr_agency_members`, `ppr_remarks`, `ppr_columns.info_text`,
  and `lighting_systems.sort_order` added to `lib/supabase/types.ts`; ten
  `(supabase as any)` casts removed. `updatePprEntry` now accepts `approver_oi`
  and rewrites the OI segment of the `ppr_number`; the edit modal exposes the
  field to `ppr:approve` users on already-approved entries (closes the
  "hand-edit if anyone cares" gap). Public PPR form echoes the picked arrival
  date back as DD MMM YYYY to disarm browser-locale ambiguity.
- **PPR # serialization** (`5019762`) — replace COUNT-based numbering with an
  atomic counter table. `_ppr_generate_number` now does
  INSERT..ON CONFLICT DO UPDATE RETURNING; `createPprEntry` calls the RPC
  instead of doing JS-side COUNT + format. UNIQUE index on
  `(base_id, ppr_number)` catches future regressions. Migration
  `2026042803_ppr_number_serialize.sql`.
- **Storage RLS: tighter entity-scope on photo INSERT** (`08b12f0`) —
  migration 2026041600 path-scoped the photos bucket but 2026042208 (the
  permission-matrix refactor) replaced those policies with a simple
  `user_has_permission(uid, 'photos:write')` check, dropping path scoping.
  Migration `2026042804` re-establishes path scoping on top of the matrix
  permission: INSERT/UPDATE/DELETE on the `photos` bucket now require BOTH
  the matrix permission AND a path-resolved base-access check via the
  parent entity (discrepancy/check/inspection/acsi/airfield-diagrams).
- **Migration fix: drop `user_can_write` reference** (`84b60ba`) — the
  first cut of `2026042804` referenced `user_can_write()` for the
  airfield-diagrams write check. That helper was dropped in 2026042208 as
  part of the matrix refactor — the user got `42883: function
  user_can_write(uuid) does not exist` when applying. The full migration
  rolled back as a transaction (no prod state changed). Rewrite uses
  `user_has_permission(uid, 'photos:write')` exclusively. Saved a
  feedback memory `feedback_rls_helpers.md` to prevent a repeat.
- **Sidebar badge: in-app nav refresh + polling fallback** (`44f0332`) —
  user reported the PPR pending dot still doesn't clear after the prior
  fix landed. Diagnosis: the sidebar persists across in-app navigation,
  so neither `focus` nor `visibilitychange` fires on a sidebar click —
  only a full page reload pulled fresh counts. Added `usePathname()`
  as a refresh dep (any route change → recount), a 30s polling
  interval (self-heals realtime silent failures), and a `subscribe()`
  status log so the next stuck-badge incident can confirm from devtools
  whether the channel is alive.

---

## Migrations status

The first six were applied to prod during the original 2026-04-27 session.
The two same-day follow-up migrations (2026042803, 2026042804) are
**pending** — they need to be applied next session before the deploy.

| Migration | Status | What it does |
|---|---|---|
| `2026042700_ppr_remarks.sql` | ✅ Applied | New `ppr_remarks` table + RLS |
| `2026042701_lighting_systems_sort_order.sql` | ✅ Applied | Adds `lighting_systems.sort_order`, seeds by name |
| `2026042702_ppr_agency_members.sql` | ✅ Applied | New `ppr_agency_members` join table + RLS |
| `2026042800_ppr_info_only_column.sql` | ✅ Applied | Adds `ppr_columns.info_text`, refreshes `get_public_ppr_config` RPC, extends column_type CHECK |
| `2026042801_ppr_request_by_icao.sql` | ✅ Applied | New `get_public_ppr_config_by_icao(TEXT)` SECURITY DEFINER RPC |
| `2026042802_ppr_realtime.sql` | ✅ Applied | Adds `ppr_entries` + `ppr_coordination` to `supabase_realtime` publication |
| `2026042803_ppr_number_serialize.sql` | ⏳ Pending | Atomic counter table for PPR# minting (fixes simultaneous-submit race). **Required before next deploy** — `createPprEntry` calls the new RPC. |
| `2026042804_storage_rls_tighter_entity_scope.sql` | ⏳ Pending | Re-introduces path scoping on photos bucket on top of matrix permission. Backwards-compatible for legitimate flows. |

---

## Bugs fixed during the session (worth tracking)

| Symptom | Root cause | Commit |
|---|---|---|
| `/kmtc/ppr-request` redirected to /login | Middleware allowlist missed the route | `4048d05` (middleware fix bundled in big commit) |
| Confirmation + approval emails silently failing | Resend 422 on malformed `bases.amops_email` reaching `replyTo` | `e0fe8ac` |
| Sidebar dot persisted after PPR approval | `ppr_entries` / `ppr_coordination` not in realtime publication | `505c222` (migration) + `02bdb2e` (focus-refresh fallback) |
| Pre-coordinated approval sent no email | `triagePprEntry` skip path wasn't firing the email API; only the post-coord Decide path was | `eb39f85` |
| Denial sent no notification to requester | `denyPprEntry` had no email path | `1de6e7a` (new `/api/send-ppr-denial` route) |
| Bad AMOPS email could persist in DB | Save handler trimmed but didn't validate format | `1de6e7a` (regex check on save) |
| Triage didn't warn when an agency had zero coordinators | Email path silently skipped agencies with no members; warning was only at Base Setup time | `ca23602` (per-chip ⚠ + banner) |
| Re-approval couldn't refresh OI on already-approved entries | Edit modal didn't expose approver_oi; `updatePprEntry` didn't accept it | `8993341` (field gated to `ppr:approve` users + ppr_number rewrite) |
| Public form date confused users with non-US locales | Native picker rendered MM/DD/YYYY for some, DD/MM/YYYY for others | `8993341` (DD MMM YYYY echo below picker) |
| Simultaneous PPR submits could mint duplicate ppr_numbers | `_ppr_generate_number` did COUNT(*) + 1; two concurrent calls saw the same count | `5019762` (migration `2026042803` — atomic counter table) |
| Storage bucket lost path scoping after matrix refactor | `2026042208` replaced 2026041600's path-scoped policies with bare permission checks | `08b12f0` + `84b60ba` (migration `2026042804`) |
| Migration `2026042804` failed with `42883: function user_can_write(uuid) does not exist` | First cut referenced helper dropped in 2026042208 | `84b60ba` (rewrite using matrix helpers; saved feedback memory) |
| Sidebar PPR dot didn't clear on in-app navigation | `useSidebarBadgeCounts` hook persists across nav; `focus`/`visibilitychange` only fire on browser-tab change, not sidebar click | `44f0332` (pathname-based refresh + 30s polling fallback) |
| Sidebar PPR dot didn't clear after approve/deny on /ppr | Mutation handlers only refreshed the page's local state; realtime appears silent on prod | `a06713c` (custom-event bridge: hook listens for `'glidepath:badges-refresh'`; `/ppr` dispatches at the end of `loadData()`) |

---

## Final state of the PPR module

**Public flow** — `/[icao]/ppr-request` (preferred) or `/ppr-request/[baseId]` (legacy QRs).
Form renders public columns including info-only blocks. On submit, status lands at
`pending_amops_triage` and a confirmation email goes out (no PPR# yet).

**Triage flow** — AMOPS user with `ppr:triage` opens a public submission and chooses one
of three: Route to Coordination (pick agencies → status=`pending_coordination`,
coordination-request email per agency to its coordinators), Pre-coordinated (status=
`approved`, approval email with PPR#), or Deny (status=`denied` with a required reason).

**Coordination flow** — Each agency's coordinator opens the coord modal and concur /
non-concur on their row. The coord comment is mirrored into `ppr_remarks` for the timeline.
When the last pending coord row resolves, status auto-advances to `pending_amops_approval`.

**Approval flow** — AMOPS with `ppr:approve` clicks Decide → Approve / Deny. Approve fires
the approval email with PPR#, dynamic columns, and info-only blocks.

**Notifications**
- Sidebar dot on Operations section + PPR Log item, scoped per-user (only counts work the
  user can act on). Realtime + focus-refresh fallback.
- Confirmation email on submission (no PPR#).
- Coord-request email per agency on triage with agencies (best-effort, skipped silently
  when an agency has no coordinators — warning chip in Base Setup).
- Approval email with PPR#, columns, info-only blocks (fires on both pre-coord and
  post-coord approval paths now).
- Denial email with the reason (fires on both triage-Deny and post-coord Decide-Deny
  paths via `denyPprEntry`).

**Email cosmetics** — From line `{Base} AMOPS <info@glidepathops.com>` (no "via Glidepath"
suffix anymore). Footer: "Do not reply to this email — replies are unmonitored." Reply-to
set to `bases.amops_email` only when it passes a basic email-shape check.

---

## Lessons from this session
- **RLS migrations must use the matrix helpers** (`user_has_permission(uid, key)`,
  `user_has_base_access`, `user_is_sys_admin`). The legacy `user_can_write`,
  `user_is_admin`, `user_is_base_admin_at` were dropped in `2026042208`. Any
  new policy referencing them will fail with `42883`. Pinned in
  `~/.claude/projects/.../memory/feedback_rls_helpers.md`.
- **Memory was stale on `daily_reviews` / `arff_status_log`** — both were
  already in `lib/supabase/types.ts` (the carry-over note implied otherwise).
  Cleaned up.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **Sequential coordination** | Deferred | All assigned agencies see their work in parallel. No ordering. |
| **Public form file uploads** | Deferred | Flight plans, certificates, etc. — out of scope unless requested. |
| **Bulk coordinate** | Deferred | Per-row only. |

---

## Next session tasks (prioritized)

### P0 — apply pending migrations BEFORE deploying any new code

Run these on prod, in order. The first is required (the deployed app calls
the new RPC); the second is backwards-compatible but should ride along.

1. **`2026042803_ppr_number_serialize.sql`** — creates `ppr_number_sequence`
   counter table, replaces `_ppr_generate_number` with atomic upsert,
   backfills existing rows from MAX of parsed sequence segment, adds
   UNIQUE index `(base_id, ppr_number)`. **Without this, `createPprEntry`
   fails with "function `_ppr_generate_number` does not exist."** The
   public RPC `submit_public_ppr_request` continues to work via the older
   in-place definition, but new authenticated PPR creation breaks.
2. **`2026042804_storage_rls_tighter_entity_scope.sql`** — restores path
   scoping on the `photos` bucket on top of the matrix permission. Fixed
   version using `user_has_permission(uid, 'photos:write'/'delete')` —
   the first attempt referenced the dropped `user_can_write` helper and
   failed with `42883`. Read the migration top comment for context.

### P1 — verify on prod after deploy (smoke test list)

1. **Denial email lands on both paths.** Public PPR → triage-Deny with a
   reason → email arrives. Another → route → coord → Decide → Deny →
   email arrives. Both should show the reason in a red-bordered block.
2. **AMOPS email format check.** Base Setup → AMOPS Email → `not-an-email`
   → reject toast. Clear → save success.
3. **No-coordinators warning at triage.** Route mode → agencies with no
   coordinators show ⚠; selecting one surfaces the warning banner.
4. **PPR PDF.** Export → main table has Status column; COORDINATION
   section appears after REMARKS.
5. **Approver OI edit.** Open an already-approved PPR's edit modal as a
   `ppr:approve` user → "Approver OI" field appears → change → confirm
   `ppr_number` rewrites the OI segment.
6. **PPR# race smoke.** Submit two public PPRs back-to-back on the same
   date → confirm distinct numbers (best-effort; the race was
   unobservable before so this just confirms the happy path holds).
7. **Storage RLS.** Upload a photo on a discrepancy you own → succeeds.
8. **Sidebar PPR dot clears on nav.** Approve a pending PPR, then click any
   sidebar item → dot clears immediately (pathname-based refresh). Or wait
   ≤30s without navigating → dot clears via polling. If the dot is sticking
   despite both, check devtools console: a `[sidebar-badge] realtime channel
   CHANNEL_ERROR` / `TIMED_OUT` warning means the websocket sub failed and
   polling is the only thing keeping counts current. Healthy realtime is
   silent.

### P2 — bug-of-the-day backlog (next quick wins)

Empty for now. The previous P2 list was fully closed in the same-day
follow-up. If new items surface during P1 verification, log them here.

### P3 — bigger work, only if customer demand

*(Sequential coordination, bulk coordinate, public form file uploads —
all deferred pending customer ask.)*

### P4 — long-running carryover from prior sessions
- **Offline reads** for QRC + Regulations. Workbox runtime caching is
  already wired for some routes; add these two.
- **Component extraction** for 4K+ LOC pages (`base-setup`, `parking`,
  `infrastructure`) — explicitly multi-session work. Pure refactor,
  large test surface.
- **Trademark resolution** — CDW Class 42 conflict on "GLIDEPATH".
- **CAC/PIV authentication** (blocked on Platform One).
- **Outage analytics, training management, Part 139 civilian template.**

---

## Build snapshot

```
✓ Compiled successfully
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 247 pass

Notable First Load JS:
  /wildlife              788 kB (heatmap, unchanged)
  /parking               411 kB
  /reports/aging         331 kB
  /reports/discrepancies 330 kB
  /obstructions/[id]     327 kB
  /reports/daily         322 kB
  /reports/lighting      318 kB
  /reports/trends        315 kB
  /library               292 kB
  /settings/base-setup   240 kB  (+4 kB this session — drag handles, info_only, coord picker)
  /inspections           233 kB
  /discrepancies         224 kB
  /settings              199 kB
  /regulations           182 kB
  /scn                   181 kB
  /qrc                   180 kB
  /ppr                   178 kB
  /more                  176 kB
  /settings/base-setup/modules 176 kB
  /ppr-request/[baseId]  152 kB  (legacy)
  /[icao]/ppr-request    152 kB  (new short URL)

Middleware             74.5 kB
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-04-27 (cont.) | Same-day follow-up: denial email, AMOPS reply-to format check, PPR PDF coord/status section, no-coord warning at triage, types backfill, OI refresh, public form date echo, PPR# atomic counter, storage RLS path scoping. Two pending migrations (2026042803, 2026042804). |
| **Unreleased** | 2026-04-27 | PPR remarks, info-only columns, ICAO-based URL, sidebar pending dots, agency coordinators, deny-on-review, base-setup drag-reorder, Events Log filter, six migrations. Bug fixes: replyTo malformed, sidebar realtime, pre-coord approval email |
| **Unreleased** | 2026-04-26 | PPR public form + AMOPS-triaged multi-agency coordination, requester emails, full UI/UX iteration on detail card / KPI bar / time picker; security cleanup (`.env.local` untracked, old keys rotated at providers) |
| **Unreleased** | 2026-04-25 (cont.) | Offline write queue: foundation + 12 wraps + inspector + pending photos. Inspection gate lifted for online-Begin and offline-Begin flows. |
| **Unreleased** | 2026-04-25 | iOS PWA fixes, airfield diagram upload rewrite, OFFLINE pill, codebase primer + offline-queue spec, kiosk tests, PDF polish. Workbox runtime caching for offline reads on QRC / PPR / Contractors / Discrepancies / Library / Aircraft / Waivers. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files
- `supabase/migrations/2026042700_ppr_remarks.sql`
- `supabase/migrations/2026042701_lighting_systems_sort_order.sql`
- `supabase/migrations/2026042702_ppr_agency_members.sql`
- `supabase/migrations/2026042800_ppr_info_only_column.sql`
- `supabase/migrations/2026042801_ppr_request_by_icao.sql`
- `supabase/migrations/2026042802_ppr_realtime.sql`
- `lib/supabase/ppr-agency-members.ts` — `fetchAgencyMembers`, `setAgencyMembers`,
  `fetchPprCoordinatorPicker`, `fetchPendingCoordinationCountForUser`, `fetchAgencyMemberEmails`
- `app/api/send-ppr-coordination-request/route.ts` — Resend, one email per agency
- `hooks/use-sidebar-badge-counts.ts` — per-user pending counts + realtime + focus refresh
- `hooks/use-drag-reorder.ts` — generic D&D hook (whole-row + split handle/drop modes)
- `components/ppr/public-request-form.tsx` — extracted shared form, accepts `{kind:'baseId'|'icao'}`
- `app/[icao]/ppr-request/page.tsx` — new short-URL route

### Modified files
- `lib/supabase/ppr.ts` — `PprRemark`, `fetchPprRemarks`, `addPprRemark`,
  `info_only` column type, `info_text` field, coord-mirror in `coordinatePprEntry`,
  pre-coord email send in `triagePprEntry`, approval-email logging
- `lib/supabase/lighting-systems.ts` — order by `sort_order` then `name` tiebreaker
- `lib/supabase/activity-queries.ts` — `excludeEntityTypes` filter
- `lib/ppr-pdf.ts` — REMARKS section, info-only filter on dynamic columns
- `components/ppr/ppr-field-input.tsx` — `info_only` read-only block branch
- `components/layout/sidebar-nav.tsx` — section-header dot + per-item dot for `/ppr`
- `app/(app)/ppr/page.tsx` — remarks UI, three-mode triage modal, info-only filter on data
  rendering, coord email integration, sidebar count integration
- `app/(app)/settings/base-setup/page.tsx` — drag-reorder on six tabs, coordinator picker,
  info-only edit modal + new-row textarea
- `app/(app)/activity/page.tsx` — `excludeEntityTypes: ['ppr_entry', 'wildlife_sighting']`
- `app/ppr-request/[baseId]/page.tsx` — thin wrapper around shared form
- `app/api/send-ppr-confirmation/route.ts` — `validReplyTo`, info-only render, copy
- `app/api/send-ppr-approval/route.ts` — `validReplyTo`, info-only render, copy
- `middleware.ts` — `isPublicPath()` helper, regex for `/<icao>/ppr-request`
- `tests/pdf-utils.test.ts` — `info_text: null` on test fixture

### Same-day follow-up — new files
- `app/api/send-ppr-denial/route.ts` — Resend, validates `status='denied'`, renders
  reason in red-bordered block.
- `supabase/migrations/2026042803_ppr_number_serialize.sql` — `ppr_number_sequence`
  counter table + atomic `_ppr_generate_number`, UNIQUE index on
  `(base_id, ppr_number)`.
- `supabase/migrations/2026042804_storage_rls_tighter_entity_scope.sql` — restored
  path-scoped photos bucket policies on top of the matrix permission.
- `~/.claude/projects/.../memory/feedback_rls_helpers.md` — pinned rule on
  matrix RLS helpers (don't reach for `user_can_write` and friends).

### Same-day follow-up — modified files
- `lib/supabase/ppr.ts` — `denyPprEntry` fires denial email; `updatePprEntry`
  accepts `approver_oi` and rewrites `ppr_number`; `createPprEntry` mints via
  RPC; removed dead `julianDay` / `generatePprNumber` / `countPprsForDate`.
- `lib/supabase/types.ts` — added `ppr_agency_members`, `ppr_remarks`,
  `_ppr_generate_number` RPC; backfilled `ppr_columns.info_text` and
  `lighting_systems.sort_order`.
- `lib/supabase/ppr-agency-members.ts` — added `fetchAgencyCoordinatorCounts`;
  removed all `(supabase as any)` casts.
- `lib/ppr-pdf.ts` — Status column on the main table, COORDINATION section.
- `app/(app)/ppr/page.tsx` — denial email help-text, no-coord warning chip +
  banner in triage modal, Approver-OI edit field on already-approved entries.
- `app/(app)/settings/base-setup/page.tsx` — `handleSaveAmopsEmail` rejects
  malformed input with a toast.
- `components/ppr/public-request-form.tsx` — DD MMM YYYY echo below date picker.

---

*Two migrations pending: `2026042803_ppr_number_serialize.sql` (required before
next deploy — `createPprEntry` calls the new RPC) and
`2026042804_storage_rls_tighter_entity_scope.sql` (backwards-compatible).*
