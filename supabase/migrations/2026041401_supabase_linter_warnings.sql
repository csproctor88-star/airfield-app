-- ============================================================
-- Supabase linter warnings cleanup:
--   1. function_search_path_mutable — pin search_path on 12
--      SECURITY DEFINER / STABLE functions so unqualified table
--      references can't be hijacked via a caller-set search_path.
--   2. rls_policy_always_true — tighten customer_feedback INSERT
--      so the base_id must reference an existing base.
--   3. public_bucket_allows_listing — drop the broad SELECT
--      policy on the `photos` storage bucket. Public URLs still
--      work because the bucket is public; the SELECT policy only
--      enables LISTING, which exposes more than we need.
--
-- Not addressed here (settings-level, not SQL):
--   - auth_leaked_password_protection: enable HaveIBeenPwned check
--     in Supabase Dashboard → Authentication → Providers.
-- ============================================================

-- ── 1. Pin search_path on security-sensitive functions ──────
ALTER FUNCTION public.user_has_base_access(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.user_can_write(uuid) SET search_path = 'public';
ALTER FUNCTION public.user_is_admin(uuid) SET search_path = 'public';
ALTER FUNCTION public.user_is_sys_admin(uuid) SET search_path = 'public';
ALTER FUNCTION public.user_is_base_admin_at(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.generate_display_id(text, text) SET search_path = 'public';
ALTER FUNCTION public.update_airfield_status(jsonb, uuid) SET search_path = 'public';
ALTER FUNCTION public.update_airfield_status(jsonb, uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.log_airfield_status_change() SET search_path = 'public';
ALTER FUNCTION public.search_all_pdfs(text, integer) SET search_path = 'public';
ALTER FUNCTION public.search_pdf(text, text) SET search_path = 'public';
ALTER FUNCTION public.search_user_documents(text, integer) SET search_path = 'public';

-- ── 2. Tighten customer_feedback INSERT (anon-submittable) ──
-- base_id is already NOT NULL; require it to match a real base
-- so the policy is no longer "always true" per the linter.
DROP POLICY IF EXISTS "Anyone can submit feedback" ON customer_feedback;
CREATE POLICY "Anyone can submit feedback"
  ON customer_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM bases WHERE id = customer_feedback.base_id));

-- ── 3. Drop broad SELECT policy on photos bucket ────────────
DROP POLICY IF EXISTS "Allow authenticated read photos" ON storage.objects;
