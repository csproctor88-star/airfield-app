-- ============================================================
-- Phase 3b step 7 — Airport Emergency Plan: SMS SPI feed
--
-- Extends the SMS SPI compute machinery (originally defined in
-- 2026052700_sms_schema.sql + 2026052702_sms_public_rpc_and_cron.sql)
-- with two AEP-driven indicators:
--
--   SPI-005 'AEP Full-Scale Drill Overdue' — boolean (1 if last
--     full_scale drill is more than 36 months old, 0 otherwise);
--     target = 0; alert at 1.
--
--   SPI-006 'AEP Comms Checks (last 90 days)' — count of completed
--     comms checks in the trailing 90 days; target ≥ 3 (monthly
--     cadence); alert when fewer than 1.
--
-- The existing pg_cron at 02:30 UTC daily picks up the new keys
-- automatically — no new cron infrastructure needed (contrast with
-- the training-expiry-digest which needs a Vercel cron + secret).
-- The cron loop in _sms_compute_spi_measurements already skips
-- unknown keys via `ELSE CONTINUE`, so this migration must extend
-- the CASE branch before the SPIs are seeded.
-- ============================================================

-- ── 1. Extend _sms_compute_spi_measurements with AEP keys ──────
CREATE OR REPLACE FUNCTION public._sms_compute_spi_measurements(p_target_date DATE DEFAULT CURRENT_DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_spi          sms_spis%ROWTYPE;
  v_period_start DATE;
  v_period_end   DATE;
  v_value        NUMERIC;
  v_status       TEXT;
  v_inserted     INT := 0;
  v_strikes      INT;
  v_ops          NUMERIC;
  v_overdue      INT;
  v_open_total   INT;
  v_inspect_done INT;
  v_period_days  INT;
  v_due_total    INT;
BEGIN
  FOR v_spi IN
    SELECT s.* FROM sms_spis s
      JOIN bases b ON b.id = s.base_id
     WHERE s.active = TRUE
       AND s.computation_key IS NOT NULL
       AND b.airport_type = 'faa_part139'
  LOOP
    CASE v_spi.measurement_frequency
      WHEN 'daily' THEN
        v_period_start := p_target_date;
        v_period_end   := p_target_date;
      WHEN 'weekly' THEN
        v_period_start := p_target_date - ((EXTRACT(DOW FROM p_target_date))::INT);
        v_period_end   := v_period_start + 6;
      WHEN 'monthly' THEN
        v_period_start := date_trunc('month', p_target_date)::DATE;
        v_period_end   := (date_trunc('month', p_target_date) + INTERVAL '1 month - 1 day')::DATE;
      WHEN 'quarterly' THEN
        v_period_start := date_trunc('quarter', p_target_date)::DATE;
        v_period_end   := (date_trunc('quarter', p_target_date) + INTERVAL '3 months - 1 day')::DATE;
      ELSE
        v_period_start := date_trunc('month', p_target_date)::DATE;
        v_period_end   := (date_trunc('month', p_target_date) + INTERVAL '1 month - 1 day')::DATE;
    END CASE;

    v_value := NULL;

    CASE v_spi.computation_key
      WHEN 'wildlife_strikes_per_1k_ops' THEN
        SELECT COUNT(*) INTO v_strikes
          FROM wildlife_strikes
         WHERE base_id = v_spi.base_id
           AND strike_date BETWEEN v_period_start AND v_period_end;
        v_ops := 1000;
        v_value := ROUND((v_strikes::NUMERIC / v_ops) * 1000, 2);

      WHEN 'open_safety_discrepancies_30d' THEN
        SELECT COUNT(*) INTO v_value
          FROM discrepancies
         WHERE base_id = v_spi.base_id
           AND current_status <> 'work_completed_awaiting_verification'
           AND resolution_date IS NULL
           AND created_at < (now() - INTERVAL '30 days');

      WHEN 'daily_inspection_completion_rate' THEN
        v_period_days := (v_period_end - v_period_start) + 1;
        SELECT COUNT(DISTINCT inspection_date) INTO v_inspect_done
          FROM inspections
         WHERE base_id = v_spi.base_id
           AND inspection_type = 'airfield'
           AND status = 'completed'
           AND inspection_date BETWEEN v_period_start AND v_period_end;
        IF v_period_days > 0 THEN
          v_value := ROUND((v_inspect_done::NUMERIC / v_period_days) * 100, 1);
        ELSE
          v_value := 0;
        END IF;

      WHEN 'overdue_mitigation_percent' THEN
        SELECT COUNT(*) INTO v_due_total
          FROM sms_mitigations
         WHERE base_id = v_spi.base_id
           AND status IN ('planned','in_progress')
           AND due_date IS NOT NULL;
        SELECT COUNT(*) INTO v_overdue
          FROM sms_mitigations
         WHERE base_id = v_spi.base_id
           AND status IN ('planned','in_progress')
           AND due_date < CURRENT_DATE;
        IF v_due_total > 0 THEN
          v_value := ROUND((v_overdue::NUMERIC / v_due_total) * 100, 1);
        ELSE
          v_value := 0;
        END IF;

      -- ── AEP-driven SPIs (Phase 3b) ─────────────────────────
      WHEN 'aep_full_scale_drill_overdue' THEN
        SELECT CASE
                 WHEN MAX(drill_date) IS NULL THEN 1                            -- no full-scale on record → overdue
                 WHEN MAX(drill_date) < (CURRENT_DATE - INTERVAL '36 months') THEN 1
                 ELSE 0
               END INTO v_value
          FROM aep_drills
         WHERE base_id = v_spi.base_id
           AND drill_type = 'full_scale'
           AND status = 'completed';

      WHEN 'aep_comms_checks_last_90d' THEN
        SELECT COUNT(*) INTO v_value
          FROM aep_comms_checks
         WHERE base_id = v_spi.base_id
           AND completed_at IS NOT NULL
           AND check_date >= (CURRENT_DATE - INTERVAL '90 days');

      ELSE
        CONTINUE; -- unknown computation key, skip
    END CASE;

    v_status := CASE
      WHEN v_value IS NULL THEN 'no_data'
      WHEN v_spi.alert_threshold IS NOT NULL AND v_spi.target_direction = 'lower' AND v_value >= v_spi.alert_threshold THEN 'alert'
      WHEN v_spi.alert_threshold IS NOT NULL AND v_spi.target_direction = 'higher' AND v_value <= v_spi.alert_threshold THEN 'alert'
      WHEN v_spi.target_value IS NOT NULL AND v_spi.target_direction = 'lower' AND v_value > v_spi.target_value THEN 'warning'
      WHEN v_spi.target_value IS NOT NULL AND v_spi.target_direction = 'higher' AND v_value < v_spi.target_value THEN 'warning'
      ELSE 'on_target'
    END;

    INSERT INTO sms_spi_measurements (
      spi_id, base_id, period_start, period_end, value, status, computed_by
    ) VALUES (
      v_spi.id, v_spi.base_id, v_period_start, v_period_end, COALESCE(v_value, 0), v_status, 'cron'
    )
    ON CONFLICT (spi_id, period_start, period_end) DO UPDATE
      SET value      = EXCLUDED.value,
          status     = EXCLUDED.status,
          computed_by = 'cron';

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public._sms_compute_spi_measurements(DATE) TO authenticated;

-- ── 2. Extend _sms_seed_default_spis with the two AEP rows ─────
-- ON CONFLICT (base_id, code) DO NOTHING keeps the function idempotent;
-- existing bases that already have SPI-001..004 from the prior seed
-- pick up SPI-005 / SPI-006 the next time the function is invoked
-- (the application calls it on first hazard insert and on SMS-SPI
-- page visits; we also call it manually via supabase RPC below to
-- backfill any civilian bases that already exist at Phase 3b apply time).
CREATE OR REPLACE FUNCTION public._sms_seed_default_spis(p_base_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO sms_spis (base_id, code, title, description, unit, target_value,
                        target_direction, alert_threshold, computation_key, measurement_frequency)
  VALUES
    (p_base_id, 'SPI-001', 'Wildlife Strikes per 1,000 Operations',
     'Wildlife strikes normalized to operations volume (FAA strike database equivalent).',
     'rate', 1.0, 'lower', 2.0, 'wildlife_strikes_per_1k_ops', 'monthly'),
    (p_base_id, 'SPI-002', 'Open Safety Discrepancies Aging >30 Days',
     'Count of open safety-relevant discrepancies older than 30 days.',
     'count', 0, 'lower', 3, 'open_safety_discrepancies_30d', 'monthly'),
    (p_base_id, 'SPI-003', 'Daily Self-Inspection Completion Rate',
     'Percent of days in the period with a completed daily airfield self-inspection.',
     'percent', 100, 'higher', 95, 'daily_inspection_completion_rate', 'monthly'),
    (p_base_id, 'SPI-004', 'Overdue Mitigations',
     'Percent of open mitigations past their due date.',
     'percent', 0, 'lower', 10, 'overdue_mitigation_percent', 'monthly'),
    (p_base_id, 'SPI-005', 'AEP Full-Scale Drill Overdue',
     'Indicator (1 = overdue) for the §139.325(h) triennial full-scale exercise. Flips to 1 when no completed full_scale drill exists in the last 36 months.',
     'count', 0, 'lower', 1, 'aep_full_scale_drill_overdue', 'monthly'),
    (p_base_id, 'SPI-006', 'AEP Comms Checks (last 90 days)',
     'Number of completed AEP response-agency comms checks in the trailing 90 days. Target ≥ 3 (monthly cadence per AC 150/5200-31C §2.3).',
     'count', 3, 'higher', 1, 'aep_comms_checks_last_90d', 'monthly')
  ON CONFLICT (base_id, code) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public._sms_seed_default_spis(UUID) TO authenticated;

-- ── 3. Backfill AEP SPIs on existing civilian bases ───────────
-- Any civilian base that already had SMS SPIs seeded (from the
-- Phase 2 first-hazard or first-SPI-page-visit path) will be missing
-- SPI-005 / SPI-006. Invoke the seed function for every civilian
-- base so the new indicators land immediately.
DO $$
DECLARE
  v_base RECORD;
BEGIN
  FOR v_base IN
    SELECT id FROM bases WHERE airport_type = 'faa_part139'
  LOOP
    PERFORM public._sms_seed_default_spis(v_base.id);
  END LOOP;
END;
$$;
