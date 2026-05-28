-- ============================================================
-- AMTR — amtr_transcribe: also clear the Certifier column.
--
-- Certifier sign-offs are NOT transcribed when a record is brought into the
-- system — only Trainee and Trainer initials carry over. So transcription now
-- ALSO clears the certifier column on each transcribed item (initials +
-- signed_by + signed_at), forcing a fresh certification in the new system.
-- The Certifier column is no longer a transcribe target in the UI; this guard
-- (p_slot <> 'certifier') just keeps the RPC safe if it ever were.
--
-- Supersedes 2026061501. Everything else (overwrite, completion-date stamp,
-- authority + self-cert guards, audit) is unchanged.
-- ============================================================

CREATE OR REPLACE FUNCTION public.amtr_transcribe(
  p_table TEXT, p_row_id UUID, p_slot TEXT, p_initials TEXT, p_complete_date DATE
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_slots        TEXT[];
  v_base_id      UUID;
  v_member       UUID;
  v_member_user  UUID;
  v_caller       UUID := auth.uid();
  v_role_ok      BOOLEAN;
  v_date_col     TEXT;
BEGIN
  v_slots := amtr_slots_for_table(p_table);
  IF v_slots IS NULL THEN RAISE EXCEPTION 'amtr_transcribe: table % is not signable', p_table; END IF;
  IF NOT (p_slot = ANY (v_slots)) THEN RAISE EXCEPTION 'amtr_transcribe: slot % invalid for %', p_slot, p_table; END IF;

  EXECUTE format('SELECT base_id, member_id FROM %I WHERE id = $1', p_table)
    INTO v_base_id, v_member USING p_row_id;
  IF v_base_id IS NULL THEN RAISE EXCEPTION 'amtr_transcribe: row not found'; END IF;

  IF NOT (user_has_base_access(v_caller, v_base_id) AND user_has_permission(v_caller, 'amtr:write')) THEN
    RAISE EXCEPTION 'amtr_transcribe: not authorized';
  END IF;

  -- Self-certification guard: on your own record only the trainee block.
  SELECT user_id INTO v_member_user FROM amtr_members WHERE id = v_member;
  IF v_member_user IS NOT NULL AND v_member_user = v_caller AND p_slot <> 'trainee' THEN
    RAISE EXCEPTION 'amtr_transcribe: on your own record you may only sign the Trainee block';
  END IF;

  -- Hierarchical role authority (identical matrix to amtr_sign).
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
  IF NOT v_role_ok THEN RAISE EXCEPTION 'amtr_transcribe: caller not authorized to sign slot %', p_slot; END IF;

  -- Overwrite the initials + record who/when. NO finality check — transcription
  -- replaces any existing value in the slot.
  EXECUTE format('UPDATE %I SET %I = $1, %I = $2, %I = now() WHERE id = $3',
    p_table, p_slot || '_initials', p_slot || '_signed_by', p_slot || '_signed_at')
    USING p_initials, v_caller, p_row_id;

  -- Certifier sign-offs are NOT transcribed — clear the certifier column on
  -- every transcribed item (the certifier must re-certify in the new system).
  IF 'certifier' = ANY (v_slots) AND p_slot <> 'certifier' THEN
    EXECUTE format('UPDATE %I SET certifier_initials = NULL, certifier_signed_by = NULL, certifier_signed_at = NULL WHERE id = $1', p_table)
      USING p_row_id;
  END IF;

  -- Stamp the completion-date column for this form with the transcription date.
  v_date_col := CASE p_table
    WHEN 'amtr_jqs_progress'  THEN 'complete_date'
    WHEN 'amtr_797'           THEN 'complete_date'
    WHEN 'amtr_1098_progress' THEN 'last_completed'
    WHEN 'amtr_803'           THEN 'eval_date'
    ELSE NULL
  END;
  IF v_date_col IS NOT NULL AND p_complete_date IS NOT NULL THEN
    EXECUTE format('UPDATE %I SET %I = $1 WHERE id = $2', p_table, v_date_col)
      USING p_complete_date, p_row_id;
  END IF;

  INSERT INTO amtr_audit_log (base_id, member_id, actor_user_id, action, table_name, row_id, detail)
    VALUES (v_base_id, v_member, v_caller, 'transcribe', p_table, p_row_id,
      format('Transcribed %s block (initials %s, completed %s); cleared certifier', p_slot, p_initials, p_complete_date));
END $$;
GRANT EXECUTE ON FUNCTION public.amtr_transcribe(TEXT, UUID, TEXT, TEXT, DATE) TO authenticated;
