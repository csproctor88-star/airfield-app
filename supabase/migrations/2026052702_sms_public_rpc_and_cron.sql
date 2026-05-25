-- ============================================================
-- Phase 2 step 2 — SMS public submission RPC + nightly SPI cron
--
-- 1. get_public_safety_report_config_by_icao — anon RPC the public
--    form calls on mount to resolve ICAO → base_id + verify module
--    is enabled. Mirrors get_public_ppr_config_by_icao.
--
-- 2. submit_safety_report_public — anon RPC the public form calls
--    to insert a sms_safety_reports row. Mirrors submit_public_ppr_request.
--    Reporter contact fields are optional; the form encourages
--    anonymity but allows opt-in identification for follow-up.
--
-- 3. _sms_compute_spi_measurements — SECURITY DEFINER nightly worker.
--    Iterates active SPIs for all civilian bases and writes the
--    current-period sms_spi_measurements row. Scheduled via
--    pg_cron at 02:30 UTC daily (cron stays in the supabase
--    extensions schema; if unavailable, the function is still
--    callable manually).
--
-- 4. promote_safety_report_to_hazard — internal RPC that wraps the
--    two-step "create hazard + link report" into one transaction.
--    Authenticated, gated on sms:triage_reports.
-- ============================================================

-- ── 1. Public config lookup ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_safety_report_config_by_icao(p_icao TEXT)
RETURNS TABLE (
  base_id          UUID,
  base_name        TEXT,
  airport_type     TEXT,
  module_enabled   BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT
    b.id           AS base_id,
    b.name         AS base_name,
    b.airport_type AS airport_type,
    CASE
      WHEN b.enabled_modules IS NULL THEN TRUE
      ELSE 'sms' = ANY(b.enabled_modules)
    END AS module_enabled
  FROM bases b
  WHERE lower(b.icao) = lower(p_icao)
$$;

GRANT EXECUTE ON FUNCTION public.get_public_safety_report_config_by_icao(TEXT) TO anon, authenticated;

-- ── 2. Public submission ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_safety_report_public(
  p_base_id          UUID,
  p_category         TEXT,
  p_description      TEXT,
  p_occurred_at      TIMESTAMPTZ DEFAULT NULL,
  p_location_text    TEXT DEFAULT NULL,
  p_immediate_action TEXT DEFAULT NULL,
  p_reporter_name    TEXT DEFAULT NULL,
  p_reporter_email   TEXT DEFAULT NULL,
  p_reporter_phone   TEXT DEFAULT NULL,
  p_reporter_role    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_base_exists  BOOLEAN;
  v_module_on    BOOLEAN;
  v_is_civilian  BOOLEAN;
  v_report_code  TEXT;
  v_clean_desc   TEXT;
  v_anonymous    BOOLEAN;
BEGIN
  -- Validate base + module enablement + civilian mode
  SELECT EXISTS (SELECT 1 FROM bases WHERE id = p_base_id) INTO v_base_exists;
  IF NOT v_base_exists THEN
    RAISE EXCEPTION 'Base not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    CASE
      WHEN enabled_modules IS NULL THEN TRUE
      ELSE 'sms' = ANY(enabled_modules)
    END,
    airport_type = 'faa_part139'
  INTO v_module_on, v_is_civilian
  FROM bases
  WHERE id = p_base_id;

  IF NOT COALESCE(v_module_on, FALSE) THEN
    RAISE EXCEPTION 'SMS module is not enabled at this base' USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_is_civilian, FALSE) THEN
    RAISE EXCEPTION 'SMS public reporting is not available for this base' USING ERRCODE = 'P0001';
  END IF;

  -- Required: description
  v_clean_desc := COALESCE(NULLIF(TRIM(p_description), ''), NULL);
  IF v_clean_desc IS NULL THEN
    RAISE EXCEPTION 'Description is required' USING ERRCODE = 'P0001';
  END IF;

  -- Validate category (defensively — the CHECK constraint would
  -- raise a less friendly error)
  IF p_category IS NULL OR p_category NOT IN (
    'wildlife','runway_incursion','ground_vehicle','aircraft',
    'fuel','arff','weather','equipment','procedure','other'
  ) THEN
    RAISE EXCEPTION 'Invalid category: %', COALESCE(p_category, '<null>') USING ERRCODE = 'P0001';
  END IF;

  -- is_anonymous: true if every reporter_* field is NULL/blank
  v_anonymous := (
    COALESCE(NULLIF(TRIM(p_reporter_name), ''), NULL) IS NULL
    AND COALESCE(NULLIF(TRIM(p_reporter_email), ''), NULL) IS NULL
    AND COALESCE(NULLIF(TRIM(p_reporter_phone), ''), NULL) IS NULL
  );

  v_report_code := public._sms_next_code(p_base_id, 'SR', 'sms_safety_reports');

  INSERT INTO sms_safety_reports (
    base_id, report_code,
    reporter_name, reporter_email, reporter_phone, reporter_role,
    is_anonymous,
    category, occurred_at, location_text, description, immediate_action,
    source, triage_status, submitted_at
  ) VALUES (
    p_base_id, v_report_code,
    NULLIF(TRIM(p_reporter_name),  ''),
    NULLIF(TRIM(p_reporter_email), ''),
    NULLIF(TRIM(p_reporter_phone), ''),
    NULLIF(TRIM(p_reporter_role),  ''),
    v_anonymous,
    p_category,
    p_occurred_at,
    NULLIF(TRIM(p_location_text), ''),
    v_clean_desc,
    NULLIF(TRIM(p_immediate_action), ''),
    'public_form',
    'new',
    now()
  );

  RETURN jsonb_build_object(
    'ok',          true,
    'report_code', v_report_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_safety_report_public(
  UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

-- ── 3. Nightly SPI compute worker ────────────────────────────
-- Per-civilian-base computation. Writes one sms_spi_measurements
-- row per active SPI with a built-in computation_key. Idempotent
-- via the UNIQUE(spi_id, period_start, period_end) constraint —
-- re-running for the same window is a no-op (ON CONFLICT DO UPDATE
-- so threshold changes propagate).
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
    -- Compute period boundaries from frequency. Monthly = the
    -- calendar month containing p_target_date. (Daily / weekly /
    -- quarterly are stubs — the seeded SPIs are monthly.)
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

    -- Compute by key. Unknown keys are skipped silently — manual
    -- SPIs (computation_key NULL) never reach this loop.
    CASE v_spi.computation_key
      WHEN 'wildlife_strikes_per_1k_ops' THEN
        SELECT COUNT(*) INTO v_strikes
          FROM wildlife_strikes
         WHERE base_id = v_spi.base_id
           AND strike_date BETWEEN v_period_start AND v_period_end;
        -- Operations volume isn't tracked yet; placeholder = 1000
        -- so the indicator becomes a raw strike count. Phase 3
        -- replaces this with FAA OPSNET feed when wired.
        v_ops := 1000;
        v_value := ROUND((v_strikes::NUMERIC / v_ops) * 1000, 2);

      WHEN 'open_safety_discrepancies_30d' THEN
        -- "Open" = not yet verified-complete; uses the same status
        -- enum the UI surfaces. Aging measured from created_at.
        SELECT COUNT(*) INTO v_value
          FROM discrepancies
         WHERE base_id = v_spi.base_id
           AND current_status <> 'work_completed_awaiting_verification'
           AND resolution_date IS NULL
           AND created_at < (now() - INTERVAL '30 days');

      WHEN 'daily_inspection_completion_rate' THEN
        v_period_days := (v_period_end - v_period_start) + 1;
        -- Count distinct days within the period that had a completed
        -- airfield inspection (the daily self-inspection).
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

      ELSE
        CONTINUE; -- unknown computation key, skip
    END CASE;

    -- Derive status from value vs target + alert.
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

-- ── pg_cron schedule (best-effort) ───────────────────────────
-- pg_cron is in the extensions schema on managed Supabase. Wrapped
-- in a DO block so the migration succeeds even if the extension
-- isn't enabled on the target environment (local supabase start
-- doesn't enable pg_cron by default; production does).
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
  -- Already-scheduled / extension-not-installed / permission-denied:
  -- swallow so the rest of the migration commits. The function is
  -- still callable manually via supabase RPC.
  NULL;
END;
$$;

-- ── 4. Promote safety report → hazard ────────────────────────
-- Authenticated, gated on sms:triage_reports. One atomic step:
--   • Insert a new sms_hazards row carrying source_type='safety_report'
--   • Update the source sms_safety_reports row's triage_status →
--     'promoted' + promoted_hazard_id pointer.
CREATE OR REPLACE FUNCTION public.promote_safety_report_to_hazard(
  p_report_id   UUID,
  p_title       TEXT,
  p_description TEXT DEFAULT NULL,
  p_triage_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_report   sms_safety_reports%ROWTYPE;
  v_hazard_id UUID;
  v_code      TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_report FROM sms_safety_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Safety report not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_base_access(v_caller, v_report.base_id) THEN
    RAISE EXCEPTION 'permission denied: no access to base';
  END IF;

  IF NOT public.user_has_permission(v_caller, 'sms:triage_reports') THEN
    RAISE EXCEPTION 'permission denied: sms:triage_reports';
  END IF;

  IF v_report.triage_status = 'promoted' AND v_report.promoted_hazard_id IS NOT NULL THEN
    -- Idempotent — return existing hazard
    RETURN jsonb_build_object('ok', true, 'hazard_id', v_report.promoted_hazard_id, 'already_promoted', true);
  END IF;

  v_code := public._sms_next_code(v_report.base_id, 'HZ', 'sms_hazards');

  INSERT INTO sms_hazards (
    base_id, hazard_code, title, description, source_type, source_ref_id,
    status, identified_by, identified_at, created_by, updated_by
  ) VALUES (
    v_report.base_id, v_code,
    COALESCE(NULLIF(TRIM(p_title), ''), 'Hazard from ' || v_report.report_code),
    COALESCE(NULLIF(TRIM(p_description), ''), v_report.description),
    'safety_report', v_report.id,
    'open', v_caller, now(), v_caller, v_caller
  )
  RETURNING id INTO v_hazard_id;

  UPDATE sms_safety_reports
     SET triage_status      = 'promoted',
         triaged_by         = v_caller,
         triaged_at         = now(),
         promoted_hazard_id = v_hazard_id,
         triage_notes       = COALESCE(NULLIF(TRIM(p_triage_notes), ''), triage_notes),
         updated_at         = now()
   WHERE id = p_report_id;

  -- Ensure default SPIs exist for this base (idempotent)
  PERFORM public._sms_seed_default_spis(v_report.base_id);

  RETURN jsonb_build_object('ok', true, 'hazard_id', v_hazard_id, 'hazard_code', v_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_safety_report_to_hazard(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ── 5. Sign policy RPC ───────────────────────────────────────
-- Flipping a policy to status='active' atomically: stamps the AE
-- signature trio, supersedes any prior active policy, fails if the
-- caller lacks sms:sign_policy. UPDATE policy allows the write but
-- this RPC additionally enforces that ONLY sign_policy holders can
-- mint an 'active' row.
CREATE OR REPLACE FUNCTION public.sign_sms_policy(
  p_policy_id          UUID,
  p_effective_date     DATE,
  p_signature_image_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_policy    sms_policies%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_policy FROM sms_policies WHERE id = p_policy_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Policy not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_base_access(v_caller, v_policy.base_id) THEN
    RAISE EXCEPTION 'permission denied: no access to base';
  END IF;

  IF NOT public.user_has_permission(v_caller, 'sms:sign_policy') THEN
    RAISE EXCEPTION 'permission denied: sms:sign_policy';
  END IF;

  -- Supersede any prior active policy at this base
  UPDATE sms_policies
     SET status         = 'superseded',
         replaced_by_id = p_policy_id,
         updated_at     = now()
   WHERE base_id = v_policy.base_id
     AND status  = 'active'
     AND id     <> p_policy_id;

  UPDATE sms_policies
     SET status                       = 'active',
         effective_date               = COALESCE(p_effective_date, CURRENT_DATE),
         accountable_executive_user_id = v_caller,
         signed_at                    = now(),
         signature_image_url          = COALESCE(NULLIF(TRIM(p_signature_image_url), ''), signature_image_url),
         updated_by                   = v_caller,
         updated_at                   = now()
   WHERE id = p_policy_id;

  RETURN jsonb_build_object('ok', true, 'policy_id', p_policy_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_sms_policy(UUID, DATE, TEXT) TO authenticated;

-- ── 6. Approve MoC RPC ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_sms_moc(
  p_moc_id          UUID,
  p_approval_notes  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_moc    sms_management_of_change%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_moc FROM sms_management_of_change WHERE id = p_moc_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MoC not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_base_access(v_caller, v_moc.base_id) THEN
    RAISE EXCEPTION 'permission denied: no access to base';
  END IF;

  IF NOT public.user_has_permission(v_caller, 'sms:approve_moc') THEN
    RAISE EXCEPTION 'permission denied: sms:approve_moc';
  END IF;

  UPDATE sms_management_of_change
     SET status         = 'approved',
         approved_by    = v_caller,
         approved_at    = now(),
         approval_notes = COALESCE(NULLIF(TRIM(p_approval_notes), ''), approval_notes),
         updated_by     = v_caller,
         updated_at     = now()
   WHERE id = p_moc_id;

  RETURN jsonb_build_object('ok', true, 'moc_id', p_moc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_sms_moc(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_sms_moc(
  p_moc_id          UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_moc    sms_management_of_change%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_moc FROM sms_management_of_change WHERE id = p_moc_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MoC not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_base_access(v_caller, v_moc.base_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF NOT public.user_has_permission(v_caller, 'sms:approve_moc') THEN
    RAISE EXCEPTION 'permission denied: sms:approve_moc';
  END IF;

  IF COALESCE(NULLIF(TRIM(p_rejection_reason), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE sms_management_of_change
     SET status           = 'rejected',
         rejection_reason = TRIM(p_rejection_reason),
         updated_by       = v_caller,
         updated_at       = now()
   WHERE id = p_moc_id;

  RETURN jsonb_build_object('ok', true, 'moc_id', p_moc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_sms_moc(UUID, TEXT) TO authenticated;
