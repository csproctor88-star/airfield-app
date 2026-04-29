# Session Handoff

**Date:** 2026-04-28 (continued)
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓
**HEAD:** `596d947`

---

## What shipped this session

**6 commits** on `main`. Mostly docs / terminology / a real perf fix on the Visual NAVAIDs page / a real plain-language fix on the discrepancy Notes History audit trail. **One new migration** (`2026042904`) introduced and **NOT YET APPLIED** to prod.

### CLAUDE.md: refresh stale facts (`f79bd86`)

The repo's primary onboarding doc had drifted. Fixed in one pass:

- RLS helpers section listed `user_can_write` / `user_is_admin` (both dropped in `2026042208`). Replaced with the matrix-based pattern: `user_has_permission(auth.uid(), '<key>')` + `user_has_base_access(auth.uid(), base_id)`.
- Branch convention claimed `tweaks` is the active branch and `main` is release-only — true once, not anymore. Only `main` exists locally + on origin since the v2.30 cycle. Co-author trailer also bumped 4.6 → 4.7.
- Modules table: `/parking` was marked 🆕 but it's been around since 2026-03-14 (v2.20) — set to ✅. Added `/scn` and `/daily-reviews` rows (both shipped but missing). Added `/users` next to `/settings/users` (both routes exist). Migration count 135 → 174.
- Status legend: dropped the "🆕 added in v2.31–v2.32" tier since no remaining modules are flagged new.

### Capabilities doc v2.32 + FOD Check terminology cleanup (`d4858cb`)

New artifact: `docs/Glidepath_Capabilities_v2.32.md` (~11 K words, 1073 lines on initial commit; user revised it down to ~1041 lines in subsequent edits). Replaces the v2.27 / v2.33 drafts deleted in the 2026-04-13 docs cleanup. Mixed audience (decision-makers + working AFMs / NAMOs / AMOPS personnel). Six parts — At a glance / Why Glidepath / Operational core / Specialized modules / Reports-Reference-Admin / Platform capabilities / Integrations & deployment / Regulatory coverage matrix — plus Appendix A (module-permission table) and Appendix B (route inventory). Built fresh from the codebase + CLAUDE.md, not from `docs/manual/`. No screenshots — text-only so it doesn't go stale on UI iteration.

Same commit: cleanup of the 7 surviving "FOD walk" stragglers in `docs/manual/03_airfield_checks.md` (×2), `lib/modules-config.ts`, `lib/regulations-data.ts`, `supabase/seed-demo-walkthrough.sql` (×2), and `app/(app)/activity/page.tsx`. The PDF export label was already migrated per `CHANGELOG.md:1523`; that historical line stays as the audit trail.

### Discrepancy notes history: humanize raw current_status enum (`fea5ea5`)

Audit found: every discrepancy current_status transition was writing `notes: 'CURRENT_STATUS: <enum>'` (e.g., `CURRENT_STATUS: awaiting_action_by_ces`) into `status_updates.notes`. The discrepancy detail page rendered that field verbatim in the Notes History panel. Two write paths had the same bug — the TS path (`lib/supabase/discrepancies.ts:222`, used by AFM/AMOPS/NAMO) and the SECURITY DEFINER RPC for CES users (`2026042201_ces_update_discrepancy_rpc.sql:94`).

Three-part fix:

1. **`lib/supabase/discrepancies.ts`** — added `currentStatusLabel()` helper using `CURRENT_STATUS_OPTIONS` lookup. Audit insert now writes `Status changed to: Awaiting Action by CES`.
2. **`app/(app)/discrepancies/[id]/page.tsx`** — added `formatStatusUpdateNotes()` that recognizes the legacy `CURRENT_STATUS: <enum>` prefix and rewrites it on read, so historical rows already in the DB display cleanly without a backfill. Also added `statusLabel()` so the `Status: x → y` line shows `Open → Completed` instead of raw lowercase. Both helpers flow into the PDF `notesHistory` mapping.
3. **`supabase/migrations/2026042904_ces_rpc_humanize_status_note.sql`** (new) — `CREATE OR REPLACE` on `ces_update_discrepancy` with a `CASE` mapping that mirrors `CURRENT_STATUS_OPTIONS`. **Pending application to prod.**

