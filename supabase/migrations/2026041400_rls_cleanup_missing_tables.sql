-- ============================================================
-- Supabase linter cleanup: enable RLS on 6 public tables that
-- were missing it.
--
-- Two classes of fix here:
--
-- 1. pdf_extraction_status, pdf_text_pages — originally created
--    with ALTER TABLE ... ENABLE ROW LEVEL SECURITY in
--    2026021906_pdf_text_search.sql. RLS was later disabled
--    outside version control (the Supabase linter is reporting
--    a mix of "Anon can insert/update" + "Service role full
--    access" policies that were added through the dashboard).
--    We just re-enable RLS; existing policies stay in place.
--    NOTE: the "Anon can insert/update" policies on these tables
--    allow unauthenticated writes and should be reviewed
--    separately — outside the scope of this migration.
--
-- 2. custom_status_boards, custom_status_items, ppr_columns,
--    ppr_entries — base-scoped tables created without any RLS.
--    We enable RLS and add the standard base-access / can-write
--    policy set used across the rest of the app.
-- ============================================================

-- ── 1. Re-enable RLS on PDF text tables ─────────────────────
ALTER TABLE pdf_extraction_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_text_pages ENABLE ROW LEVEL SECURITY;

-- ── 2. Custom status boards ────────────────────────────────
ALTER TABLE custom_status_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_status_boards_select" ON custom_status_boards;
DROP POLICY IF EXISTS "custom_status_boards_insert" ON custom_status_boards;
DROP POLICY IF EXISTS "custom_status_boards_update" ON custom_status_boards;
DROP POLICY IF EXISTS "custom_status_boards_delete" ON custom_status_boards;

CREATE POLICY "custom_status_boards_select" ON custom_status_boards
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "custom_status_boards_insert" ON custom_status_boards
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "custom_status_boards_update" ON custom_status_boards
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "custom_status_boards_delete" ON custom_status_boards
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ── 3. Custom status items ─────────────────────────────────
ALTER TABLE custom_status_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_status_items_select" ON custom_status_items;
DROP POLICY IF EXISTS "custom_status_items_insert" ON custom_status_items;
DROP POLICY IF EXISTS "custom_status_items_update" ON custom_status_items;
DROP POLICY IF EXISTS "custom_status_items_delete" ON custom_status_items;

CREATE POLICY "custom_status_items_select" ON custom_status_items
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "custom_status_items_insert" ON custom_status_items
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "custom_status_items_update" ON custom_status_items
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "custom_status_items_delete" ON custom_status_items
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ── 4. PPR columns ─────────────────────────────────────────
ALTER TABLE ppr_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppr_columns_select" ON ppr_columns;
DROP POLICY IF EXISTS "ppr_columns_insert" ON ppr_columns;
DROP POLICY IF EXISTS "ppr_columns_update" ON ppr_columns;
DROP POLICY IF EXISTS "ppr_columns_delete" ON ppr_columns;

CREATE POLICY "ppr_columns_select" ON ppr_columns
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "ppr_columns_insert" ON ppr_columns
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "ppr_columns_update" ON ppr_columns
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "ppr_columns_delete" ON ppr_columns
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ── 5. PPR entries ─────────────────────────────────────────
ALTER TABLE ppr_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppr_entries_select" ON ppr_entries;
DROP POLICY IF EXISTS "ppr_entries_insert" ON ppr_entries;
DROP POLICY IF EXISTS "ppr_entries_update" ON ppr_entries;
DROP POLICY IF EXISTS "ppr_entries_delete" ON ppr_entries;

CREATE POLICY "ppr_entries_select" ON ppr_entries
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "ppr_entries_insert" ON ppr_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "ppr_entries_update" ON ppr_entries
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "ppr_entries_delete" ON ppr_entries
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));
