-- ============================================================
-- Tighten the permissive policies on pdf_extraction_status and
-- pdf_text_pages that Supabase's linter flagged.
--
-- How we got here: PDF text extraction is performed client-side
-- from `components/PDFLibrary.tsx` and server-side by the
-- `extract-pdf-text` edge function. The edge function uses
-- SUPABASE_SERVICE_ROLE_KEY (bypasses RLS), so no user-facing
-- write policies are needed for it. The original dashboard-added
-- policies allowed any anon or authenticated user to write — way
-- too broad.
--
-- New model:
--   - READ (SELECT): any authenticated user — needed for search.
--   - WRITE (INSERT/UPDATE/DELETE): admins only (sys_admin /
--     base_admin / airfield_manager / namo via user_is_admin()).
--   - Anon: no write access at all.
--   - Service role: bypasses RLS, so the edge function still works.
--
-- Follow-up (not in this migration): PDFLibrary.tsx currently
-- shows the "Extract" path to every user. After this migration,
-- non-admin extract attempts will fail with an RLS error — we
-- should hide/disable the button for non-admins on the client.
-- ============================================================

-- ── pdf_extraction_status ──────────────────────────────────
DROP POLICY IF EXISTS "Anon can insert extraction status" ON pdf_extraction_status;
DROP POLICY IF EXISTS "Anon can update extraction status" ON pdf_extraction_status;
DROP POLICY IF EXISTS "Authenticated users can insert extraction status" ON pdf_extraction_status;
DROP POLICY IF EXISTS "Authenticated users can update extraction status" ON pdf_extraction_status;

CREATE POLICY "Admins can insert extraction status"
  ON pdf_extraction_status FOR INSERT
  TO authenticated
  WITH CHECK (user_is_admin(auth.uid()));

CREATE POLICY "Admins can update extraction status"
  ON pdf_extraction_status FOR UPDATE
  TO authenticated
  USING (user_is_admin(auth.uid()))
  WITH CHECK (user_is_admin(auth.uid()));

-- ── pdf_text_pages ─────────────────────────────────────────
DROP POLICY IF EXISTS "Anon can insert pdf text" ON pdf_text_pages;
DROP POLICY IF EXISTS "Anon can delete pdf text" ON pdf_text_pages;
DROP POLICY IF EXISTS "Authenticated users can insert pdf text" ON pdf_text_pages;
DROP POLICY IF EXISTS "Authenticated users can delete pdf text" ON pdf_text_pages;

CREATE POLICY "Admins can insert pdf text"
  ON pdf_text_pages FOR INSERT
  TO authenticated
  WITH CHECK (user_is_admin(auth.uid()));

CREATE POLICY "Admins can delete pdf text"
  ON pdf_text_pages FOR DELETE
  TO authenticated
  USING (user_is_admin(auth.uid()));