Discovered via a two-Explore-agent audit of the rest of the app for snake_case-to-user leaks. Everything else is clean — every status enum elsewhere has a label map (`CURRENT_STATUS_OPTIONS`, `WAIVER_STATUS_CONFIG`, `ACSI_STATUS_CONFIG`, `STATUS_META`, `SCN_STATUS_LABELS`, `formatPprColumnValue`) and uses it at render time.

### Visual NAVAIDs: stabilize zoom with all layers enabled (`14045e1`)

User-reported instability when zooming with every feature layer enabled at a base with a few thousand lights / signs. Root cause: the `idle`-fired rescale loop in `app/(app)/infrastructure/page.tsx` walked every marker and called `marker.setIcon(...)` on each, forcing Google Maps to re-rasterize. With ~thousands of markers, that's the dominant cost on every fractional zoom step. Made worse by the original 0.4 → 2.0 scale curve interpolating linearly across zoom 12-18, so almost any zoom adjustment produced a different scale value.

Three targeted changes, all in the rescale `useEffect` and the helpers:

1. **Reshape the scale curves** (`zoomScale`, `zoomCircleRadius`). New curve is **flat at 0.30 / 3 px below zoom 16**, then ramps 16 → 19 to 1.40 / 16 px. Most zoom transitions land in the flat region and become no-ops. Side benefit: features stay reasonably sized at airfield-overview zoom (14-15) instead of growing chunky.
2. **Hide every feature marker + overlay circle below zoom 13** via `setMap(null)`. New `featuresHiddenRef` tracks prior state so the flip only runs on threshold cross. `renderFeatures()` honors the same threshold on initial draw so layer toggles while zoomed out don't briefly flash. Below zoom 13 the field is a tiny dot anyway and Google Maps stops rasterizing mapless markers entirely — single biggest win.
3. **Scale-delta short-circuit.** New `lastScaleRef`. After computing the new scale, if `|new - last| / last < 0.10`, return without walking markers.

Out of scope (separate optimizations if needed): full `renderFeatures` rebuild on layer toggle, health-ring `Circle` volume when "Color by health" is on, audit-mode panel cost.

### Rename Training nav label to "Glidepath Training" (`602e314`)

Disambiguates the in-app guidance module from airfield management training records / personnel training compliance — users were assuming "Training" meant the latter and skipping the page. Three small label changes (`lib/sidebar-config.ts`, `app/(app)/more/page.tsx`, `CLAUDE.md` modules table) plus the `### 3.5` heading in the capabilities doc. Page header inside `/training` already read "Glidepath Training" so the in-page experience was already consistent. Permission key label `'View Training Page'` left as-is — only visible in the admin permission editor; not worth a new migration.

### Docs: terminology + factual sync after capabilities-doc revisions (`596d947`)

While I was working, the user revised the v2.32 capabilities doc directly with a batch of terminology preferences and factual corrections. Propagated the durable ones to every other doc and tightened the doc itself for internal consistency:

- Capabilities doc: Daily Inspections regulatory backing line `Vol 1 → Vol 2` (matches the "What it does" sentence the user already updated above); `ACSI book → ACSI report` in the PDF generators list.
- `docs/manual/01_airfield_status.md` + `02_dashboard.md`: every `AFM Out of Office` rewritten to `Airfield Management Out of Office`, matching the doc and the long-form module name.

Memory (auto-memory dir, not in any commit):
- `feedback_glidepath_glossary.md` (new) — single glossary covering WWA Notifications (vs Advisories), Quick Reaction Checklists (full QRC expansion), USDA notified (vs BASH officer), MAJCOM RFM/FAM (vs RFM alone), ACSI report (vs book), AMOPS Out-of-Office, daily SCN check log. Each entry says where the user-facing copy lives and where internal identifiers (`advisory_type` column, `--advisory-padding` CSS, etc.) are exempt.
- `feedback_amops_terminology.md` extended: "AMOPS personnel" added as the preferred plural; "AMOPS staff" explicitly disallowed.
- `project_permission_matrix.md`: `MAJCOM/RFM → MAJCOM RFM/FAM` in two spots.
- `MEMORY.md` index updated to point at the new glossary.

---

## Migrations status

All applied to prod by session end.

