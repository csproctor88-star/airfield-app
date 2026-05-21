-- ============================================================
-- AMTR — Migration 5/6: signature RPC (AMTR-role validation)
--
-- amtr_sign(p_table, p_row_id, p_slot, p_initials) writes a single
-- signature slot after enforcing the AMTR role model:
--   1. caller has base access + amtr:write on the row's base
--   2. caller holds the AMTR role the slot requires
--      (trainee/trainer/certifier/namt/afm; evaluator = any non-trainee)
--   3. one-signature-per-record: caller hasn't already signed a
--      DIFFERENT slot on the same row
-- The slot implies the role, so signed_role is derivable from which
-- *_initials column is filled — no separate column needed.
--
-- SECURITY DEFINER so the role check is authoritative server-side;
-- the table whitelist + slot validation prevent arbitrary writes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.amtr_slots_for_table(p_table TEXT)
RETURNS TEXT[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_table
    WHEN 'amtr_623a'               THEN ARRAY['trainee','trainer','namt','afm']
    WHEN 'amtr_797'                THEN ARRAY['trainee','trainer','certifier']
    WHEN 'amtr_jqs_progress'       THEN ARRAY['trainee','trainer','certifier']
    WHEN 'amtr_1098_progress'      THEN ARRAY['trainee','certifier']
    WHEN 'amtr_milestone_progress' THEN ARRAY['certifier']
    WHEN 'amtr_803'                THEN ARRAY['evaluator']
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.amtr_sign(
  p_table    TEXT,
  p_row_id   UUID,
  p_slot     TEXT,
  p_initials TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_slots       TEXT[];
  v_base_id     UUID;
  v_caller      UUID := auth.uid();
  v_sibling     TEXT;
  v_other_by    UUID;
  v_role_ok     BOOLEAN;
BEGIN
  v_slots := amtr_slots_for_table(p_table);
  IF v_slots IS NULL THEN
    RAISE EXCEPTION 'amtr_sign: table % is not signable', p_table;
  END IF;
  IF NOT (p_slot = ANY (v_slots)) THEN
    RAISE EXCEPTION 'amtr_sign: slot % invalid for %', p_slot, p_table;
  END IF;

  -- Resolve the row's base_id (also proves the row exists).
  EXECUTE format('SELECT base_id FROM %I WHERE id = $1', p_table)
    INTO v_base_id USING p_row_id;
  IF v_base_id IS NULL THEN
    RAISE EXCEPTION 'amtr_sign: row not found';
  END IF;

  IF NOT (user_has_base_access(v_caller, v_base_id)
          AND user_has_permission(v_caller, 'amtr:write')) THEN
    RAISE EXCEPTION 'amtr_sign: not authorized';
  END IF;

  -- Caller must hold the AMTR role the slot requires.
  IF p_slot = 'evaluator' THEN
    SELECT EXISTS (
      SELECT 1 FROM amtr_role_assignments
      WHERE base_id = v_base_id AND user_id = v_caller
        AND role IN ('trainer','certifier','namt','afm')
    ) INTO v_role_ok;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM amtr_role_assignments
      WHERE base_id = v_base_id AND user_id = v_caller AND role = p_slot
    ) INTO v_role_ok;
  END IF;
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'amtr_sign: caller lacks AMTR role for slot %', p_slot;
  END IF;

  -- One-signature-per-record: caller may not already own a different slot.
  FOREACH v_sibling IN ARRAY v_slots LOOP
    IF v_sibling <> p_slot THEN
      EXECUTE format('SELECT %I FROM %I WHERE id = $1', v_sibling || '_signed_by', p_table)
        INTO v_other_by USING p_row_id;
      IF v_other_by = v_caller THEN
        RAISE EXCEPTION 'amtr_sign: you already signed this record as %, cannot also sign as %', v_sibling, p_slot;
      END IF;
    END IF;
  END LOOP;

  -- Write the slot. (updated_at intentionally untouched — not all
  -- signable tables carry it, and a signature isn't a row-content edit.)
  EXECUTE format(
    'UPDATE %I SET %I = $1, %I = $2, %I = now() WHERE id = $3',
    p_table,
    p_slot || '_initials',
    p_slot || '_signed_by',
    p_slot || '_signed_at'
  ) USING p_initials, v_caller, p_row_id;
END $$;

GRANT EXECUTE ON FUNCTION public.amtr_slots_for_table(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.amtr_sign(TEXT, UUID, TEXT, TEXT) TO authenticated;
