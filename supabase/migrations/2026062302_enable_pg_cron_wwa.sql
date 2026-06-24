-- ============================================================
-- Enable pg_cron + register the WWA expiry sweep
--
-- 2026062301_wwa_expiry_cron.sql created _expire_weather_advisories() and
-- tried to schedule it, but pg_cron was NOT installed on the project, so its
-- best-effort DO block no-op'd and nothing scheduled the sweep. (The earlier
-- sms-spi-nightly job had the same dormant dependency and had likewise never
-- run.) This migration enables the extension and registers the every-minute
-- job — reproducing the steps applied manually to the linked DB on 2026-06-23.
--
-- Everything is wrapped best-effort: where pg_cron can't be loaded (e.g. a
-- local `supabase start` without it in shared_preload_libraries), CREATE
-- EXTENSION raises, the exception is swallowed, and the migration still
-- commits — the function remains callable manually. On managed Supabase the
-- extension enables and the sweep is scheduled.
-- ============================================================
DO $$
BEGIN
  -- Enabling pg_cron also revives any previously-dormant best-effort jobs
  -- (e.g. sms-spi-nightly) the next time their migrations are applied.
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- cron.schedule upserts by jobname, so re-applying is idempotent.
  PERFORM cron.schedule(
    'wwa-expiry-sweep',
    '* * * * *',
    $cron$SELECT public._expire_weather_advisories();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
