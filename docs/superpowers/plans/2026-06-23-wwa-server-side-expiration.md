# WWA Server-Side Expiration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Weather Watch/Warning/Advisory (WWA) expiration authoritative and server-driven so items fall out and log at their true `effective_end` regardless of who is online, and stop the dialog from creating already-past items.

**Architecture:** A `pg_cron` job runs a `SECURITY DEFINER` Postgres function every minute that removes expired advisories from `airfield_status.advisories` and writes an `activity_log` row stamped at the real `effective_end`. The client's 15s timer is downgraded to display-only (live countdown). The WWA dialog gets a pure, unit-tested guard that rolls an overnight end date forward and blocks past end times. The events log renders system-authored (null-actor) rows as "System".

**Tech Stack:** Next.js 14 / React 18 / TypeScript (strict), Supabase Postgres + RLS + `pg_cron`, Vitest. Spec: `docs/superpowers/specs/2026-06-23-wwa-server-side-expiration-design.md`.

---

## File Structure

- **Create** `lib/advisory-window.ts` — pure `resolveAdvisoryWindow(start, end, now)` guard (date-roll + past-block). One responsibility, fully testable.
- **Create** `tests/wwa-expiry.test.ts` — unit tests for the guard.
- **Create** `supabase/migrations/2026062301_wwa_expiry_cron.sql` — nullable `user_id`, the sweep function, and the `pg_cron` schedule.
- **Modify** `app/(app)/page.tsx` — wire the guard into the dialog Save handler; downgrade the expiry timer to display-only.
- **Modify** `lib/supabase/activity-queries.ts` — null-actor → "System" in the 5 result mappers.

---

## Task 1: `resolveAdvisoryWindow` guard helper (TDD)

**Files:**
- Create: `lib/advisory-window.ts`
- Test: `tests/wwa-expiry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/wwa-expiry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveAdvisoryWindow } from '@/lib/advisory-window'

describe('resolveAdvisoryWindow', () => {
  it('passes UFN (null end) straight through', () => {
    const now = new Date('2026-06-23T19:00:00Z')
    expect(resolveAdvisoryWindow('2026-06-23T20:00', null, now)).toEqual({
      effEnd: null,
      error: null,
    })
  })

  it('leaves a normal same-day future window unchanged', () => {
    const now = new Date('2026-06-23T09:00:00Z')
    expect(resolveAdvisoryWindow('2026-06-23T10:00', '2026-06-23T18:00', now)).toEqual({
      effEnd: '2026-06-23T18:00',
      error: null,
    })
  })

  it('rolls the end date forward a day for an overnight window', () => {
    // start 2000Z, end typed 0200Z with today's date → must roll to tomorrow
    const now = new Date('2026-06-23T19:00:00Z')
    expect(resolveAdvisoryWindow('2026-06-23T20:00', '2026-06-23T02:00', now)).toEqual({
      effEnd: '2026-06-24T02:00',
      error: null,
    })
  })

  it('rolls forward when there is no start and end-of-day is before now', () => {
    const now = new Date('2026-06-23T20:00:00Z')
    expect(resolveAdvisoryWindow(null, '2026-06-23T02:00', now)).toEqual({
      effEnd: '2026-06-24T02:00',
      error: null,
    })
  })

  it('blocks when even after rolling the end is still in the past', () => {
    const now = new Date('2026-06-25T00:00:00Z')
    const result = resolveAdvisoryWindow(null, '2026-06-23T02:00', now)
    expect(result.effEnd).toBeNull()
    expect(result.error).toMatch(/past/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wwa-expiry.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/advisory-window"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/advisory-window.ts`:

```ts
// Resolve a WWA effective-end given its start. Inputs are Zulu wall-clock
// strings 'YYYY-MM-DDTHH:MM' (no 'Z' suffix), parsed as UTC, or null.
//
// The dialog defaults a missing end DATE to today's UTC date with no rollover,
// so an overnight WWA (end-of-day at or before the start) lands in the past and
// is swept the instant it's saved. This rolls the end date forward one day for
// that case; if the result is still in the past the caller must block the save.
export function resolveAdvisoryWindow(
  start: string | null,
  end: string | null,
  now: Date,
): { effEnd: string | null; error: string | null } {
  if (!end) return { effEnd: null, error: null }

  const startMs = start ? Date.parse(start + 'Z') : now.getTime()
  let endMs = Date.parse(end + 'Z')
  if (Number.isNaN(endMs)) return { effEnd: null, error: 'End time is invalid.' }

  let effEnd = end
  if (endMs <= startMs) {
    // Overnight: roll the end date forward one calendar day.
    effEnd = new Date(endMs + 86_400_000).toISOString().slice(0, 16)
    endMs = Date.parse(effEnd + 'Z')
  }

  if (endMs <= now.getTime()) {
    return { effEnd: null, error: 'End time is in the past — check the date.' }
  }
  return { effEnd, error: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wwa-expiry.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add lib/advisory-window.ts tests/wwa-expiry.test.ts
git commit -m "WWA: add resolveAdvisoryWindow guard (date-roll + past-block)"
```

