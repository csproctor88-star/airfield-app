# Session Handoff

**Date:** 2026-06-24
**Branch:** `main` — pushed to origin, in sync (`395365c1`). Still v2.34.0 (no bump).
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓ (compiled successfully),
`npx vitest run` ✓ **908 pass / 95 files**.
**HEAD:** `395365c1`

---

## What shipped this session

One module, end to end: **FLIP Management** (`/flip`) — the electronic
equivalent of the DAFMAN 13-204V2 §2.5.2.18 *FLIPs Continuity Binder*. It was
brainstormed into a committed spec + plan, built task-by-task via
subagent-driven development (Phase-1 + final reviews, both APPROVED), then
iterated through ~8 rounds of user-driven UX refinement. 29 commits
(`1db6ae49` → `c4ba7dad`), 7 migrations (`2026062304`–`2026062402`, all applied
+ verified live), dual-mode (`appliesTo: ['usaf','faa_part139']`),
`defaultEnabled: false`.

### Module foundation + 3 pages (`1db6ae49` … `bac88e4f`)

Spec + plan under `docs/superpowers/`. The shape mirrors AMTR + the existing
CRUD modules:

- **Two-layer authz.** Global matrix keys `flip:view|write|manage|export`
  (`2026062304`) gate module/admin/export. A per-module `flip_role_assignments`
  table (`2026062305`, roles `custodian`/`alternate`/`namo`/`afm`, multiple per
  user) gates who acts inside a record — exactly AMTR's pattern. Admin matrix at
  `/flip/roles`.
- **8 tables + RLS** (`2026062305`) via the matrix helpers only
  (`user_has_base_access` + `user_has_permission`). `flip_review_signoffs` is
  SELECT-only to clients; all signature writes go through the RPC.
- **`flip_sign_review` RPC** (`2026062307`, `SECURITY DEFINER`) enforces the
  sequential **Custodian → NAMO → AFM** review sign-off: derives signer from
  `auth.uid()`, checks role-per-slot, enforces order + permanence. Mirrors the
  pure logic in `lib/flip/roles.ts` (unit-tested, `tests/flip-roles.test.ts`,
  15 cases). Signing routes through the offline write queue
  (`flip_review_sign` handler, registered in `lib/sync/handlers.ts`).
- **Private `flip` storage bucket** (`2026062306`) + authenticated
  `/api/flip-file` proxy (mirrors `/api/photos`). Path `<base_id>/<kind>/<uuid>`.
- **Home** (Account Overview + References), **FLIP Changes** (3-stage pipeline),
  **FLIP Reviews** (dropdown-only review modal sourced from the Local FLIP List,
  discrepancy toggle + reg-required `date_corrected`, sequential sign-off, signed
  PDF via `lib/flip-pdf.ts`). Help & Training section added (`bac88e4f`).
- Built on Glidepath theme tokens (prototype navy/gold discarded).

### Roles matrix scoped to airfield-management roles (`d5aafb84`)

The `/flip/roles` matrix listed every base member. Now it lists only users whose
authoritative `profiles.role` is an airfield-management leadership/admin role —
AFM, NAMO, AMOPS, Base Admin, sys_admin, plus civilian parallels
(`accountable_executive`, `ops_supervisor`) — i.e. exactly the holders of
`flip:write`/`flip:manage`. New `lib/flip/roster-roles.ts` (`isFlipEligibleRole`),
mirroring `lib/amtr/roster-roles.ts`. Reads `profiles.role`, not the stale
`base_members.role`.

### Nav entry moved to Admin (`65759c53`)

`/flip` relocated from "Airfield Management" to the **Admin** section in the
default sidebar config and added to the More tab's Admin group. Both surfaces
already gate it on `flip:view` + `isModuleEnabled`, so it appears only when the
module is enabled for the base.

### Coordinate Change dialog (`bc23580a`, `c4ba7dad`, `680e995d`)

Three input upgrades + the FAA-format structure:

- **FLIP Title** is a dropdown sourced from the Local FLIP List (empty → amber
  guard, same as the review modal).
- **NOTAM** is a dropdown of the base's current active NOTAMs pulled live from
  `/api/notams/sync?icao=…` (there is no NOTAM table — the feed is the only
  source), with an "Other (enter manually)" fallback (a change may *initiate*
  NOTAM action per §2.5.2.18.2.2.4, so the NOTAM may not be in the feed yet).
- **Name / Rank** auto-imports from the signing user's profile (`rank` + `name`,
  email fallback), read-only — no manual entry. `submitted_by_user` still stamps
  `auth.uid()`.
- **FAA-format fields** (`c4ba7dad`, cols in `2026062402`): a *Reference Document
  & Page* field, plus four checkboxes — Additions / Deletions / Revisions From /
  Revisions To — each toggling its own drag-resizable (`resize: both`) text
  field. Surfaced on the change card's expanded body.