| Migration | Status | What it does |
|---|---|---|
| `2026042904_ces_rpc_humanize_status_note.sql` | ✅ Applied | `CREATE OR REPLACE` on `ces_update_discrepancy` so the audit note written to `status_updates.notes` says `Status changed to: <Label>` instead of `CURRENT_STATUS: <enum>`. |

Both write paths now emit human-readable text from the start. The rendering defense in `app/(app)/discrepancies/[id]/page.tsx` continues to rewrite the legacy `CURRENT_STATUS: <enum>` rows already in the DB on read — no backfill required.

---

## Bugs fixed during the session (worth tracking)

| Symptom | Root cause | Commit |
|---|---|---|
| Notes History on a discrepancy showed `CURRENT_STATUS: awaiting_action_by_ces` (raw enum) | Both write paths wrote a synthetic `CURRENT_STATUS: <enum>` notes string with no humanization | `fea5ea5` (TS humanizes on write; rendering humanizes on read for legacy rows; new migration humanizes the CES RPC) |
| Visual NAVAIDs page extremely laggy when zooming with all layers enabled | Scale curve produced a new value on every fractional zoom step → idle listener walked every marker and `setIcon()`'d each (Google Maps re-rasterizes per call) | `14045e1` (flat curve below 16 + hide below 13 + scale-delta short-circuit) |
| "Training" sidebar link confused users into thinking it was personnel training records | Label was just "Training" — ambiguous | `602e314` (renamed to "Glidepath Training") |
| 7 surviving "FOD walk" stragglers in code/docs/seed after the original PDF-label migration | Cleanup pass missed the manual, module-config, regulations tags, demo SQL, activity-page placeholder | `d4858cb` |
| CLAUDE.md said `user_can_write` is a current RLS helper | CLAUDE.md not updated when `2026042208` dropped the legacy helpers | `f79bd86` |

---

## Lessons from this session

- **Audit trails are user-facing.** Anything that lands in a `notes` field, a `details` field, an `update.notes`, an `entity_display_id` — assume an Airfield Manager will read it. Never write a synthetic `KEY: <enum>` audit string. Humanize at the write site (so the DB stays clean) AND defend at the read site (so historical rows display cleanly without a backfill).
- **Per-marker `setIcon()` is the dominant cost in Google Maps overlays.** Flat scale curves + threshold-based `setMap(null)` + change-delta short-circuiting beat any amount of cleverness on the per-call side. The rescale loop ran on every `idle` event regardless of whether scale actually changed — fixing that one early-return saved more than the curve reshape did.
- **When the user is editing the same doc you are, expect Edit-tool conflicts.** The "file modified since read" error fired three times this session on the capabilities doc. The fix is to re-Read before each retry. The user's edits and yours aren't a merge conflict — they're sequential — so re-reading + re-editing always works.
- **Terminology has accumulated cost.** Every wrong noun in a doc gets repeated. The user's revisions (WWA Notifications, AMOPS personnel, MAJCOM RFM/FAM, ACSI report, USDA notified, Quick Reaction Checklists) come from real-world correctness drift — settle them in `feedback_glidepath_glossary.md` so the next session doesn't reintroduce them.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **Discrepancy "Notes History" backfill** | Optional | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; the rendering defense rewrites on display. A backfill UPDATE would clean the underlying data but isn't necessary. |
| **Visual NAVAIDs further perf wins** | Deferred | Layer-toggle full-rebuild, health-ring `Circle` volume when "Color by health" is on, audit-mode panel. Pick up only if user reports more lag after the zoom changes settle. |
| **UI labels for "Advisories" → "WWA Notifications"** | Deferred | Glossary memory says the user-facing copy is "WWA Notifications", but the actual button labels in the running app still say "Advisories" / "Post Advisory" / etc. Not changed this session — would require coordinated code + manual updates. Internal identifiers (`advisory_type` DB column, `advisoryDraft*` state) stay either way. |
| **Permission key label `'View Training Page'`** | Low | Visible only in the admin permission editor. Update opportunistically next time a permission migration ships. |
| **Sequential PPR coordination** | Deferred | Inherited. All assigned agencies see their work in parallel; no ordering. |
| **Public PPR form file uploads** | Deferred | Inherited. Out of scope unless requested. |

