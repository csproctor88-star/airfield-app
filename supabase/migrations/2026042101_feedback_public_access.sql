-- ============================================================
-- Public feedback form access (QR-code visitors are anon).
--
-- Problem: the public /feedback/[baseId] page is fetched by an
-- unauthenticated visitor. The client was doing a direct
-- `SELECT ... FROM bases WHERE id = $1`, but `bases_select` is
-- granted only to `authenticated`, so anon got a null row and
-- the form always fell back to DEFAULT_FEEDBACK_CONFIG (enabled:
-- false) — every QR scan showed "Feedback Form Not Available."
--
-- Same root cause bit the INSERT path: the tightened
-- customer_feedback policy does `EXISTS (SELECT 1 FROM bases …)`,
-- which runs under the caller's RLS and silently returns false
-- for anon, so anonymous submissions would also have been blocked.
--
-- Fix: introduce two SECURITY DEFINER functions that expose only
-- what the public form needs, and grant EXECUTE to anon.
--   • get_public_feedback_config(base_id) — returns base name,
--     module-enabled flag, and feedback_form_config JSONB.
--   • base_exists(base_id) — used by the customer_feedback INSERT
--     policy so submissions succeed once the form is shown.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_feedback_config(p_base_id UUID)
RETURNS TABLE (
  base_name TEXT,
  module_enabled BOOLEAN,
  config JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT
    b.name AS base_name,
    CASE
      WHEN b.enabled_modules IS NULL THEN TRUE
      ELSE 'feedback' = ANY(b.enabled_modules)
    END AS module_enabled,
    COALESCE(b.feedback_form_config, '{}'::jsonb) AS config
  FROM bases b
  WHERE b.id = p_base_id
$$;

GRANT EXECUTE ON FUNCTION public.get_public_feedback_config(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.base_exists(p_base_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM bases WHERE id = p_base_id)
$$;

GRANT EXECUTE ON FUNCTION public.base_exists(UUID) TO anon, authenticated;

-- Rewrite the customer_feedback INSERT policy to use the helper
-- so anon submissions actually pass the existence check.
DROP POLICY IF EXISTS "Anyone can submit feedback" ON customer_feedback;
CREATE POLICY "Anyone can submit feedback"
  ON customer_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.base_exists(base_id));
