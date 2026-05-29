-- 2026061700_security_linter_hardening.sql
--
-- Resolves Supabase database-linter SECURITY findings.
--
-- NOTE on grants: Supabase grants EXECUTE directly to anon / authenticated /
-- service_role on every function in `public` (via ALTER DEFAULT PRIVILEGES), so
-- these are explicit per-role grants, not a PUBLIC grant. We therefore REVOKE
-- from the specific roles; service_role keeps its own grant untouched.

-- ──────────────────────────────────────────────────────────────────────────
-- (1) ERROR rls_disabled_in_public — the two digest dedup tables
-- ──────────────────────────────────────────────────────────────────────────
-- training_digest_log / annual_review_digest_log are written ONLY by the
-- service-role cron routes (/api/training-expiry-digest, /api/annual-review-
-- digest). No client/UI access. They had RLS off + full anon/authenticated
-- grants, so anon could read recipient emails and tamper with the send-dedup
-- log over REST. Lock them down exactly like rate_limit_hits / base_kiosk_tokens:
-- RLS on, no policies, broad grants revoked (service-role bypasses RLS).
ALTER TABLE public.training_digest_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_digest_log FROM anon, authenticated;

ALTER TABLE public.annual_review_digest_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.annual_review_digest_log FROM anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- (2) WARN function_search_path_mutable — pin search_path on SECURITY INVOKER
--     helper/trigger functions (the SECURITY DEFINER ones already pin it).
-- ──────────────────────────────────────────────────────────────────────────
ALTER FUNCTION public.enforce_airport_type_immutable()        SET search_path = 'public';
ALTER FUNCTION public._sms_risk_band(integer)                 SET search_path = 'public';
ALTER FUNCTION public._ppr_generate_number(uuid, date, text)  SET search_path = 'public';
ALTER FUNCTION public._sms_refresh_hazard_cache()             SET search_path = 'public';
ALTER FUNCTION public._sms_touch_updated_at()                 SET search_path = 'public';
ALTER FUNCTION public.amtr_slots_for_table(text)              SET search_path = 'public';
ALTER FUNCTION public._training_set_expiry()                  SET search_path = 'public';

-- ──────────────────────────────────────────────────────────────────────────
-- (3) WARN anon/authenticated_security_definer_function_executable
-- ──────────────────────────────────────────────────────────────────────────
-- (3a) Trigger functions — fire via triggers regardless of EXECUTE grants, so
--      no client role needs to call them over REST. Revoke anon + authenticated.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_airfield_status_change()  FROM anon, authenticated;

-- (3b) check_rate_limit — only the server-side rate limiter calls it, with a
--      service-role client. Drop anon + authenticated (service_role grant stays).
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon, authenticated;

-- (3c) Privileged / internal RPCs — the signed-in app (and server routes) call
--      these, never an unauthenticated visitor. Drop anon; authenticated +
--      service_role grants stay. (Overloads like update_airfield_status are
--      matched by name, so every signature is covered.)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true AND p.proname = ANY (ARRAY[
      '_sms_compute_spi_measurements','_sms_next_code','_sms_seed_default_spis',
      'amtr_base_for_path','amtr_reopen','amtr_required_slots','amtr_sign','amtr_transcribe',
      'approve_sms_moc','reject_sms_moc','ces_update_discrepancy','is_1098_year_archived',
      'promote_safety_report_to_hazard','safety_update_rsc_bwc','search_user_documents',
      'sign_sms_policy','supersede_aep_plan','update_airfield_status'
    ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- INTENTIONALLY LEFT WITH PUBLIC (anon) EXECUTE — do not lock these:
--   • Public-form RPCs (by design, called by unauthenticated visitors):
--     base_exists, get_public_feedback_config, get_public_ppr_config,
--     get_public_ppr_config_by_icao, get_public_safety_report_config_by_icao,
--     submit_public_ppr_request, submit_safety_report_public
--   • RLS helper functions called INSIDE row-level-security policies — every
--     role that queries a protected table must be able to execute them, so
--     revoking would break RLS app-wide:
--     user_has_base_access, user_has_permission, user_is_sys_admin