---

## Task 2: Wire the guard into the WWA dialog Save handler

**Files:**
- Modify: `app/(app)/page.tsx` (import + Save handler ~`:1175-1178`)

- [ ] **Step 1: Add the import**

Find the import block near the top (after line 22, `formatZuluDate, formatZuluTime, formatZuluDateTime` import). Add:

```ts
import { resolveAdvisoryWindow } from '@/lib/advisory-window'
```

- [ ] **Step 2: Replace the effStart/effEnd construction in the Save handler**

In the Save button `onClick` (the block that begins `if (advisoryDraftText.trim()) {`), replace these two lines:

```ts
                    const effStart = advisoryDraftStart ? advisoryDraftStart + 'Z' : null
                    const effEnd = (!advisoryDraftUfn && advisoryDraftEnd) ? advisoryDraftEnd + 'Z' : null
```

with:

```ts
                    const effStart = advisoryDraftStart ? advisoryDraftStart + 'Z' : null
                    let effEnd: string | null = null
                    if (!advisoryDraftUfn && advisoryDraftEnd) {
                      const { effEnd: normEnd, error: winErr } = resolveAdvisoryWindow(
                        advisoryDraftStart || null, advisoryDraftEnd, new Date(),
                      )
                      if (winErr) { toast.error(winErr); return }
                      effEnd = normEnd ? normEnd + 'Z' : null
                    }
```

