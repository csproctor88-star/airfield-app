-- =====================================================================
-- H-6 contract step — lock down direct daily_reviews writes.
--
-- APPLY ONLY AFTER the RPC-calling client has deployed
-- (lib/supabase/daily-reviews.ts → sign_daily_review_slot). Revoking
-- before deploy breaks live signing, because the old client writes the
-- table directly.
--
-- After this, JWT clients can no longer INSERT/UPDATE daily_reviews; all
-- signing goes through the SECURITY DEFINER RPC (2026062013), which
-- derives signed_by from auth.uid() and enforces the per-slot
-- permission. The service role (admin tooling) is unaffected. SELECT
-- remains base-scoped via daily_reviews_select.
-- =====================================================================

revoke insert, update on public.daily_reviews from authenticated, anon;