- **Details field removed** (`680e995d`) as redundant with the category boxes +
  Remarks. `details` stays a nullable column (older changes still display
  theirs); it's now optional in `createFlipChange`.

### Change workflow: roles, dates, history, remarks (`d1ee5b7f`, `e74e8db5`)

- **Publish/Reject opened up.** Primary/Alternate Custodian and NAMO can now Mark
  Published / Reject (AFM stays the coordination-stage approval authority). RLS
  already permitted any `flip:write` holder — this is the matching UI gate.
- **Date chaining + clearing.** Creation → Processed → Published: each input is
  disabled until the prior has a value; clearing an upstream date cascades to
  clear downstream ones; clearing now works (empty → NULL).
- **Coordination History** (`2026062400`, append-only `flip_change_events`):
  who/when timeline for coordinated / processed / afm_approved / published /
  rejected, rendered per change card.
- **Standardized remarks** (`e74e8db5`): every lifecycle step captures a remark
  through the same prompt — a Remarks field on the Coordinate modal
  (coordinated), and Processing is now an explicit **Mark Processed** action
  (appears once a Processed Date is set) instead of a silent auto-log.
  Approve/Publish/Reject keep their panel; **Reject requires remarks**. Publish
  keeps operating-initials capture (§2.5.2.18.2.2.8) in the same panel.

### Changes Report + PDF export (`395365c1`)

New **Report** view under FLIP Changes (third pill beside Change Board /
Directions): a single-screen table of all coordinated changes — FLIP Title,
content categories, Reference Doc & Page, NOTAM, Status, Submitted By,
Coordinated + Published dates. Click-to-sort headers (FLIP title, status,
submitter, coordinated date); filters for FLIP, status, and change-content
category (Additions/Deletions/Revisions From/To). **Export PDF** renders the
filtered/sorted view to a landscape report (`lib/flip-changes-pdf.ts` →
`{doc, filename}`) with base header + filter summary. Reads existing
`flip_changes` — no schema change.

### Uploaded change PDF is openable (`22fc5c55`)

The submitted-change PDF was rendered inside the upload `<label>`, so clicking it
reopened the file picker. Now an uploaded PDF is an openable link (opens via the
proxy in a new tab) with a separate "Replace" control; the upload dropzone shows
only when no file exists.

### Structured Appointment Letter (`997483e6`)

Replaced the free-text "Current Appointment Letter" section with a structured one
(`2026062401`, `flip_appointment`, one row per base): upload the actual letter
file (PDF/DOCX → `flip` bucket, openable via proxy) + designate custodians — a
Primary plus addable Alternates (custodians stored as JSONB) + optional notes.

### Spec-compliance fix caught in review (`154e64b1`)

The final review flagged that submitted-stage date/PDF entry was visible to any
`flip:write` user; spec §4.3 reserves it for custodian/alternate. Gated on
`isCustodian` (also resolved an unused-prop warning). Publish/Reject stay
role-gated separately.

---

## Migrations status

All applied to the linked DB and verified this session.

| File | Applied | What |
|---|---|---|
| `2026062304_flip_permissions.sql` | ✅ live | `flip:*` keys + role grants (incl. civilian parallels) |
| `2026062305_flip_management.sql` | ✅ live | 8 module tables + RLS via matrix helpers |
| `2026062306_flip_storage_bucket.sql` | ✅ live | private `flip` bucket + storage RLS (base = path segment 1) |
| `2026062307_flip_sign_rpc.sql` | ✅ live | `flip_sign_review` sequential signing RPC + EXECUTE grant |
| `2026062400_flip_change_events.sql` | ✅ live | append-only coordination-history table |
| `2026062401_flip_appointment.sql` | ✅ live | appointment letter (file + custodians JSONB + notes) |
| `2026062402_flip_change_faa_fields.sql` | ✅ live | FAA columns on `flip_changes` (ref doc/page + 4 categories) |

No pg_cron involvement; the two live cron jobs (`wwa-expiry-sweep`,
`sms-spi-nightly`) are unaffected.

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Uploaded change PDF reopens the file picker instead of opening | filename rendered inside the upload `<label>` wrapping the hidden input | `22fc5c55` |
| Published Date settable with Creation Date empty (out-of-order dates) | date inputs were independent, no chaining | `d1ee5b7f` |
| Roles matrix listed every base member, not just AM staff | queried `base_members` with no role filter | `d5aafb84` |
| (review-found) non-custodians saw submitted-stage date/PDF entry | stage check alone, no `isCustodian` gate | `154e64b1` |

---

## Lessons from this session

