-- ============================================================
-- AMTR — Migration 11: signing model v2 (hierarchical authority,
-- per-block locking) + 1098 catalog Score/Hrs column.
--
-- Replaces the 2026052004 / 2026052007 signing behavior:
--   • Signatures are HIERARCHICAL — a higher role may sign lower
--     blocks (certifier→trainee/trainer/certifier; namt→all but afm;
--     afm→all; trainer→trainer; trainee→trainee; evaluator→any
--     non-trainee). On your OWN record only the trainee block is
--     signable (self-certification guard).
--   • Per-block locking: a signed block is final on its own (can't be
--     re-signed without reopen). The row no longer auto-locks, so the
--     other blocks and the date fields stay editable. The legacy
--     locked_at/locked_by columns remain but are no longer written.
--   • amtr_reopen now clears a SINGLE signature block (NAMT/AFM only).
--
-- The one-signature-per-record rule is removed.
-- ============================================================

-- ── 1098 catalog: Score/Hrs becomes a catalog-defined, locked value ──
ALTER TABLE amtr_1098_catalog ADD COLUMN IF NOT EXISTS score_or_hours TEXT;

-- ── amtr_sign: hierarchical authority + per-block, no auto-lock ──────
CREATE OR REPLACE FUNCTION public.amtr_sign(
  p_table TEXT, p_row_id UUID, p_slot TEXT, p_initials TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_slots        TEXT[];
  v_base_id      UUID;
  v_member       UUID;
  v_member_user  UUID;
  v_caller       UUID := auth.uid();
  v_role_ok      BOOLEAN;
  v_existing_by  UUID;
BEGIN
  v_slots := amtr_slots_for_table(p_table);
  IF v_slots IS NULL THEN RAISE EXCEPTION 'amtr_sign: table % is not signable', p_table; END IF;
  IF NOT (p_slot = ANY (v_slots)) THEN RAISE EXCEPTION 'amtr_sign: slot % invalid for %', p_slot, p_table; END IF;

  EXECUTE format('SELECT base_id, member_id FROM %I WHERE id = $1', p_table)
    INTO v_base_id, v_member USING p_row_id;
  IF v_base_id IS NULL THEN RAISE EXCEPTION 'amtr_sign: row not found'; END IF;

  IF NOT (user_has_base_access(v_caller, v_base_id) AND user_has_permission(v_caller, 'amtr:write')) THEN
    RAISE EXCEPTION 'amtr_sign: not authorized';
  END IF;

  -- Self-certification guard: on your own record only the trainee block is signable.
  SELECT user_id INTO v_member_user FROM amtr_members WHERE id = v_member;
  IF v_member_user IS NOT NULL AND v_member_user = v_caller AND p_slot <> 'trainee' THEN
    RAISE EXCEPTION 'amtr_sign: on your own record you may only sign the Trainee block';
  END IF;

  -- Hierarchical role authority.
  SELECT EXISTS (
    SELECT 1 FROM amtr_role_assignments a
    WHERE a.base_id = v_base_id AND a.user_id = v_caller AND (
      (p_slot = 'evaluator' AND a.role IN ('trainer','certifier','namt','afm'))
      OR a.role = 'afm'
      OR (a.role = 'namt'      AND p_slot IN ('trainee','trainer','certifier','namt'))
      OR (a.role = 'certifier' AND p_slot IN ('trainee','trainer','certifier'))
      OR (a.role = 'trainer'   AND p_slot = 'trainer')
      OR (a.role = 'trainee'   AND p_slot = 'trainee')
    )
  ) INTO v_role_ok;
  IF NOT v_role_ok THEN RAISE EXCEPTION 'amtr_sign: caller not authorized to sign slot %', p_slot; END IF;

  -- Per-block finality: refuse to overwrite an already-signed block.
  EXECUTE format('SELECT %I FROM %I WHERE id = $1', p_slot || '_signed_by', p_table)
    INTO v_existing_by USING p_row_id;
  IF v_existing_by IS NOT NULL THEN
    RAISE EXCEPTION 'amtr_sign: % block is already signed — reopen it first', p_slot;
  END IF;

  EXECUTE format('UPDATE %I SET %I = $1, %I = $2, %I = now() WHERE id = $3',
    p_table, p_slot || '_initials', p_slot || '_signed_by', p_slot || '_signed_at')
    USING p_initials, v_caller, p_row_id;

  INSERT INTO amtr_audit_log (base_id, member_id, actor_user_id, action, table_name, row_id, detail)
    VALUES (v_base_id, v_member, v_caller, 'sign', p_table, p_row_id, format('Signed %s block', p_slot));
END $$;
GRANT EXECUTE ON FUNCTION public.amtr_sign(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ── amtr_reopen: clear ONE signature block (NAMT/AFM only) ───────────
DROP FUNCTION IF EXISTS public.amtr_reopen(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.amtr_reopen(p_table TEXT, p_row_id UUID, p_slot TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_slots   TEXT[];
  v_base_id UUID; v_member UUID; v_caller UUID := auth.uid(); v_ok BOOLEAN;
BEGIN
  v_slots := amtr_slots_for_table(p_table);
  IF v_slots IS NULL THEN RAISE EXCEPTION 'amtr_reopen: table % not signable', p_table; END IF;
  IF NOT (p_slot = ANY (v_slots)) THEN RAISE EXCEPTION 'amtr_reopen: slot % invalid for %', p_slot, p_table; END IF;

  EXECUTE format('SELECT base_id, member_id FROM %I WHERE id = $1', p_table) INTO v_base_id, v_member USING p_row_id;
  IF v_base_id IS NULL THEN RAISE EXCEPTION 'amtr_reopen: row not found'; END IF;

  SELECT EXISTS (SELECT 1 FROM amtr_role_assignments WHERE base_id=v_base_id AND user_id=v_caller AND role IN ('namt','afm')) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'amtr_reopen: only NAMT or AFM may reopen a signature'; END IF;

  EXECUTE format('UPDATE %I SET %I = NULL, %I = NULL, %I = NULL, locked_at = NULL, locked_by = NULL WHERE id = $1',
    p_table, p_slot || '_initials', p_slot || '_signed_by', p_slot || '_signed_at')
    USING p_row_id;

  INSERT INTO amtr_audit_log (base_id, member_id, actor_user_id, action, table_name, row_id, detail)
    VALUES (v_base_id, v_member, v_caller, 'reopen', p_table, p_row_id, format('Reopened %s block', p_slot));
END $$;
GRANT EXECUTE ON FUNCTION public.amtr_reopen(TEXT, UUID, TEXT) TO authenticated;
