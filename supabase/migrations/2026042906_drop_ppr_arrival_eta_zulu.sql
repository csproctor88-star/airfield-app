-- ─────────────────────────────────────────────────────────────
-- 2026042906 · Drop the arrival_eta_zulu spine field from PPR
-- ─────────────────────────────────────────────────────────────
-- The spine ETA was added in 2026042901 to make ETA a universal
-- field on every PPR. After 2026042905 made it optional on the
-- public form (and rolled time capture into custom `time` columns
-- with per-column Zulu/Local display), the spine field no longer
-- carries its weight: every surface that needs an arrival time can
-- get it from a custom column with the right display mode.
--
-- This migration:
--   1. Drops `arrival_eta_zulu` from `ppr_entries`.
--   2. Recreates `submit_public_ppr_request` without the
--      `p_arrival_eta_zulu` parameter (and without the format
--      guard, which has nothing to guard).
--
-- Bases that want arrival-time capture going forward configure a
-- custom `time` column in Base Setup → PPR Columns. Existing values
-- in `arrival_eta_zulu` are dropped with the column — operators
-- preserving historical ETA visibility should add a custom column
-- and backfill before applying this migration.

-- ── 1. Drop the spine column ─────────────────────────────────
ALTER TABLE public.ppr_entries
  DROP COLUMN IF EXISTS arrival_eta_zulu;

-- ── 2. Recreate submit_public_ppr_request without ETA ────────
DROP FUNCTION IF EXISTS public.submit_public_ppr_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.submit_public_ppr_request(
  p_base_id           UUID,
  p_requester_name    TEXT,
  p_requester_email   TEXT,
  p_requester_phone   TEXT,
  p_arrival_date      DATE,
  p_column_values     JSONB DEFAULT '{}'::jsonb,
  p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_base_exists  BOOLEAN;
  v_module_on    BOOLEAN;
  v_missing_keys TEXT[];
  v_ppr_number   TEXT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM bases WHERE id = p_base_id) INTO v_base_exists;
  IF NOT v_base_exists THEN
    RAISE EXCEPTION 'Base not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    CASE
      WHEN enabled_modules IS NULL THEN TRUE
      ELSE 'ppr' = ANY(enabled_modules)
    END
  INTO v_module_on
  FROM bases
  WHERE id = p_base_id;

  IF NOT COALESCE(v_module_on, FALSE) THEN
    RAISE EXCEPTION 'PPR module is not enabled at this base' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(c.column_name), ARRAY[]::TEXT[])
    INTO v_missing_keys
    FROM ppr_columns c
   WHERE c.base_id = p_base_id
     AND c.show_on_form = TRUE
     AND c.is_required = TRUE
     AND COALESCE(NULLIF(p_column_values ->> c.id::TEXT, ''), NULL) IS NULL;

  IF array_length(v_missing_keys, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required field(s): %', array_to_string(v_missing_keys, ', ')
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(NULLIF(TRIM(p_requester_name), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'Requester name is required' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(NULLIF(TRIM(p_requester_email), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'Requester email is required' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(NULLIF(TRIM(p_requester_phone), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'Requester phone is required' USING ERRCODE = 'P0001';
  END IF;

  v_ppr_number := public._ppr_generate_number(p_base_id, p_arrival_date, '');

  INSERT INTO ppr_entries (
    base_id,
    ppr_number,
    arrival_date,
    column_values,
    notes,
    status,
    requester_name,
    requester_email,
    requester_phone,
    public_submission,
    created_by,
    updated_by
  ) VALUES (
    p_base_id,
    v_ppr_number,
    p_arrival_date,
    COALESCE(p_column_values, '{}'::jsonb),
    NULLIF(TRIM(p_notes), ''),
    'pending_amops_triage',
    TRIM(p_requester_name),
    TRIM(p_requester_email),
    TRIM(p_requester_phone),
    TRUE,
    NULL,
    NULL
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_ppr_request(UUID, TEXT, TEXT, TEXT, DATE, JSONB, TEXT)
  TO anon, authenticated;
