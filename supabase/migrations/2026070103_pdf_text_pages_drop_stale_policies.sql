-- Audit H-3: remove the stale permissive write policies on pdf_text_pages that
-- the 2026041402 tightening tried (and failed) to drop — it issued
-- DROP POLICY IF EXISTS with the wrong names ("...pdf text" vs the real
-- "...text pages"), so on a fresh rebuild from migrations the original
-- auth.role()='authenticated' INSERT/UPDATE/DELETE policies survive and OR
-- open the library:manage gating.
--
-- LIVE-DB NOTE: a pg_policies query on the linked prod DB shows these stale
-- policies are ALREADY GONE (pdf_text_pages currently has only the
-- library:manage insert/delete + a service-role ALL + an authenticated
-- read) — they were cleaned up out-of-band via the Supabase dashboard, which
-- is not reflected in the migration files. So this migration is a NO-OP
-- against prod. Its purpose is to make the migration CHAIN self-consistent so
-- a rebuilt environment (e.g. the planned Platform One deployment) doesn't
-- resurrect the hole. All statements are IF EXISTS / idempotent.

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can insert text pages" ON pdf_text_pages;
DROP POLICY IF EXISTS "Authenticated users can update text pages" ON pdf_text_pages;
DROP POLICY IF EXISTS "Authenticated users can delete text pages" ON pdf_text_pages;

COMMIT;
