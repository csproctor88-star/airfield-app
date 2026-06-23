# WWA Server-Side Expiration — Design

**Date:** 2026-06-23
**Module:** Airfield Status — Weather Watches, Warnings & Advisories (WWA)
**Status:** Approved (design)

## Problem

WWAs (`WATCH` / `WARNING` / `ADVISORY`) are stored as a JSONB array in
`airfield_status.advisories`. Expiration is handled **entirely client-side** by a
15-second `setInterval` in `app/(app)/page.tsx:205-232`: when
`Date.now() >= new Date(effective_end)` it logs an "EXPIRED" events-log row and
removes the item. There is no server-side enforcement.

This produces four observed defects:

1. **Expires only on login.** The timer exists only while the dashboard page is
   mounted in a live browser. If nobody is online at `effective_end`, the WWA
   sits active until someone opens the dashboard, at which point it logs EXPIRED
   stamped at `now()` — not at the real expiry time.
2. **Expires before its time / "randomly".** The dialog defaults a missing end
   **date** to *today's UTC date* (`page.tsx:1120`) with no rollover and no
   past-time guard. A warning issued 2000Z "until 0200Z" becomes
   `effective_end = today 02:00Z` (~18 h in the past) and is swept instantly on
   save. Whether it fires depends on the entered time-of-day vs current UTC —
   reads as random.
3. **Duplicate / racing logs.** The timer runs in every open browser, so each
   logs its own EXPIRED row and races to persist the filtered array.
4. **Non-atomic log-then-remove.** Logs first, then removes via the offline
   queue; a failed/queued removal can leave an active item that logs EXPIRED
   again on the next tick.

Root cause: expiration is client-side, presence-dependent, multi-writer, and
stamped at observation-time instead of effective-time — and the entry form lets
`effective_end` land in the past.

## Decisions

| # | Decision |
|---|---|
| 1 | Authoritative expiration runs **server-side via `pg_cron`, every minute** (mirrors the existing `sms-spi-nightly` job). Latency ≤ 60s, presence-independent. |
| 2 | The client 15s timer becomes **display-only** (live countdown), with all log+remove logic removed. The server is the single writer. |
| 3 | The dialog **auto-rolls** the end date +1 day for the overnight case, and **blocks save** if the end is still in the past. |
| 4 | `activity_log.user_id` is relaxed to **nullable**; cron-authored rows carry `NULL` and render as **"System"** in the events log. |

## Architecture

### 1. Migration `supabase/migrations/2026062301_wwa_expiry_cron.sql`

- `ALTER TABLE activity_log ALTER COLUMN user_id DROP NOT NULL;`
  System-generated audit rows have no human actor. The normal insert path
  (`lib/supabase/activity.ts`) always sets `user_id`, so NULLs only ever come
  from this cron.
- `CREATE OR REPLACE FUNCTION public._expire_weather_advisories() RETURNS INT`,
  `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = 'public'`:
  - Iterate `airfield_status` rows where the `advisories` array contains any
    element with a non-null `effective_end` whose timestamp `<= now()`.
  - For each such row, split `advisories` into **expired** and **remaining**.
  - For each **expired** element, insert one `activity_log` row:
    - `user_id = NULL`
    - `action = 'updated'`
    - `entity_type = 'weather_info'`
    - `entity_id = base_id`
    - `entity_display_id = 'WX-' || upper(type) || (number ? ' #'||upper(number) : '')`
    - `metadata = jsonb_build_object('details', <EXPIRED detail string>)`
    - `base_id = base_id`
    - `created_at = (effective_end)::timestamptz` — **true expiry time**.
  - `UPDATE airfield_status SET advisories = <remaining>, advisory_type = remaining[0].type, advisory_text = remaining[0].text WHERE base_id = …` (legacy fields synced from the first remaining item, matching `persistAdvisories`).
  - Return the count of expired items.
- **EXPIRED detail string** must match the existing client format exactly:
  `WEATHER <TYPE>[ #NUM] EXPIRED — <TEXT upper> (EFF <startZ>–<endZ>)`
  where the EFF label is `UFN–<endZ>` when `effective_start` is null, and Zulu
  times are `to_char(ts AT TIME ZONE 'UTC', 'HH24MI') || 'Z'` (4-digit HHMM,
  matching `formatZuluTime`).
- `GRANT EXECUTE ON FUNCTION public._expire_weather_advisories() TO authenticated;`
  (manual invocation for testing).
- Best-effort schedule, wrapped exactly like `sms-spi-nightly`:
  ```sql
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
      PERFORM cron.schedule(
        'wwa-expiry-sweep', '* * * * *',
        $cron$SELECT public._expire_weather_advisories();$cron$
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END$$;
  ```