- **`profiles` display column is `name` (+ separate `rank`), not `full_name`.**
  An early subagent assumed `full_name` and had to correct against
  `app/(app)/users/page.tsx`. Build `rank + ' ' + name` for display.
- **Theme token names that bit subagents repeatedly:** card surface is
  `--color-bg-surface` (not `--color-surface`); inset/recessed is
  `--color-bg-inset` (not `--color-surface-2`); semantic blue is `--color-blue`
  (there is no `--color-info`); status tokens are `--color-warning/success/danger`.
  When unsure, grep `app/globals.css` rather than guess.
- **`WriteType` lives in `lib/sync/types.ts`**, not `write-queue.ts` (which
  re-exports). Adding a write type also requires updating the exhaustive
  `TYPE_LABELS` map in `components/sync/queue-inspector.tsx` or the build fails.
- **NOTAMs have no table** — they come live from `/api/notams/sync?icao=…`. Any
  feature wanting "current NOTAMs" must fetch the feed and tolerate it being
  empty/unreachable (keep a manual fallback).
- **`npx supabase db query --linked --file <(echo …)` process substitution fails
  on this git-bash shell** (`/proc/<pid>/fd/...` not found). Write a real temp
  `.sql` file and pass that. The file-based migration apply works fine.
- **The `permissions` seed table has no `applies_to` column in the INSERT** (just
  `key,label,category,description` + `ON CONFLICT (key)`); `role_permissions` is
  `(role, permission_key)` + `ON CONFLICT … DO NOTHING`. Civilian roles
  `accountable_executive`/`ops_supervisor` are valid grant targets.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| FLIP help content lives in `app/(app)/help/page.tsx`, not `lib/training/modules.ts` | Low | New — FLIP renders as a Help tab but won't appear as a searchable Module card or in the Module Reference PDF until ported into the `MODULES` registry. |
| FLIP never live-smoke-tested | Med | New — verified via tsc/vitest/build + code review only. No human run-through (enable on a base → assign roles → coordinate/approve/publish → review/sign → export). |
| Old free-text `appt_letter` `section_key` now unused | Info | New — the CHECK still allows it; harmless. The Appointment Letter UI is `flip_appointment`-backed now. |
| `types.ts` not regenerated for recent schema | Med | Carried — all FLIP tables go through the untyped `db()` client via `as never`/`as`; regen as a batch. |
| pg_cron jobs depend on the extension staying enabled | Med | Carried — a DB *restore* may not replay migrations; re-enable `pg_cron` or both crons silently stop. |
| `base_members.role` is stale fleet-wide | Low | Carried — nothing authoritative reads it; permissions/reports/`isFlipEligibleRole` use `profiles.role`. |
| `base-config/setup/page.tsx` keeps growing | Med | Carried — ~6k LOC; extraction deferred. |
| Read File storage non-UUID path → 500 | Low | Carried — crafted direct-API path; left by user decision. |
| PPR info-only double-email edge case | Info | Carried — same address in coordinating + info-only group gets two emails. Accepted. |
| Lower-severity pentest items not done | Med | Carried — L-2 send-ppr authz, M-2 kiosk session, M-3 anon-RPC rate limiting, I-3 constant-time CRON, Next.js 14.2→15. `docs/security/Pentest_Audit_Fable5_2026-06-11.md` §5. |
| `send-ppr-coordination-request` has no explicit permission gate | Low | Carried — relies on UI gating; harden with L-2. |
| CSP is report-only | Low | Carried — promote to enforcing after monitoring. |
| `scn` missing on 26 USAF bases | Med | Carried — frozen `enabled_modules`. |
| New `defaultEnabled` modules don't reach existing bases | Med | Carried — FLIP is `defaultEnabled: false` so it's invisible until enabled per base in setup; same null-only fallback in `lib/installation-context.tsx`. |
| usr-analytics privacy disclosure | Med | Carried — no user-facing line. |
| Test-account fixtures live in prod | Info | Carried — `__TEST_RLS__` bases + `rls-*@glidepath-rls-test.com`. |

---

## Next session tasks

No required next step — the FLIP Management module is feature-complete for now
(user called it), committed, pushed, and all 7 migrations are live and verified.
Pick up wherever the user wants.

Informational, not required:

1. **Enable FLIP per base.** It's `defaultEnabled: false`, so it won't appear in
   any base's nav until turned on in the base-setup wizard. Migrations are
   additive and already live.
2. **Live manual smoke test of FLIP** before promoting — the one verification
   step not yet done (see tech debt).
3. **Optionally port the FLIP Help content** from `help/page.tsx` into the
   `lib/training/modules.ts` `MODULES` registry so it becomes a searchable Module
   card + flows into the Module Reference PDF.

