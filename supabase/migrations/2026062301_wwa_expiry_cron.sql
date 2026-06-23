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
