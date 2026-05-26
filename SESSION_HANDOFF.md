# Session Handoff

**Date:** 2026-05-26
**Branch:** `feat/faa-part-139` (6 commits ahead of `main`; not yet pushed)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (353 pass / 33 files)
**HEAD:** `71a67d7`

---

## What shipped this session

**Phase 3a of the FAA Part 139 commercial expansion** — the
**§139.303 Training module** — landed end-to-end on a dedicated
feature branch, reviewed at each of the five plan gates (Phase A
through Phase E). Six commits, all on `feat/faa-part-139` off `main`
@ `ed7f885`. The branch is the first time this project has worked
off `main` since the v2.30 cycle dropped the `tweaks` branches.

The module is feature-complete: 13 §139.303(e) topic seeds, per-user
records with stored expiry + explicit renewal chains, AAAE / ACE
certificates, compliance matrix dashboard, daily expiry-digest cron,
and per-user PDF transcripts. The whole surface gates civilian-only
via the existing `appliesTo: ['faa_part139']` plumbing; USAF bases
see zero change.

### Phase A — Rename + schema + module wiring (commits `1932c32`, `3170b44`, `6fb9abc`)

- **`/training` → `/help` rename** (`1932c32`): moved the existing
  in-app help subtree (the "Glidepath Training" route with 27 module
  deep-dives) to `/help` so the §139.303 module could take the
  `/training` slug at its target URL from day one. 13 files touched
  including a one-time href rewrite shim in `loadSidebarConfig` that
  migrates saved user sidebar configs inline on next load.
- **Schema** (`3170b44`): 5 migrations applied via `npx supabase db
  query --linked --file`. Tables `training_topics` (with base_id
  NULL system rows + 13 §139.303(e) seeds), `training_records` (with
  `_training_set_expiry` trigger that reads topic frequency at
  INSERT time so the stored expiry preserves the rule that was in
  effect), `training_renewals` (explicit chain with denormalized
  base_id for RLS), `training_certificates` (5-value enum).
  Matrix-helper RLS one-for-one with the SMS pattern. The role-grant
  migration fills the gaps in Phase 1's `2026052503` seed for all
  five civilian roles after walking each role's actual training
  workflow.
- **Module + sidebar wiring** (`6fb9abc`): module-config entry,
  Training & Compliance section at index 3 (between SMS and
  Reference), `/more` collapsible group, plus 4 stub pages so the
  navigation lands cleanly.

### Phase B — CRUD + topic catalog + roster (commit `a3369eb`)

- **`lib/supabase/training-part139.ts`** (~390 LOC): mirrors the
  `lib/supabase/sms.ts` shape. Topic / record / cert CRUD plus the
  pure `classifyTrainingStatus(latestRecord, now?)` function that
  drives every status chip in the module. Status thresholds: > 90 d
  → current, 30–90 d → expiring, < 30 d OR past → expired, no record
  → not_started. `daysToExpiry` uses midnight-UTC truncation so a
  record expiring 2027-05-26 read at noon 2027-04-26 returns 30 (not
  29.5 from floor-rounded ms math). Wrong rounding here was caught
  by the test suite, not by manual QA — a near-miss for the digest
  cron firing a day early.
- **`/training/topics`**: lists the 13 system topics + base-custom
  topics. Edit modal: system rows clone-into-override on save;
  base rows update in place. Add Custom Topic for base-specific
  entries outside the §139.303(e) list.
- **`/training/roster`**: bulk-fetch members + topics + records,
  compute per-user counts in memory, sort worst-status-first
  (`expired×100 + expiring×10 + not_started`). Search + status
  filter chips. Click row → user detail.

### Phase C — User detail + Log Training + certificates + storage RLS (commit `df97ccb`)

- **`/training/[userId]`** (~830 LOC): three-tab page (Records /
  Certificates / History). Records tab lists every active topic
  with status chip + expandable renewal chain. Certificates tab
  handles add / edit / delete with lifetime-cert support. History
  tab pulls activity_log rows for the user's records + certs.