---

## Next session tasks

The active backlog is empty. Pick up wherever the user wants — no required next step.

### Long-running carryover from prior sessions

Pick from these only when bandwidth allows or a customer asks. Not a priority ranking — group by appetite.

- **Offline reads** for QRC + Regulations. Workbox runtime caching is already wired for some routes; add these two.
- **Component extraction** for 4 K+ LOC pages (`base-setup`, `parking`, `infrastructure`) — explicitly multi-session work. Pure refactor, large test surface.
- **CAC/PIV authentication** (blocked on Platform One).
- **Outage analytics, training management, Part 139 civilian template.**

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests not re-run this session — none of the touched surfaces have test
coverage; prior baseline was 247 pass and remains valid.

No bundle size deltas to flag — changes were docs (text-only) + small
TypeScript edits in existing files.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-04-28 (cont.) | Capabilities doc v2.32 + FOD Check terminology cleanup, discrepancy Notes History humanization (TS + rendering + migration `2026042904` applied), Visual NAVAIDs zoom stabilization (flat curve + hide-below-13 + scale-delta short-circuit), Training nav rename → "Glidepath Training", CLAUDE.md drift fixes (RLS helpers, branch, modules table, migration count), terminology glossary memory file. 6 commits. |
| **Unreleased** | 2026-04-28 | PPR commercial phone + ETA Zulu spine, soft-cancel status + email, AMOPS delete/approve perms, manual-coord-pending save mode, slim Log + Today's PPRs panel, `formatPprColumnValue` helper for time/yes_no_na/date, ACSI per-member signature toggle + additional-members divider, sidebar badge polling cuts. Four migrations applied. |
| **Unreleased** | 2026-04-27 (cont.) | Same-day follow-up: denial email, AMOPS reply-to format check, PPR PDF coord/status section, no-coord warning at triage, types backfill, OI refresh, public form date echo, PPR# atomic counter, storage RLS path scoping, sidebar badge cascading fixes (pathname refresh + 30s polling + mutation event-bridge), QRC sidebar badge. Migrations 2026042803 + 2026042804 applied. |
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

- `docs/Glidepath_Capabilities_v2.32.md` — capabilities reference handed to anyone asking "what can Glidepath do and why should we use it?"
- `supabase/migrations/2026042904_ces_rpc_humanize_status_note.sql` — recreates `ces_update_discrepancy` with humanized notes (applied)

### Modified files

- `CLAUDE.md` — RLS helpers, branch convention, modules table, migration count, status legend, /training row clarified
- `app/(app)/activity/page.tsx` — placeholder text "FOD walk" → "FOD Check"
- `app/(app)/discrepancies/[id]/page.tsx` — `formatStatusUpdateNotes()` + `statusLabel()` helpers; PDF notesHistory mapping
- `app/(app)/infrastructure/page.tsx` — flat scale curves, hide-below-13 with `featuresHiddenRef`, scale-delta short-circuit with `lastScaleRef`
- `app/(app)/more/page.tsx` — Training entry renamed
- `docs/manual/01_airfield_status.md` — "AFM Out of Office" → "Airfield Management Out of Office"
- `docs/manual/02_dashboard.md` — same
- `docs/manual/03_airfield_checks.md` — "FOD walk" / "FOD Walk" → "FOD Check"
- `lib/modules-config.ts` — Checks module use-case "FOD walk" → "FOD Check"
- `lib/regulations-data.ts` — DAFMAN 13-204 v2 tags array "FOD walk" → "FOD Check"
- `lib/sidebar-config.ts` — Training entry renamed
- `lib/supabase/discrepancies.ts` — `currentStatusLabel()` helper + audit insert humanized
- `supabase/seed-demo-walkthrough.sql` — two demo runway-status reasons "FOD walk" → "FOD Check"

### Auto-memory (not in any commit)

- `feedback_glidepath_glossary.md` (new) — terminology table
- `feedback_amops_terminology.md` (extended) — "AMOPS personnel" preference
- `feedback_fod_terminology.md` (added earlier this day)
- `project_permission_matrix.md` (updated) — MAJCOM RFM/FAM
- `MEMORY.md` — index updated

---

*All changes pushed to `origin/main`. All migrations applied to prod.*
