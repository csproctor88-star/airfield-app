# Session Handoff

**Date:** 2026-06-07
**Branch:** `main` — local is **1 commit ahead of `origin/main`**. The video-doc
commit `7b5e908a` is **unpushed by request** (docs-only, user chose to bundle it
with later work). Everything before it is pushed. Still v2.34.0 (no version bump).
**Build:** Unchanged — **docs-only session, no application code touched.** Last
verified clean at `63306d38` (`npx tsc --noEmit` ✓, `npm run build` ✓,
`npx vitest run` ✓, 851 pass / 88 files). Full suite not re-run (would only
re-measure prior state).
**HEAD:** `7b5e908a`

---

## What shipped this session (docs-only)

A non-code session: set up OBS Studio for screen-recorded Glidepath training
walkthroughs and produced an editable production/hosting plan. No code, no
migrations.

### Video walkthrough production & hosting plan (`7b5e908a`)

Brainstormed the training-video effort and configured OBS live over a series of
screenshots, then wrote a self-contained, editable HTML reference at
`docs/Video_Walkthrough_Production_Plan.html` (toolbar with in-browser Edit +
localStorage autosave + Download/Print/Reset). The earlier `.md` draft was
deleted in favour of the `.html`. The commit is **local-only** (not pushed).

Decisions captured in the doc:
- **Priority order:** new-user onboarding course (primary) → admin/base-setup
  guide → in-app contextual help → marketing reel. The onboarding chapters are
  modular so one set of recordings feeds all four uses.
- **Capture:** record against the **Demo base** (`/login?demo=true`) so no real
  base data / personnel names are exposed; record-and-ship (light edit), voiceover
  only, narrate-while-clicking.
- **Hosting:** **YouTube, Unlisted**, via `youtube-nocookie.com` embeds. The cost
  driver for self-hosting would be **Supabase egress, not storage** (full library
  is only ~5–6 GB to store, but streaming burns metered egress fast) — YouTube
  serves bandwidth free and usually works on AFNet, with personal-device fallback.
  Auto-captions give a near-zero-effort 508 path. Archive master `.mp4`s for the
  Platform One IL4/IL5 contingency (external embeds won't reach inside that
  boundary).
- **In-app embed is a deferred, separate spec** — `/help/[module-id]` iframe +
  blocked-network fallback is the only part that touches code; not built.

OBS gotchas worth pinning (all in the doc):
- **Windows HDR on → washed-out / grey OBS captures.** Toggle HDR off
  (**Win + Alt + B**) before recording. This was the session's main time sink.
- **Color Range = Partial** (not Full; Full washes out in mainstream players).
- **Judge colour/audio in Chrome / VLC / YouTube, never Windows Media Player** —
  WMP mis-renders both.
- **MV7+ warmth** = proximity (~a fist, on-axis) + MOTIV Tone:Natural + a single
  denoiser (never stack MOTIV's and OBS's). The OBS **Noise Gate** is what
  silences keyboard clicks in pauses.

---

## Carried forward — earlier today: RLS pentest remediation (NOT yet walked on prod)

> This is the prior body of work from 2026-06-07. It is committed
> (`e7887a5c`, `ea2e22c1`, `2a57f5ed`, `d2e85240`, `9a9b8aa0`, `63306d38`) and
> test-verified, **but it was tested against stale code (ghost dev servers /
> un-promoted Vercel) and has not been browser-walked on a properly promoted
> build.** Walking it is still the top finish line.

A black-box RLS/authorization pentest of the live DB (lowest-priv real user vs.
PostgREST) surfaced five cross-tenant breaks — including a **critical** self
privilege-escalation to `sys_admin` — all fixed (migration `2026062011`):

1. **CRITICAL — self privilege-escalation.** Any user could `UPDATE` their own
   `profiles` row to `role='sys_admin'`. Fixed with a `BEFORE UPDATE` trigger
   (`profiles_block_priv_escalation`) rejecting role/status/is_active changes
   unless the caller has `users:manage` / is sys_admin (service-role exempt).
