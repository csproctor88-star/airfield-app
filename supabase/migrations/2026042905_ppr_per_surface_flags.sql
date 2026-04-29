-- ─────────────────────────────────────────────────────────────
-- 2026042905 · PPR per-surface visibility + time display + optional public ETA
-- ─────────────────────────────────────────────────────────────
-- Replaces the single `is_public` flag on ppr_columns with three
-- independent visibility booleans so each column can be aimed at
-- the surface(s) it actually belongs on:
--
--   show_on_status — Airfield Status "Today's PPRs" panel
--   show_on_form   — Public PPR Request form (formerly is_public)
--   show_on_log    — PPR Log table + detail card + PDF
--
-- Adds `time_display` for column_type='time' so admins can decide
-- whether a custom time field renders Zulu or base-local everywhere
-- it's shown. Default Zulu — preserves prior behavior on existing
-- columns (which had no flag).
--
-- Public-form spine simplification:
--   - Public requesters no longer enter ETA. The mandatory time was
--     a confusion source (people think in local; the form forced
--     Zulu). Bases that want public ETA capture add a custom time
--     column with the desired display mode.
--   - submit_public_ppr_request loses the ETA NOT-NULL guard. The
--     format check still runs for any non-empty value (handy if a
--     staff-side caller still passes one in).
--
-- The two get_public_ppr_config* RPCs now project base timezone +
-- per-column show_on_form filter + time_display, so the public form
-- can render local-mode time columns and (later) display reads in
-- base local where applicable.

-- ── 1. New columns + backfill ────────────────────────────────
ALTER TABLE public.ppr_columns
  ADD COLUMN IF NOT EXISTS show_on_status BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_on_form   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_on_log    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS time_display   TEXT
    CHECK (time_display IS NULL OR time_display IN ('zulu','local'));

-- Carry every previously public-flagged column over so the public
-- form keeps showing what it showed yesterday.
UPDATE public.ppr_columns
   SET show_on_form = is_public
 WHERE is_public IS NOT NULL;

-- ── 2. Drop is_public ─────────────────────────────────────────
-- Functions referencing it are recreated below in the same migration,
-- so the column is fully replaced atomically.
ALTER TABLE public.ppr_columns
  DROP COLUMN IF EXISTS is_public;

-- ── 3. submit_public_ppr_request — ETA now optional ──────────
DROP FUNCTION IF EXISTS public.submit_public_ppr_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.submit_public_ppr_request(
  p_base_id           UUID,
  p_requester_name    TEXT,
  p_requester_email   TEXT,
  p_requester_phone   TEXT,
  p_arrival_date      DATE,
  p_arrival_eta_zulu  TEXT DEFAULT NULL,
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
  v_eta          TEXT;
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

  -- Required custom columns are now keyed off show_on_form (the
  -- new replacement for is_public). Any column an admin chose to
  -- expose to the public form *and* marked required must have a
  -- non-empty value in the submission payload.
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

  -- ETA is no longer mandatory on the public path. Keep the
  -- format guard for any non-empty value so a misuse from another
  -- caller still gets caught.
  v_eta := NULLIF(TRIM(p_arrival_eta_zulu), '');
  IF v_eta IS NOT NULL AND v_eta !~ '^[0-2][0-9]:[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Arrival ETA must be HH:MM (24-hour Zulu)' USING ERRCODE = 'P0001';
  END IF;

  v_ppr_number := public._ppr_generate_number(p_base_id, p_arrival_date, '');

  INSERT INTO ppr_entries (
    base_id,
    ppr_number,
    arrival_date,
    arrival_eta_zulu,
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
    v_eta,
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

GRANT EXECUTE ON FUNCTION public.submit_public_ppr_request(UUID, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, TEXT)
  TO anon, authenticated;

-- ── 4. get_public_ppr_config (UUID) ──────────────────────────
-- Recreate with show_on_form filter, time_display projection, and
-- bases.timezone returned alongside base_name. Adding timezone is a
-- non-breaking shape change (RETURNS TABLE additive).
DROP FUNCTION IF EXISTS public.get_public_ppr_config(UUID);

CREATE OR REPLACE FUNCTION public.get_public_ppr_config(p_base_id UUID)
RETURNS TABLE (
  base_name      TEXT,
  timezone       TEXT,
  module_enabled BOOLEAN,
  columns        JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT
    b.name     AS base_name,
    b.timezone AS timezone,
    CASE
      WHEN b.enabled_modules IS NULL THEN TRUE
      ELSE 'ppr' = ANY(b.enabled_modules)
    END AS module_enabled,
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id',           c.id,
                   'name',         c.column_name,
                   'type',         c.column_type,
                   'is_required',  c.is_required,
                   'sort_order',   c.sort_order,
                   'info_text',    c.info_text,
                   'time_display', c.time_display
                 )
                 ORDER BY c.sort_order, c.column_name
               )
          FROM ppr_columns c
         WHERE c.base_id = b.id
           AND c.show_on_form = TRUE
      ),
      '[]'::jsonb
    ) AS columns
  FROM bases b
  WHERE b.id = p_base_id
$$;

GRANT EXECUTE ON FUNCTION public.get_public_ppr_config(UUID) TO anon, authenticated;

-- ── 5. get_public_ppr_config_by_icao ─────────────────────────
DROP FUNCTION IF EXISTS public.get_public_ppr_config_by_icao(TEXT);

CREATE OR REPLACE FUNCTION public.get_public_ppr_config_by_icao(p_icao TEXT)
RETURNS TABLE (
  base_id        UUID,
  base_name      TEXT,
  timezone       TEXT,
  module_enabled BOOLEAN,
  columns        JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT
    b.id       AS base_id,
    b.name     AS base_name,
    b.timezone AS timezone,
    CASE
      WHEN b.enabled_modules IS NULL THEN TRUE
      ELSE 'ppr' = ANY(b.enabled_modules)
    END AS module_enabled,
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id',           c.id,
                   'name',         c.column_name,
                   'type',         c.column_type,
                   'is_required',  c.is_required,
                   'sort_order',   c.sort_order,
                   'info_text',    c.info_text,
                   'time_display', c.time_display
                 )
                 ORDER BY c.sort_order, c.column_name
               )
          FROM ppr_columns c
         WHERE c.base_id = b.id
           AND c.show_on_form = TRUE
      ),
      '[]'::jsonb
    ) AS columns
  FROM bases b
  WHERE lower(b.icao) = lower(p_icao)
$$;

GRANT EXECUTE ON FUNCTION public.get_public_ppr_config_by_icao(TEXT) TO anon, authenticated;
