-- 2026062307_flip_sign_rpc.sql
-- Sequential, role-gated, permanent FLIP review sign-off.
-- The ONLY writer of flip_review_signoffs.* signature columns.
-- Mirrors the pure logic in lib/flip/roles.ts. Keep in sync.

CREATE OR REPLACE FUNCTION public.flip_sign_review(
  p_review_id UUID, p_slot TEXT
) RETURNS flip_review_signoffs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_base    UUID;
  v_row     flip_review_signoffs;
  v_roles   TEXT[];
  v_role_ok BOOLEAN;
BEGIN
  IF p_slot NOT IN ('custodian','namo','afm') THEN
    RAISE EXCEPTION 'flip_sign_review: invalid slot %', p_slot;
  END IF;

  SELECT base_id INTO v_base FROM flip_reviews WHERE id = p_review_id;
  IF v_base IS NULL THEN RAISE EXCEPTION 'flip_sign_review: review not found'; END IF;

  IF NOT (user_has_base_access(v_caller, v_base) AND user_has_permission(v_caller, 'flip:write')) THEN
    RAISE EXCEPTION 'flip_sign_review: not authorized';
  END IF;

  v_roles := CASE p_slot
    WHEN 'custodian' THEN ARRAY['custodian','alternate']
    WHEN 'namo'      THEN ARRAY['namo']
    WHEN 'afm'       THEN ARRAY['afm']
  END;
  SELECT EXISTS (
    SELECT 1 FROM flip_role_assignments a
    WHERE a.base_id = v_base AND a.user_id = v_caller AND a.role = ANY(v_roles)
  ) INTO v_role_ok;
  IF NOT v_role_ok THEN
    RAISE EXCEPTION 'flip_sign_review: caller not authorized to sign slot %', p_slot;
  END IF;

  INSERT INTO flip_review_signoffs (review_id, base_id)
    VALUES (p_review_id, v_base)
    ON CONFLICT (review_id) DO NOTHING;
  SELECT * INTO v_row FROM flip_review_signoffs WHERE review_id = p_review_id FOR UPDATE;

  IF p_slot = 'namo' AND v_row.custodian_signed_at IS NULL THEN
    RAISE EXCEPTION 'flip_sign_review: custodian must sign first';
  END IF;
  IF p_slot = 'afm' AND v_row.namo_signed_at IS NULL THEN
    RAISE EXCEPTION 'flip_sign_review: NAMO must sign first';
  END IF;

  IF (p_slot = 'custodian' AND v_row.custodian_signed_at IS NOT NULL)
  OR (p_slot = 'namo'      AND v_row.namo_signed_at      IS NOT NULL)
  OR (p_slot = 'afm'       AND v_row.afm_signed_at       IS NOT NULL) THEN
    RAISE EXCEPTION 'flip_sign_review: % slot already signed', p_slot;
  END IF;

  EXECUTE format(
    'UPDATE flip_review_signoffs SET %I = $1, %I = now() WHERE review_id = $2 RETURNING *',
    p_slot || '_signed_by', p_slot || '_signed_at'
  ) INTO v_row USING v_caller, p_review_id;

  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION public.flip_sign_review(UUID, TEXT) TO authenticated;