2. **HIGH — cross-tenant user directory.** `profiles_select` was `USING (true)`.
   Now self / sys_admin / shares-a-base via `SECURITY DEFINER user_shares_base()`.
3. **HIGH — cross-tenant airfield config.** `base_areas`/`base_navaids`/
   `base_runways`/`base_arff_aircraft` SELECT were `USING (true)`; now
   `user_has_base_access(auth.uid(), base_id)`.
4. **MEDIUM — customer-roster enumeration.** `bases_select` was `USING (true)`;
   now membership + sys_admin.
5. **MEDIUM — NULL-`base_id` rows readable cross-tenant.** `runway_status_log`/
   `status_updates`/`check_comments`/`activity_log` SELECT now exclude
   `base_id IS NULL`; existing NULLs backfilled.

Plus: writes now populate `base_id` via `lib/supabase/resolve-base-id.ts`
(`ea2e22c1`); the NULL-`base_id` escape hatch in `user_has_base_access` was
removed (migration `2026062012`, `d2e85240`); the offline write queue + pending
photos were scoped per-user (`2a57f5ed`); and silent no-base saves now toast
(`9a9b8aa0`, `63306d38`). Full detail in those commit messages.

---

## Migrations status

No new migrations this session. Prior two remain applied live, none pending:

| File | Applied | What |
|---|---|---|
| `2026062011_rls_pentest_remediation.sql` | ✅ live | trigger + scoped SELECT policies (findings #1–#5) + backfill |
| `2026062012_harden_base_access_null.sql` | ✅ live | `user_has_base_access` NULL → FALSE |

---

## Bugs fixed during the session

None (docs-only). The OBS washout was an environment issue, not app code — see
Lessons.

---

## Lessons from this session

- **Windows HDR silently washes out OBS screen captures.** SDR content captured
  while the display is in HDR mode comes out grey/low-contrast in *every* player,
  which reads like a colour-pipeline bug but is just the HDR toggle. Check HDR
  first (Win+Alt+B) before chasing OBS colour settings.
- **Windows Media Player mis-renders OBS recordings** (colour washed, audio
  dulled) even when the file is fine. Always judge a recording in Chrome / VLC /
  YouTube before concluding anything's wrong with the file.
- **Egress, not storage, is the cost of self-hosting video** on Supabase/Vercel —
  the deciding factor for the YouTube call.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| RLS pentest work not walked on a **promoted** deploy | High | Carried — all demo testing ran against stale code. Promote `63306d38`, then walk: a normal save, a no-base save (toast), an offline save + drain as one user, and confirm a low-priv user still can't escalate. Then `node scripts/scan-null-base.mjs` → expect CLEAN. |
| Independent human review of pentest fixes #1/#2 | Med | Author wrote both bug and patch; trigger + `profiles` scoping deserve a second set of eyes before the Platform One assessment. |
| Vercel production is manually promoted | Med | Carried — caused hours of "fix isn't working" confusion. Strongly consider auto-promote on `main`. |
| In-app training-video embed not built | Low | New — `/help/[module-id]` YouTube iframe + blocked-network fallback is a deferred spec (see the video plan doc). |
| Other module save handlers not audited for silent no-base guards | Low | Carried — a stray `if (!installationId) return` before some module's save would still no-op quietly. |
| `scn` missing on 26 USAF bases | Med | Carried — frozen-`enabled_modules`; mirror `2026062000`. |
| New `defaultEnabled` modules don't reach existing bases | Med | Carried — systemic null-only fallback in `lib/installation-context.tsx`. |
| AMTR notif system not fully walked on deploy | Med | Carried — `8ec3c8b2` (certifier) + `a154631a` (real-time on-sign). |
| usr-analytics privacy disclosure | Med | Carried — per-user usage tracking has no user-facing line. |
| `types.ts` regen deferred | Med | Carried — several `amtr_*` tables hand-typed; route handlers cast `as any`. |
| Base-setup file extraction deferred | Med | Carried — `base-config/setup/page.tsx` ~6k LOC. |
| v2.34 not yet walked on the deploy | Med | Carried. |
| Codebase guide uncommitted | Info | Carried — `docs/glidepath-guide.html` gitignored; generator + `docs/guide-content/` untracked. |
| Test-account fixtures live in prod | Info | Carried — `__TEST_RLS__` bases + `rls-*@glidepath-rls-test.com`. |

---

## Next session tasks

No required next step this session added. The standing finish line is unchanged:
**walk the RLS pentest work on a properly promoted build** — it's committed and
test-verified but never browser-confirmed live.

1. **Promote `63306d38` to production**, hard-refresh (or incognito), and walk:
   normal airfield-status save; a no-base save shows the toast; an offline save +
   reconnect drains as a single user; the queue does NOT show/drain another user's
   items after a user switch; a `read_only` user cannot escalate their role. Then
   `node scripts/scan-null-base.mjs` → expect CLEAN.
2. **Decide on Vercel auto-promote for `main`** — the manual promote was the
   single biggest time sink.
3. **Get an independent review** of pentest fixes #1 (escalation trigger) and #2
   (`profiles` scoping).

### Video walkthrough follow-ons (when you pick the effort back up)
- Record the onboarding chapters against the Demo base per
  `docs/Video_Walkthrough_Production_Plan.html`; upload Unlisted to YouTube.
- When ready, spec + build the in-app `/help/[module-id]` YouTube embed +
  blocked-network fallback (the only code-touching part).
- Push the unpushed `7b5e908a` whenever you next push (docs-only, harmless).

### Long-running carryover (bandwidth-permitting)
- Extend no-base toasts to any module save that still silently no-ops.
- Promote `8ec3c8b2` and walk the AMTR notification system end-to-end.
- `scn` `enabled_modules` backfill; the systemic `enabled_modules` fallback fix.
- usr-analytics privacy copy; `types.ts` regen; `base-config/setup` extraction.
- v2.34 deploy walk; the prior AMTR inspection-engine batch walk.

---

## Build snapshot

```
No application code changed this session (docs-only) — snapshot carried from 63306d38.

TypeScript clean (npx tsc --noEmit exit 0)
Build: npm run build — compiled successfully.
Tests: 851 pass / 88 files.

Heaviest / most-recently-touched routes (First Load JS, as of 63306d38):
  ○ /                       ~221 kB   (Airfield Status)
  ○ /infrastructure         226 kB
  ○ /discrepancies/new      192 kB
First Load JS shared        91.5 kB
Middleware                  74.5 kB
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-06-07 | RLS/authorization pentest remediation: closed self-escalation to sys_admin + four cross-tenant read leaks (`2026062011`), removed the NULL-base_id escape hatch (`2026062012`), scoped the offline write queue per-user, and surfaced no-base saves as toasts |
| **Unreleased** | 2026-06-05 | Offline write-queue coverage for the airfield-status board, NAVAID grid, New Discrepancy, Report Outage; realtime-down flag hardening |
| **v2.34.0** | 2026-06-01 | Help & Training covers every module + airport-type gating; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination + notify; Records Export; grouped What's New |
| v2.33.0 | 2026-05-02 | Glidepath Training rebuilt, permission-matrix overhaul, PPR module, offline reads + writes |

---

## Key docs / files touched this session

### New files
- `docs/Video_Walkthrough_Production_Plan.html` — editable OBS + recording +
  YouTube-hosting reference (committed in `7b5e908a`).

### Removed
- `docs/Video_Walkthrough_Production_Plan.md` — superseded by the `.html` (the
  `.md` was never committed).