- **Log Training modal**: auto-detects `training_type` from the
  prior record's status (recurrent if not yet expired, else
  initial). Instructor picker pulls base members; falls back to
  free-text for external instructors. Evidence upload generates a
  client-side UUID, uploads to the photos bucket at
  `training-evidence/<base>/<user>/<record>/evidence-<ts>.<ext>`,
  then inserts the record with that UUID and the public URL.
  Renewal chain link inserts when training_type = recurrent AND a
  prior record exists.
- **Storage RLS** (`2026053005`): separate INSERT policy on
  `storage.objects` for `training-evidence/*` paths, gated only on
  `training_part139:write` + base access on path segment 2. Does
  NOT extend the existing `photos_insert_path_scoped` policy
  because `arff_chief` holds `training_part139:write` but not
  `photos:write`. RLS policies of the same role/op are OR'd so
  both paths coexist. Rationale captured in the migration header.

### Phase D — Compliance matrix + digest cron + PDF transcript (commit `71a67d7`)

- **`/training/compliance`** (5.92 kB): users × topics matrix with
  sticky-left member column and sticky-top topic header. Cells
  show a status glyph + expiry date in compact YYMMDD form. Tap a
  cell → drill modal with the chain history + jump-to-user-detail
  link. Stats row totals each bucket across all cells. CSV export
  emits one row per member with status + expiry per topic.
- **Expiry digest cron** (`/api/training-expiry-digest` + `vercel.json`
  + `2026053006`): Vercel cron daily at 13:00 UTC. POST handler
  gated by `Authorization: Bearer ${CRON_SECRET}`. Service-role
  Supabase client scans every civilian base. Algorithm finds
  training_records with expires_at in [today, today+30d], filters
  to the latest-by-completed_at per (user, topic), groups by
  (base, user), inserts dedup-log row (`training_digest_log`
  UNIQUE on `(base, user, send_date)`), sends Resend email, rolls
  back the dedup row on Resend failure so a re-run can retry.
  Recipient is `bases.default_pdf_email` for v1.
- **`lib/training-part139-pdf.ts`**: per-user transcript using
  `lib/pdf-utils.ts`. Sections: header / title block / 6-count
  stat box / topic-level table with status-tinted cells / renewal
  history per topic with > 1 record / AAAE-ACE certificates table.
  Wired to a "Transcript" button in the user detail header.

### Phase E — Tests + polish (this commit, pending)

- **`tests/training-part139.test.ts`** (+12 tests): classifier
  thresholds (6 cases including the time-of-day edge case that
  surfaced the daysToExpiry rounding bug), `daysToExpiry`
  positive/negative/Date-object cases, PDF smoke for empty /
  populated / filename-sanitized inputs.
- **Activity log integration**: confirmed every CRUD mutation in
  `training-part139.ts` wraps with `logActivity()`. Topic /
  record / certificate writes all log; the chain-link insert into
  `training_renewals` is intentionally not separately logged since
  the parent record insert's log covers the operation semantically.
