-- ─────────────────────────────────────────────────────────────
-- 2026042901 · PPR arrival ETA (Zulu)
-- ─────────────────────────────────────────────────────────────
-- Promotes ETA-to-airfield from a configurable column to a fixed
-- spine field on `ppr_entries`, grouped with the arrival date.
-- Stored as TEXT in 'HH:MM' 24-hour Zulu — matches the format the
-- existing column_type='time' inputs already emit. Required on the
-- public submission path via the RPC. Nullable at the column level
-- so internal AMOPS-created PPRs that don't yet know an ETA can
-- still be saved (mirrors how requester_phone is treated).
--
-- Bases that previously configured a public 'ETA in ZULU to ...' as
-- a ppr_columns row should remove that row from Base Setup → PPR
-- Columns now that the spine field replaces it; otherwise the form
-- collects the same information twice.

ALTER TABLE public.ppr_entries
  ADD COLUMN IF NOT EXISTS arrival_eta_zulu TEXT;

DROP FUNCTION IF EXISTS public.submit_public_ppr_request(UUID, TEXT, TEXT, TEXT, DATE, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.submit_public_ppr_request(
  p_base_id           UUID,
  p_requester_name    TEXT,
  p_requester_email   TEXT,
  p_requester_phone   TEXT,
  p_arrival_date      DATE,
  p_arrival_eta_zulu  TEXT,
  p_column_values     JSONB,
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
     AND c.is_public = TRUE
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
  IF COALESCE(NULLIF(TRIM(p_arrival_eta_zulu), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'Arrival ETA (Zulu) is required' USING ERRCODE = 'P0001';
  END IF;
  -- Permissive HH:MM check — matches the `<input type="time">` value
  -- the form sends. Server-side guard against arbitrary text.
  IF TRIM(p_arrival_eta_zulu) !~ '^[0-2][0-9]:[0-5][0-9]$' THEN
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
    TRIM(p_arrival_eta_zulu),
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