(`toast` is already imported at `:17`. The rest of the handler — `startLabel`/`endLabel`/`effSuffix` and the create/update branches — is unchanged and reads the new `effEnd`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (no errors). `effEnd` is now `let … : string | null` and all later reads still compile.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/page.tsx"
git commit -m "WWA: guard dialog end time against past/overnight on save"
```

---

## Task 3: Downgrade the client expiry timer to display-only

**Files:**
- Modify: `app/(app)/page.tsx` (the advisory expiration `useEffect` at `:205-232`)

- [ ] **Step 1: Replace the effect body**

Replace the entire block:

```ts
  // --- Advisory expiration timer ---
  useEffect(() => {
    const hasExpiring = advisories.some(a => a.effective_end)
    if (!hasExpiring) {
      if (expiryTimerRef.current) { clearInterval(expiryTimerRef.current); expiryTimerRef.current = null }
      return
    }
    // Tick every 15s to update countdowns and check for expirations
    expiryTimerRef.current = setInterval(() => {
      const now = Date.now()
      for (const adv of advisories) {
        if (adv.effective_end) {
          const endMs = new Date(adv.effective_end).getTime()
          if (now >= endMs) {
            // Expired — log and remove
            const effLabel = adv.effective_start
              ? `${formatZuluTime(new Date(adv.effective_start))}Z–${formatZuluTime(new Date(adv.effective_end))}Z`
              : `UFN–${formatZuluTime(new Date(adv.effective_end))}Z`
            const expNum = adv.number ? ` #${adv.number.toUpperCase()}` : ''
            if (installationId) logActivity('updated', 'weather_info', installationId, `WX-${adv.type.toUpperCase()}${expNum}`, { details: `WEATHER ${adv.type.toUpperCase()}${expNum} EXPIRED — ${adv.text.toUpperCase()} (EFF ${effLabel})` }, installationId)
            removeAdvisory(adv.id)
          }
        }
      }
      setExpiryTick(t => t + 1) // force re-render for countdowns
    }, 15000)
    return () => { if (expiryTimerRef.current) clearInterval(expiryTimerRef.current) }
  }, [advisories, installationId, removeAdvisory])
```

with:

```ts
  // --- Advisory countdown display timer ---
  // Expiration is authoritative server-side (pg_cron `wwa-expiry-sweep` →
  // `_expire_weather_advisories`), which removes expired items and logs them at
  // their true effective_end; the realtime airfield_status subscription pushes
  // the removal here. This interval only re-renders the live countdown.
  useEffect(() => {
    const hasCountdown = advisories.some(a => a.effective_end)
    if (!hasCountdown) {
      if (expiryTimerRef.current) { clearInterval(expiryTimerRef.current); expiryTimerRef.current = null }
      return
    }
    expiryTimerRef.current = setInterval(() => {
      setExpiryTick(t => t + 1)
    }, 15000)
    return () => { if (expiryTimerRef.current) clearInterval(expiryTimerRef.current) }
  }, [advisories])
```

- [ ] **Step 2: Type-check (catches any now-unused-symbol errors)**

Run: `npx tsc --noEmit`
Expected: exit 0. `logActivity`, `removeAdvisory`, and `formatZuluTime` are all still used elsewhere in the file (dialog Clear/Save handlers, advisory card rendering), so their imports remain valid. If tsc reports an unused variable, do NOT delete the import — verify the symbol is genuinely unreferenced first.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/page.tsx"
git commit -m "WWA: client timer is display-only; server owns expiration"
```

---

## Task 4: Render null-actor (system) events-log rows as "System"

**Files:**
- Modify: `lib/supabase/activity-queries.ts` (5 result mappers)

- [ ] **Step 1: Update the join-failed fallback mapper (`:154`)**

Replace:

```ts
          user_name: 'Unknown',
```

with:

```ts
          user_name: (r as { user_id?: string | null }).user_id ? 'Unknown' : 'System',
```

- [ ] **Step 2: Update the three identical profile mappers (`:172`, `:270`, `:322`)**

There are three identical lines:

```ts
        user_name: (r.profiles as { name?: string } | null)?.name || 'Unknown',
```

Replace each with:

```ts
        user_name: (r as { user_id?: string | null }).user_id ? ((r.profiles as { name?: string } | null)?.name || 'Unknown') : 'System',
```

(If using a single editor replace-all, confirm exactly three replacements.)

- [ ] **Step 3: Update the typed-access mapper (`:366`)**

Replace:

```ts
    user_name: r.profiles?.name || 'Unknown',
```

with:

```ts
    user_name: r.user_id ? (r.profiles?.name || 'Unknown') : 'System',
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (`ActivityEntry.user_id` is already `string | null` at `:19`; the `r as { user_id }` casts cover the loosely-typed `Record<string, unknown>` mappers.)

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/activity-queries.ts
git commit -m "Events log: render null-actor (system) rows as System"
```

---

## Task 5: Migration — nullable user_id + sweep function + pg_cron schedule

**Files:**
- Create: `supabase/migrations/2026062301_wwa_expiry_cron.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/2026062301_wwa_expiry_cron.sql`:

```sql
-- ============================================================
-- WWA server-side expiration
--
-- Weather Watches/Warnings/Advisories live in airfield_status.advisories
-- (JSONB array). Until now expiration was client-only (a 15s timer on the
-- dashboard), so items only fell out when someone was online and were
-- logged at observation-time, not effective_end. This moves expiration into
-- a pg_cron sweep that removes expired items and logs them at their true
-- effective_end. Mirrors the sms-spi-nightly best-effort cron pattern.
-- ============================================================

-- System-authored audit rows (cron expirations) have no human actor.
-- The normal insert path (lib/supabase/activity.ts) always sets user_id,
-- so NULLs only ever originate from this sweep.
ALTER TABLE activity_log ALTER COLUMN user_id DROP NOT NULL;

-- ── Sweep worker ─────────────────────────────────────────────
-- For every airfield_status row holding an advisory whose effective_end is
-- at or before now(): log an EXPIRED activity_log row (stamped at
-- effective_end, user_id NULL) and drop the item from the array, syncing the
-- legacy advisory_type/advisory_text from the first remaining item — exactly
-- as the client persistAdvisories does. Idempotent: a removed item can't be
-- re-logged, and the cron is the single writer (no multi-client race).
CREATE OR REPLACE FUNCTION public._expire_weather_advisories()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_row        airfield_status%ROWTYPE;
  v_item       JSONB;
  v_remaining  JSONB;
  v_first      JSONB;
  v_end_text   TEXT;
  v_start_text TEXT;
  v_end_ts     TIMESTAMPTZ;
  v_start_ts   TIMESTAMPTZ;
  v_type       TEXT;
  v_text       TEXT;
  v_number     TEXT;
  v_numsfx     TEXT;
  v_display    TEXT;
  v_eff_label  TEXT;
  v_detail     TEXT;
  v_changed    BOOLEAN;
  v_expired    INT := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM airfield_status s
    WHERE jsonb_typeof(s.advisories) = 'array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.advisories) e
        WHERE NULLIF(e->>'effective_end', '') IS NOT NULL
          AND (e->>'effective_end')::timestamptz <= now()
      )
  LOOP
    v_remaining := '[]'::jsonb;
    v_changed := FALSE;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_row.advisories)
    LOOP
      v_end_text := NULLIF(v_item->>'effective_end', '');
      IF v_end_text IS NOT NULL AND v_end_text::timestamptz <= now() THEN
        -- Expired → log, then drop.
        v_type   := upper(coalesce(v_item->>'type', 'INFO'));
        v_text   := upper(coalesce(v_item->>'text', ''));
        v_number := NULLIF(v_item->>'number', '');
        v_numsfx := CASE WHEN v_number IS NOT NULL THEN ' #' || upper(v_number) ELSE '' END;
        v_start_text := NULLIF(v_item->>'effective_start', '');
        v_end_ts := v_end_text::timestamptz;

        IF v_start_text IS NOT NULL THEN
          v_start_ts  := v_start_text::timestamptz;
          v_eff_label := to_char(v_start_ts AT TIME ZONE 'UTC', 'HH24MI') || 'Z–'
                       || to_char(v_end_ts   AT TIME ZONE 'UTC', 'HH24MI') || 'Z';
        ELSE
          v_eff_label := 'UFN–' || to_char(v_end_ts AT TIME ZONE 'UTC', 'HH24MI') || 'Z';
        END IF;

        v_display := 'WX-' || v_type || v_numsfx;
        v_detail  := 'WEATHER ' || v_type || v_numsfx || ' EXPIRED — '
                   || v_text || ' (EFF ' || v_eff_label || ')';

        INSERT INTO activity_log
          (user_id, action, entity_type, entity_id, entity_display_id, metadata, base_id, created_at)
        VALUES
          (NULL, 'updated', 'weather_info', v_row.base_id, v_display,
           jsonb_build_object('details', v_detail), v_row.base_id, v_end_ts);

        v_expired := v_expired + 1;
        v_changed := TRUE;
      ELSE
        v_remaining := v_remaining || v_item;
      END IF;
    END LOOP;

    IF v_changed THEN
      v_first := CASE WHEN jsonb_array_length(v_remaining) > 0 THEN v_remaining->0 ELSE NULL END;
      UPDATE airfield_status
         SET advisories    = v_remaining,
             advisory_type = NULLIF(v_first->>'type', ''),
             advisory_text = NULLIF(v_first->>'text', '')
       WHERE base_id = v_row.base_id;
    END IF;
  END LOOP;

  RETURN v_expired;
END;
$$;

GRANT EXECUTE ON FUNCTION public._expire_weather_advisories() TO authenticated;

-- ── pg_cron schedule (best-effort) ───────────────────────────
-- Wrapped in a DO block so the migration commits even where pg_cron isn't
-- enabled (local supabase start). On managed Supabase it runs every minute.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'wwa-expiry-sweep',
      '* * * * *',
      $cron$SELECT public._expire_weather_advisories();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
```

- [ ] **Step 2: Sanity-check the dashes match the client format**

The detail string MUST byte-match the client's: `EXPIRED —` uses an em-dash (U+2014, `—`) and the EFF label uses an en-dash (U+2013, `–`). Verify the two characters in the SQL match `app/(app)/page.tsx` (the `effLabel` and the original expiry log line). Run:

`npx rg -n "EXPIRED —|Z–" supabase/migrations/2026062301_wwa_expiry_cron.sql`
Expected: both patterns match (em-dash in EXPIRED, en-dash in the Z label).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026062301_wwa_expiry_cron.sql
git commit -m "WWA: pg_cron sweep + nullable activity_log.user_id (migration)"
```

---

## Task 6: Apply the migration, verify behavior, and run the build gate

**Files:** none (verification only)

- [ ] **Step 1: Apply the migration to the linked DB**

Per project rule — never `db push`; apply the file directly:

Run: `npx supabase db query --linked --file supabase/migrations/2026062301_wwa_expiry_cron.sql`
Expected: success (no error). The final `DO` block returns no rows.

- [ ] **Step 2: Confirm the function and cron job exist**

Run: `npx supabase db query --linked --file scripts/_verify_wwa.sql` after creating a throwaway `scripts/_verify_wwa.sql` containing ONLY:

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'wwa-expiry-sweep';
```

Expected: one row — `wwa-expiry-sweep | * * * * *`. (If `cron.job` is unavailable on the environment, instead confirm the function exists with `SELECT proname FROM pg_proc WHERE proname = '_expire_weather_advisories';`.) Delete the throwaway file afterward.

- [ ] **Step 3: Functional check — expire a seeded past advisory**

Create a throwaway `scripts/_verify_wwa.sql` (overwrite) with the manual test below, run it with `npx supabase db query --linked --file scripts/_verify_wwa.sql`, inspect output, then delete the file. Use a real `base_id` from `SELECT id FROM bases LIMIT 1;` (substitute below):

```sql
-- Seed one already-expired advisory on a test base, then sweep.
WITH b AS (SELECT id FROM bases ORDER BY created_at LIMIT 1)
UPDATE airfield_status
   SET advisories = jsonb_build_array(jsonb_build_object(
     'id', gen_random_uuid()::text, 'type', 'WARNING',
     'text', 'TEST LIGHTNING WITHIN 5NM', 'number', '7',
     'created_at', now()::text,
     'effective_start', (now() - interval '2 hours')::text,
     'effective_end',   (now() - interval '1 hour')::text))
 WHERE base_id = (SELECT id FROM b);

SELECT public._expire_weather_advisories() AS expired_count;
```

Expected: `expired_count` ≥ 1.

- [ ] **Step 4: Verify the removal + the log row**

Overwrite `scripts/_verify_wwa.sql` with the check below (only the last SELECT returns rows per the Supabase CLI one-result caveat — run twice, swapping which SELECT is last, or split into two runs):

Run A:
```sql
SELECT advisories FROM airfield_status
 WHERE base_id = (SELECT id FROM bases ORDER BY created_at LIMIT 1);
```
Expected: the TEST advisory is gone (array no longer contains it).

Run B:
```sql
SELECT user_id, entity_display_id, created_at, metadata->>'details' AS details
  FROM activity_log
 WHERE entity_type = 'weather_info'
   AND metadata->>'details' LIKE '%TEST LIGHTNING%'
 ORDER BY created_at DESC LIMIT 1;
```
Expected: one row with `user_id` NULL, `entity_display_id = 'WX-WARNING #7'`, `created_at` equal to the seeded `effective_end` (≈1 hour ago, NOT now), and `details = 'WEATHER WARNING #7 EXPIRED — TEST LIGHTNING WITHIN 5NM (EFF 'HHMM'Z–'HHMM'Z)'`. Delete `scripts/_verify_wwa.sql` when done.

- [ ] **Step 5: Verify the events-log UI shows "System"**

Open `/activity` in the app (dev or deployed), search "TEST LIGHTNING". Expected: the EXPIRED row appears with actor **System** (not "Unknown" or a person), timestamped at the effective-end.

- [ ] **Step 6: Run the full build gate**

Run, in order:
- `npx tsc --noEmit` → exit 0
- `npx vitest run` → all pass (includes the new `tests/wwa-expiry.test.ts`)
- `npm run build` → "compiled successfully", RC 0

(Per the project rule, a commit is only green when `npm run build` returns RC 0 — vitest passing alone is not sufficient.)

- [ ] **Step 7: Final commit (if any verification scratch remains) and wrap**

Ensure `scripts/_verify_wwa.sql` is deleted and not committed:

```bash
git status --short
```
Expected: clean (all WWA changes already committed in Tasks 1–5; no `scripts/_verify_wwa.sql`).

---

## Self-Review Notes

- **Spec coverage:** Decision 1 (pg_cron sweep) → Task 5/6. Decision 2 (display-only timer) → Task 3. Decision 3 (dialog guard) → Tasks 1–2. Decision 4 (nullable user_id + "System") → Task 5 (DDL) + Task 4 (UI). Tests → Task 1. Verification gate → Task 6. All covered.
- **Format parity:** the SQL EXPIRED detail string and `entity_display_id` reproduce the client format from `page.tsx` (`WX-<TYPE>[ #NUM]`, `WEATHER <TYPE>[ #NUM] EXPIRED — <TEXT> (EFF <label>)`), including em-dash/en-dash (Task 5 Step 2 guards this).
- **Type parity:** `resolveAdvisoryWindow` signature `(string|null, string|null, Date) → {effEnd: string|null, error: string|null}` is identical in helper (Task 1), call site (Task 2), and tests (Task 1). `activity_log.entity_id`/`base_id` are UUID — the SQL inserts `v_row.base_id` (uuid) with no text cast.