- **Light-mode QA**: zero raw `text-zinc-*` / `bg-zinc-*` /
  `text-amber-*` etc. classes in any new surface. Every chip and
  panel uses `color-mix()` against theme vars + dark-saturated
  rgb text — readable in both modes by design (the lesson from
  Phase 2's three-round-trip SMS theme fix).
- **No-snake-case prose audit**: zero `accountable_executive` /
  `sms_manager` etc. literals in user-facing copy.

---

## Migrations status

| File | Applied | What it does |
|---|---|---|
| `2026053000_training_part139_topics.sql` | ✅ | training_topics table + 13 §139.303(e) system seeds |
| `2026053001_training_part139_records.sql` | ✅ | training_records + training_renewals + _training_set_expiry trigger |
| `2026053002_training_part139_certificates.sql` | ✅ | training_credential enum + training_certificates |
| `2026053003_training_part139_rls.sql` | ✅ | Matrix RLS on all 4 tables gated by training_part139:read / write |
| `2026053004_training_part139_role_grants.sql` | ✅ | Fills civilian-role gaps from 2026052503 (10 grants total) |
| `2026053005_training_storage_rls.sql` | ✅ | Separate INSERT policy on storage.objects for training-evidence/* |
| `2026053006_training_digest_log.sql` | ✅ | Per-day dedup table for the digest cron |

Tracker remains empty project-wide.

---

## Bugs caught during the build

| Symptom | Root cause | Caught by |
|---|---|---|
| Initial `git mv` of `app/(app)/training` failed with "permission denied" on Windows | Likely a Windows file lock from a background process or antivirus. PowerShell `Move-Item -Force` succeeded immediately | Manual fallback during Cluster 0 |
| `supabase` CLI not on PATH; only available via `npx supabase` | Project doesn't install Supabase CLI globally. Updated convention is `npx supabase db query --linked --file` (memory already noted `db query --linked`; the `npx` prefix is the missing piece) | First migration apply |
| `--query` flag not supported on `npx supabase db query` (only `--file`) | CLI v2.101 requires SQL in a file, no inline mode. Wrote verification SQL to /tmp files | Cluster 1 verification |
| Iterator-over-Set tsc error in roster page | Project TS target predates ES2015 downlevelIteration. `for...of (set)` doesn't compile; `Array.from(set).forEach` does | Cluster 4 tsc |
| Same iterator issue in compliance page (over Map.values()) | Same root cause | Cluster 7 tsc |
| daysToExpiry off-by-one when reading from midnight YYYY-MM-DD vs noon UTC now | Original `Math.floor(diff_ms / 86_400_000)` lost half a day, returned 29 when 30 was expected. Would have made the digest cron fire a day early at production scale | New test suite — `recordWithExpiry(30)` failed `toBe('expiring')`. Fix: truncate both sides to UTC midnight, round to whole calendar days |
| ARFF chief couldn't have been able to upload evidence | They hold `training_part139:write` but NOT `photos:write`. Existing `photos_insert_path_scoped` requires `photos:write` | Anticipated during Cluster 6 design; resolved by a separate INSERT policy gated only on `training_part139:write` |

---

## Known issues / tech debt (deferred from Phase 3a)

| Item | Severity | Notes |
|---|---|---|
| Branch not yet pushed to origin | Low | Push when ready: `git push -u origin feat/faa-part-139`. PR back to main when Phase 3 stabilizes (or land it now as a milestone). |
| CRON_SECRET env var not yet set in Vercel | High before deploy | Required for `/api/training-expiry-digest` to function. Generate a long random secret in Vercel dashboard → env vars → both production + preview. Without it the cron returns 500. |
| Storage orphan files | Low | Deleted training_record rows leave orphan files in `photos/training-evidence/...`. No cleanup job yet. Add a future maintenance sweep that joins records vs storage. |
| Per-user opt-in for digest recipients | Medium | v1 uses `bases.default_pdf_email` as sole recipient. Real-world might want per-user opt-in or role-based routing. Defer to pilot feedback. |
| Sidebar overdue-count badge | Low | Plan called for a badge with a `count_overdue_training(p_base_id)` RPC + the polling-defaults hook. Deferred to a future polish; the compliance dashboard counts are visible at the top stats row when admins land on `/training/compliance`. |
| PDF roster export (multi-user matrix) | Low | Compliance page has CSV export. PDF roster (one PDF, all members × all topics) deferred. CSV is sufficient for inspector packets in v1. |
| `/training/[userId]` "Email Transcript" button | Low | Plan called for an Email-Transcript wrapper around `sendPdfViaEmail`. Download works; email wiring deferred. |
| Digest test (mocked Supabase + Resend) | Medium | Wanted but not written. The route's algorithm is well-defined and the dedup table makes manual re-runs safe — a curl test post-deploy is the v1 verification. |
| Tour anchors / module bar | Low | Plan deferred to post-pilot feedback. |
| Help page rename — public/training/ asset directory kept | Low | The 36 module screenshots in `public/training/` still resolve via that URL. Leave-as-is is the right call but worth a re-check when public docs reference the help guide. |
| Trademark | Held | Carryover. CDW holds the live "GLIDEPATH" Class 42 (SaaS) registration — legal critical path before commercial launch. |

---

## Lessons from this session

- **Test the pure-function thresholds with calendar-day-realistic
  inputs.** The `daysToExpiry` floor-rounding bug compiled, type-
  checked, looked reasonable in code, and would have manifested as
  "the expiry digest fires one day early at noon every Sunday" in
  production. The test (`recordWithExpiry(30) → 'expiring'`) caught
  it because the test uses a noon-UTC `NOW` against a midnight-UTC
  `expires_at` — the same shape the live data will have. Generic
  "thresholds work in isolation" tests would have passed. The fix
  is to truncate to calendar-day on both sides; the lesson is that
  unit tests need to reflect the real-world time-of-day shape of the
  data, not synthetic times that happen to round cleanly.

- **A separate RLS policy is sometimes the right answer.** I
  considered extending the existing `photos_insert_path_scoped`
  policy with a new `training-evidence/%` OR branch, but that would
  have required also granting `arff_chief` the `photos:write`
  permission to keep that role functional. Adding a separate policy
  gated only on `training_part139:write` keeps the surface change
  scoped to the new module and avoids broadening unrelated
  permissions. RLS policies of the same role/op are OR'd, so
  there's no functional cost.

- **Per-cluster review gates worked.** Phase 2 (SMS) shipped as one
  continuous build and produced three round-trip fixes after
  deploy. Phase 3a shipped as 5 reviewed phases and produced zero
  round-trip fixes — the iterator type errors, the supabase CLI
  flag mismatch, the daysToExpiry rounding, and the ARFF chief
  permission shape were all caught inside the gate window by tsc /
  tests / structured design review. Per the Phase 2 lesson:
  "Phase 3 has more novel UX — probably wants per-cluster gates."
  That call paid off.

- **The `npx supabase db query --linked --file` invocation is the
  only safe way to apply migrations.** Memory said "use `db query
  --linked --file` for single migrations" but didn't include the
  `npx` prefix. Important enough to capture: this project has no
  global supabase install. Pinning the convention in a memory.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 353 pass / 33 files (+12 from baseline 341; new file:
       tests/training-part139.test.ts — 12 cases covering the
       classifier, daysToExpiry, and the PDF generator smoke)
Build: npm run build compiled successfully.

Training routes (new this session):
  /training              1.84 kB / 102 kB
  /training/[userId]    14.5  kB / 340 kB  (dynamic; jsPDF import inflates First Load)
  /training/topics       5.67 kB / 182 kB
  /training/roster       4.59 kB / 172 kB
  /training/compliance   5.92 kB / 182 kB
  /api/training-expiry-digest — dynamic

Help route (renamed):
  /help                  5.03 kB / 198 kB
  /help/[module-id]      3.81 kB / 188 kB

Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | **Phase 1 + 2 + 3a of FAA Part 139 commercial expansion** — `airport_type` dual-mode flag, civilian terminology / reg filter / PDF generators / wizard, Part 77 obstruction surface constants, Demo Regional Airport (KDRA) seeded as civilian test base, SMS module shipped (Phase 2), **§139.303 Training module shipped this session** on `feat/faa-part-139` branch: 4-table data model, 13 §139.303(e) topic seeds, AAAE / ACE certificates, compliance matrix, daily expiry-digest Vercel cron, per-user PDF transcript. AMTR module merged to `main` (off-nav). iOS PWA safe-area fixes, photo picker collapse, /more page Admin completeness, light-mode theme sweep across the SMS module. Build clean. Not merged-tag yet. |
| v2.33.0 | 2026-05-02 | prior released baseline (see CHANGELOG) |

---

## Next session tasks

**First**: push the branch (`git push -u origin feat/faa-part-139`)
and set `CRON_SECRET` in the Vercel dashboard env vars (production +
preview). Without the secret the cron returns 500 every fire; with
the secret the first fire is the morning after deploy at 13:00 UTC.

**Then choose**:

1. **Verify Phase 3a on KDRA via iPhone PWA.** Walk every new
   surface — topics edit + override, roster sort + filter, log
   training (with evidence upload), renew (chain link), add cert,
   compliance matrix tap-through, download transcript. Confirm
   light-mode contrast on each. Findings → small follow-up
   commits if anything surfaces.

2. **Continue Phase 3b** — the next sub-module per the parent plan
   at `C:\Users\cspro\.claude\plans\i-want-to-re-wobbly-koala.md`
   §"Phase 3 sequence". Recommended order: AEP (Airport Emergency
   Plan), then Part 77 obstruction UI, then Field Conditions /
   TALPA, then WHMP hooks.

3. **Merge `feat/faa-part-139` → `main`** if Phase 3a is the
   release boundary. Merge straight (no PR review process exists
   today) or open a PR if you want to capture the diff for a
   capability briefing.

### Long-running carryover

- Acquire the 22 FAA regulation PDFs and populate `regulations.url`
  / `storage_path` for rows seeded by Phase 1 migration `2026052502`.
- Brief the Platform One sponsor on the dual-mode plan AND the
  SMS-public-route exposure. Recommend `BUILD_TARGET=usaf` tree-shake.
- Trademark resolution (CDW "GLIDEPATH" Class 42 registration).
- Identify 3 Class III non-hub commercial airports for post-build
  pilot conversation.

---

## Key files touched this session

### New

- `supabase/migrations/2026053000_training_part139_topics.sql`
- `supabase/migrations/2026053001_training_part139_records.sql`
- `supabase/migrations/2026053002_training_part139_certificates.sql`
- `supabase/migrations/2026053003_training_part139_rls.sql`
- `supabase/migrations/2026053004_training_part139_role_grants.sql`
- `supabase/migrations/2026053005_training_storage_rls.sql`
- `supabase/migrations/2026053006_training_digest_log.sql`
- `lib/supabase/training-part139.ts` (~390 LOC CRUD + classifier)
- `lib/training-part139-pdf.ts` (~210 LOC PDF generator)
- `app/(app)/training/page.tsx` (landing — replaces the moved subtree)
- `app/(app)/training/topics/page.tsx`
- `app/(app)/training/roster/page.tsx`
- `app/(app)/training/[userId]/page.tsx`
- `app/(app)/training/compliance/page.tsx`
- `app/api/training-expiry-digest/route.ts`
- `vercel.json` (first one in the repo)
- `tests/training-part139.test.ts` (+12 tests)

### Renamed

- `app/(app)/training/` → `app/(app)/help/` (subtree, both halves
  tracked as renames by git)
- `lib/tours/pages/training.ts` → `lib/tours/pages/help.ts` (was
  dormant — TRAINING_PAGE_TOUR was never imported by the registry)

### Modified

- `lib/sidebar-config.ts` — rename hrefs, add Training & Compliance
  section, one-time HREF_REWRITES shim for saved sidebar configs
- `lib/modules-config.ts` — `/help` in ALWAYS_ON_HREFS, new
  `training_part139` module entry
- `lib/supabase/types.ts` — Row/Insert/Update for the 5 new tables
- `app/(app)/more/page.tsx` — refItem rename, training139Items group
- `components/welcome-gate.tsx` — `/training` push → `/help`, label
- `components/layout/sidebar-nav.tsx` — HREF_TO_VIEW_PERM map update
- `components/training/module-card.tsx` + `lib/training/modules.ts` —
  comment + href updates (the lib/training/ data folder stays;
  its href targets now point at /help/)
- `tests/modules-config.test.ts` — assertion update for /help
- `CLAUDE.md` — module table entry
- `SESSION_HANDOFF.md` — this file
