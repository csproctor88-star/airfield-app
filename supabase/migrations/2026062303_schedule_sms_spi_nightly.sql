-- ============================================================
-- Register the dormant sms-spi-nightly cron
--
-- 2026052702_sms_public_rpc_and_cron.sql intended to schedule the nightly
-- SPI compute (_sms_compute_spi_measurements, later extended for AEP keys in
-- 2026060706_aep_sms_spi_feed.sql) at 02:30 UTC daily. But pg_cron was not
-- installed when those migrations were applied, so their best-effort DO blocks
-- no-op'd and the job was never registered — SPI measurements only refreshed
-- when the app happened to trigger a recompute (first-hazard insert / SPI page
-- visit), leaving the Safety dashboard stale for ~a month.
--
-- pg_cron was enabled in 2026062302_enable_pg_cron_wwa.sql. This migration
-- registers the every-night job (idempotent: cron.schedule upserts by jobname).
-- Best-effort wrapped so a pg_cron-less environment (e.g. local supabase start)
-- still commits; the function stays callable manually / by the app.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'sms-spi-nightly',
      '30 2 * * *',  -- 02:30 UTC daily
      $cron$SELECT public._sms_compute_spi_measurements(CURRENT_DATE);$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