**Idempotency & correctness:** once an item is removed from the array it cannot
re-log; the cron is the single writer so there is no multi-client race;
`created_at = effective_end` places the entry correctly on the events-log
timeline regardless of when the sweep runs.

**Realtime propagation:** the existing `airfield_status` UPDATE subscription
(`lib/dashboard-context.tsx:152-199`) pushes the new `advisories` array to every
open dashboard, so removed items disappear everywhere within the realtime round
trip — no client polling needed.

### 2. `app/(app)/page.tsx` — client timer → display-only

The advisory-expiration `useEffect` (`:205-232`) keeps the interval **only** to
tick the live countdown. Remove the expiry detection, `logActivity`, and
`removeAdvisory` calls. The guard `advisories.some(a => a.effective_end)` stays
(no need to tick when nothing is counting down). Dependency array reduces to
`[advisories]`. `removeAdvisory` and `logActivity` remain imported — still used
by the dialog's Clear/Save handlers.

### 3. `app/(app)/page.tsx` — dialog end-time guard

Extract a pure helper (e.g. `lib/advisory-window.ts`):

```ts
// All inputs/outputs are 'YYYY-MM-DDTHH:MM' Zulu local strings (no 'Z' suffix)
// or null. now is a Date for testability.
export function resolveAdvisoryWindow(
  start: string | null,
  end: string | null,
  now: Date,
): { effEnd: string | null; error: string | null }
```

Behavior:
- If `end` is null (UFN) → `{ effEnd: null, error: null }`.
- Parse `end` (and `start` if present) as UTC. If `end <= start` (or, when no
  start, `end <= now`), advance the **end date** by one calendar day and
  recompute.
- If the resulting end is still `<= now`, return
  `{ effEnd: null, error: 'End time is in the past — check the date.' }`.
- Otherwise `{ effEnd: <normalized end>, error: null }`.

In the Save handler (`:1175-1201`): call the helper; on `error`, `toast.error`
the message and abort (do not save or close the dialog); otherwise build
`effEnd + 'Z'` from the normalized value and proceed as today.

### 4. `lib/supabase/activity-queries.ts` — actor fallback

At each of the ~4 result-mapping spots, change
`user_name: profiles?.name || 'Unknown'` to
`user_name: r.user_id ? (profiles?.name || 'Unknown') : 'System'`.
A null-actor expiry row renders as **System** rather than the misleading
"Unknown".

### 5. Tests — `tests/wwa-expiry.test.ts`

Unit tests for `resolveAdvisoryWindow`:
- Overnight case: start 2000, end 0200 (no date bump) → end rolls to next day.
- Past block: start/end both clearly in the past after roll → returns error.
- UFN passthrough: `end = null` → `{ effEnd: null, error: null }`.
- Normal same-day: end after start, in the future → unchanged.

The SQL function is verified manually (see below) — not exercised by vitest.

## Data Flow

1. User issues a WWA → guard normalizes `effective_end` → `persistAdvisories` →
   `airfield_status.advisories`.
2. Every 60s `pg_cron` runs `_expire_weather_advisories()`: finds items with
   `effective_end <= now()`, logs EXPIRED stamped at `effective_end`, removes
   them, syncs legacy fields.
3. `airfield_status` UPDATE → realtime → `setAdvisoriesLocal` → item disappears
   from all open dashboards.
4. Client interval only ticks the countdown display.

## Error Handling

- Per-row work inside the cron loop; the `DO`-wrapped schedule swallows
  extension-absent / already-scheduled errors so the migration commits on
  environments without `pg_cron` (local dev), where the function stays manually
  callable.
- Relaxing `activity_log.user_id` to nullable only affects the cron path; all
  human inserts continue to set `user_id`.

## Verification

- `npx tsc --noEmit` exit 0, `npm run build` RC=0, `npx vitest run` all green
  (project build-gate rule).
- Migration applied via `npx supabase db query --linked --file
  supabase/migrations/2026062301_wwa_expiry_cron.sql` (never `db push`).
- Manual SQL check: insert a test advisory with `effective_end` in the past,
  run `SELECT public._expire_weather_advisories();`, confirm (a) the item is
  gone from `airfield_status.advisories`, (b) an `activity_log` row exists with
  `created_at = effective_end`, `user_id IS NULL`, and the correct EXPIRED
  detail string, and (c) the events log renders it as "System … EXPIRED".

## Out of Scope / Non-Goals

- No change to the JSONB storage model; expired WWAs are hard-removed and logged
  (current behavior), not retained with a status flag.
- The first cron run naturally sweeps any already-stale advisories, each stamped
  at its real `effective_end`.
- No `types.ts` regeneration here (tracked separately as carried tech debt).
