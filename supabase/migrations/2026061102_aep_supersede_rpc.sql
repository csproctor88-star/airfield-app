-- 2026061102 — supersede_aep_plan SECURITY DEFINER RPC
--
-- Phase 3b's supersedePlan() in lib/supabase/aep.ts was two writes:
-- INSERT the new plan row, then UPDATE the prior row's
-- replaced_by_id. If the client crashed (or RLS rejected one of the
-- writes) between the two, the base could be left with two rows
-- where replaced_by_id IS NULL — i.e. both rows looking active to
-- the dashboard. Idempotent retry resolves but the transient window
-- is real.
--
-- This RPC collapses both writes into a single PL/pgSQL function so
-- they commit atomically. Modeled on sign_sms_policy
-- (2026052702_sms_public_rpc_and_cron.sql §5).
--
-- The function returns JSONB with the new plan's id and core
-- fields so the caller can avoid a follow-up SELECT.

CREATE OR REPLACE FUNCTION public.supersede_aep_plan(
  p_prior_plan_id        UUID,
  p_version              TEXT,
  p_effective_date       DATE,
  p_document_url         TEXT DEFAULT NULL,
  p_storage_path         TEXT DEFAULT NULL,
  p_approved_by_faa_at   DATE DEFAULT NULL,
  p_faa_acceptance_ref   TEXT DEFAULT NULL,
  p_notes                TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_prior      aep_plans%ROWTYPE;
  v_new_id     UUID := gen_random_uuid();
  v_new_row    aep_plans%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_prior FROM aep_plans WHERE id = p_prior_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Prior AEP plan not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_prior.replaced_by_id IS NOT NULL THEN
    RAISE EXCEPTION 'AEP plan is already superseded' USING ERRCODE = '22023';
  END IF;

  IF NOT public.user_has_base_access(v_caller, v_prior.base_id) THEN
    RAISE EXCEPTION 'permission denied: no access to base';
  END IF;

  IF NOT public.user_has_permission(v_caller, 'aep:write') THEN
    RAISE EXCEPTION 'permission denied: aep:write';
  END IF;

  -- Insert new plan (transactional with the UPDATE below — both
  -- commit or neither does, eliminating the two-active-rows window).
  INSERT INTO aep_plans (
    id, base_id, version, effective_date,
    document_url, storage_path,
    approved_by_faa_at, faa_acceptance_ref,
    notes, created_by
  ) VALUES (
    v_new_id, v_prior.base_id, p_version, p_effective_date,
    p_document_url, p_storage_path,
    p_approved_by_faa_at, p_faa_acceptance_ref,
    p_notes, v_caller
  )
  RETURNING * INTO v_new_row;

  -- Point the prior row at the new one.
  UPDATE aep_plans
     SET replaced_by_id = v_new_id,
         updated_at     = now()
   WHERE id = p_prior_plan_id;

  RETURN jsonb_build_object(
    'ok', true,
    'plan', to_jsonb(v_new_row)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.supersede_aep_plan(UUID, TEXT, DATE, TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.supersede_aep_plan IS
  'Atomic AEP plan supersede: inserts a new aep_plans row and points the prior row''s replaced_by_id at it in a single transaction. Caller must have aep:write + base_access. Mirrors sign_sms_policy.';