### Long-running carryover (bandwidth-permitting)
- Lower-severity pentest items (L-2 + server-side gate on
  `send-ppr-coordination-request`, M-2, M-3, I-3, Next.js upgrade).
- `types.ts` regen (now also covers the FLIP tables); `base-config/setup`
  extraction.
- `scn` `enabled_modules` backfill + the systemic null-only fallback fix;
  usr-analytics privacy copy.
- `base_members.role` data backfill / column retirement (low priority).

---

## Build snapshot

```
Build: npm run build — compiled successfully.
TypeScript clean (npx tsc --noEmit exit 0).
Tests: 908 pass / 95 files (npx vitest run) — incl. tests/flip-roles.test.ts (15).

New routes (First Load JS):
  /flip                     17.6 kB / 348 kB   (Home + Changes [+ Report] + Reviews)
  /flip/roles                1.9 kB / 172 kB   (roles admin matrix)
  /api/flip-file               0 B             (authenticated download proxy)
First Load JS shared        91.6 kB
Middleware                  74.6 kB
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-06-24 | FLIP Management module (`/flip`, dual-mode, `defaultEnabled:false`): electronic FLIPs Continuity Binder per DAFMAN 13-204V2 §2.5.2.18 — Account Overview + structured Appointment Letter (file + custodians), Local FLIP List, References; FLIP Changes pipeline (FAA-format coordinate dialog, NOTAM-feed + FLIP-list dropdowns, auto name/rank, role-gated publish/reject, chained dates, coordination-history timeline with standardized remarks, openable PDFs); FLIP Reviews with sequential Custodian→NAMO→AFM sign-off + signed PDF; sortable/filterable Changes Report + landscape PDF export; AMTR-style per-module roles admin; migrations `2026062304`–`2026062402` |
| **Unreleased** | 2026-06-23 | WWA expiration moved server-side (pg_cron `wwa-expiry-sweep`; dialog overnight/past guard; "System" actor labels — `2026062301–02`); enabled `pg_cron`; revived dormant `sms-spi-nightly` + backfilled June (`2026062303`) |
| **Unreleased** | 2026-06-23 | Read File module (`2026062100–04`); PPR info-only recipient groups (`2026062300`); QRC revised-since-review notification; role-drift fix (read `profiles.role`); parking aircraft-label display + A321-200; obstacle-NOTAM generator |
| **Unreleased** | 2026-06-22 | PPR module batch: calendar month view; re-open denied PPRs into coordination; Transient Aircraft board (`2026062017`); approval `.ics` invite + per-agency toggle (`2026062018`); external agency recipients (`2026062019`); remind-pending-agencies |
| **Unreleased** | 2026-06-11 | Pentest remediation: self-escalation close (`2026062013`), daily-review forgery RPC, installations IDOR, email-route authz, invite password, map XSS, photo-read auth proxy (H-5), middleware/CSP/header hardening; AE granted `aep:write` (`2026062016`); forgot-password email + discrepancy-PDF fixes |
| **v2.34.0** | 2026-06-01 | Help & Training covers every module + airport-type gating; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination + notify; Records Export; grouped What's New |
| v2.33.0 | 2026-05-02 | Glidepath Training rebuilt, permission-matrix overhaul, PPR module, offline reads + writes |

---

## Key docs / files touched this session

### New files
- `docs/superpowers/specs/2026-06-23-flip-management-design.md`,
  `docs/superpowers/plans/2026-06-23-flip-management.md` — spec + 18-task plan.
- `lib/flip/roles.ts`, `lib/flip/roster-roles.ts`, `tests/flip-roles.test.ts`.
- `lib/supabase/flip.ts`, `lib/supabase/flip-storage.ts`,
  `app/api/flip-file/route.ts`, `lib/flip-pdf.ts`, `lib/flip-changes-pdf.ts`.
- `app/(app)/flip/page.tsx`, `app/(app)/flip/roles/page.tsx`.
- `components/flip/` — `editable-section`, `flip-list-panel`, `references-panel`,
  `appointment-letter-section`, `change-board`, `change-card`, `coordinate-modal`,
  `change-report`, `document-review-modal`, `review-signoff`, `reviews-panel`.
- `supabase/migrations/2026062304`–`2026062402` (7 files).

### Modified files
- `lib/permissions.ts` (`PERM.FLIP_*`), `lib/modules-config.ts` (module entry +
  `ModuleKey`), `lib/sidebar-config.ts` + `components/layout/sidebar-nav.tsx`
  (nav under Admin), `app/(app)/more/page.tsx` (More-tab Admin entry).
- `lib/sync/types.ts` + `lib/sync/handlers.ts` +
  `components/sync/queue-inspector.tsx` (`flip_review_sign` write handler).
- `app/(app)/help/page.tsx` (FLIP Help tab).
