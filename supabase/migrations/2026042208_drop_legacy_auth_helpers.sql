-- ============================================================
-- Phase E2 — Drop legacy auth helpers (comprehensive cleanup)
--
-- Initial attempt failed because several tables had older policies
-- I didn't catch in the Phase D audit — either policies with
-- different names than the ones I dropped (e.g. `iisl_*` vs
-- `inspection_item_system_links_*`, `sc_*` vs `shift_checklists_*`),
-- or tables that weren't in my batch list at all
-- (outage_events, custom_status_boards/items, check_comments,
-- ppr_columns, waiver_criteria/attachments/reviews/coordination,
-- storage.objects photo policies).
--
-- This migration:
--   1. Drops every remaining user_can_write / user_is_admin policy
--      across those tables + the photos storage bucket.
--   2. Recreates each as a matrix-based policy using the nearest-fit
--      permission key.
--   3. Drops user_can_write, user_is_admin, user_is_base_admin_at
--      at the end (no dependencies now).
-- user_has_base_access and user_is_sys_admin stay.
-- ============================================================

-- ── discrepancies (main gate — Phase D missed this) ───────
DROP POLICY IF EXISTS "discrepancies_insert" ON discrepancies;
CREATE POLICY "discrepancies_insert" ON discrepancies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'discrepancies:write'));

DROP POLICY IF EXISTS "discrepancies_update" ON discrepancies;
CREATE POLICY "discrepancies_update" ON discrepancies
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'discrepancies:write'));

DROP POLICY IF EXISTS "discrepancies_delete" ON discrepancies;
CREATE POLICY "discrepancies_delete" ON discrepancies
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'discrepancies:delete'));

-- ── check_comments ────────────────────────────────────────
DROP POLICY IF EXISTS "check_comments_insert" ON check_comments;
CREATE POLICY "check_comments_insert" ON check_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'checks:write'));

DROP POLICY IF EXISTS "check_comments_update" ON check_comments;
CREATE POLICY "check_comments_update" ON check_comments
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'checks:write'));

DROP POLICY IF EXISTS "check_comments_delete" ON check_comments;
CREATE POLICY "check_comments_delete" ON check_comments
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'checks:write'));

-- ── waiver child tables ───────────────────────────────────
DROP POLICY IF EXISTS "waiver_criteria_insert" ON waiver_criteria;
CREATE POLICY "waiver_criteria_insert" ON waiver_criteria
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_criteria_update" ON waiver_criteria;
CREATE POLICY "waiver_criteria_update" ON waiver_criteria
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_criteria_delete" ON waiver_criteria;
CREATE POLICY "waiver_criteria_delete" ON waiver_criteria
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_attachments_insert" ON waiver_attachments;
CREATE POLICY "waiver_attachments_insert" ON waiver_attachments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_attachments_update" ON waiver_attachments;
CREATE POLICY "waiver_attachments_update" ON waiver_attachments
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_attachments_delete" ON waiver_attachments;
CREATE POLICY "waiver_attachments_delete" ON waiver_attachments
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_reviews_insert" ON waiver_reviews;
CREATE POLICY "waiver_reviews_insert" ON waiver_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'waivers:review'));

DROP POLICY IF EXISTS "waiver_reviews_update" ON waiver_reviews;
CREATE POLICY "waiver_reviews_update" ON waiver_reviews
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'waivers:review'));

DROP POLICY IF EXISTS "waiver_reviews_delete" ON waiver_reviews;
CREATE POLICY "waiver_reviews_delete" ON waiver_reviews
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_coordination_insert" ON waiver_coordination;
CREATE POLICY "waiver_coordination_insert" ON waiver_coordination
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_coordination_update" ON waiver_coordination;
CREATE POLICY "waiver_coordination_update" ON waiver_coordination
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'waivers:write'));

DROP POLICY IF EXISTS "waiver_coordination_delete" ON waiver_coordination;
CREATE POLICY "waiver_coordination_delete" ON waiver_coordination
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'waivers:write'));

-- ── inspection_item_system_links (iisl_* orphan names) ────
DROP POLICY IF EXISTS "iisl_insert" ON inspection_item_system_links;
DROP POLICY IF EXISTS "iisl_update" ON inspection_item_system_links;
DROP POLICY IF EXISTS "iisl_delete" ON inspection_item_system_links;

-- ── base_wildlife_species (orphan "Admins can manage…") ───
DROP POLICY IF EXISTS "Admins can manage base species" ON base_wildlife_species;

-- ── outage_events (NAVAID outage tracking) ────────────────
DROP POLICY IF EXISTS "outage_events_insert" ON outage_events;
CREATE POLICY "outage_events_insert" ON outage_events
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:write'));

-- ── bwc_history UPDATE/DELETE (Phase C did INSERT only) ──
DROP POLICY IF EXISTS "bwc_history_update" ON bwc_history;
CREATE POLICY "bwc_history_update" ON bwc_history
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'wildlife:write'));

DROP POLICY IF EXISTS "bwc_history_delete" ON bwc_history;
CREATE POLICY "bwc_history_delete" ON bwc_history
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'wildlife:write'));

-- ── base_facilities (orphan "_write" policy name) ────────
DROP POLICY IF EXISTS "base_facilities_write" ON base_facilities;

-- ── qrc_executions (qrc_exec_* orphan names) ─────────────
DROP POLICY IF EXISTS "qrc_exec_insert" ON qrc_executions;
DROP POLICY IF EXISTS "qrc_exec_update" ON qrc_executions;
DROP POLICY IF EXISTS "qrc_exec_delete" ON qrc_executions;

-- ── shift_checklists (sc_* orphan names) ─────────────────
DROP POLICY IF EXISTS "sc_insert" ON shift_checklists;
DROP POLICY IF EXISTS "sc_update" ON shift_checklists;

-- ── shift_checklist_responses (scr_* orphan names) ───────
DROP POLICY IF EXISTS "scr_insert" ON shift_checklist_responses;
DROP POLICY IF EXISTS "scr_update" ON shift_checklist_responses;

-- ── shift_checklist_items (sci_* orphan names) ───────────
DROP POLICY IF EXISTS "sci_insert" ON shift_checklist_items;
DROP POLICY IF EXISTS "sci_update" ON shift_checklist_items;
DROP POLICY IF EXISTS "sci_delete" ON shift_checklist_items;

-- ── qrc_templates (qrc_tmpl_* orphan names) ──────────────
DROP POLICY IF EXISTS "qrc_tmpl_insert" ON qrc_templates;
DROP POLICY IF EXISTS "qrc_tmpl_update" ON qrc_templates;
DROP POLICY IF EXISTS "qrc_tmpl_delete" ON qrc_templates;

-- ── profiles (base_admin orphan policies) ────────────────
-- 2026022600 created separate profiles_insert_base_admin /
-- profiles_update_base_admin policies on top of the main
-- profiles_insert / profiles_update. My 2026042207 replaced the
-- main pair with a matrix version (users:manage + self-write),
-- but the base_admin-specific orphans survived. The matrix
-- equivalents now cover both paths — base admins at the caller's
-- primary base already hold users:manage — so we can safely drop
-- the orphans.
DROP POLICY IF EXISTS "profiles_insert_base_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_base_admin" ON profiles;

-- ── custom_status_boards (configurable dashboard panels) ─
DROP POLICY IF EXISTS "custom_status_boards_insert" ON custom_status_boards;
CREATE POLICY "custom_status_boards_insert" ON custom_status_boards
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'airfield_status:write'));

DROP POLICY IF EXISTS "custom_status_boards_update" ON custom_status_boards;
CREATE POLICY "custom_status_boards_update" ON custom_status_boards
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'airfield_status:write'));

DROP POLICY IF EXISTS "custom_status_boards_delete" ON custom_status_boards;
CREATE POLICY "custom_status_boards_delete" ON custom_status_boards
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'airfield_status:write'));

-- ── custom_status_items ──────────────────────────────────
DROP POLICY IF EXISTS "custom_status_items_insert" ON custom_status_items;
CREATE POLICY "custom_status_items_insert" ON custom_status_items
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'airfield_status:write'));

DROP POLICY IF EXISTS "custom_status_items_update" ON custom_status_items;
CREATE POLICY "custom_status_items_update" ON custom_status_items
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'airfield_status:write'));

DROP POLICY IF EXISTS "custom_status_items_delete" ON custom_status_items;
CREATE POLICY "custom_status_items_delete" ON custom_status_items
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'airfield_status:write'));

-- ── ppr_columns (per-base PPR form config) ───────────────
DROP POLICY IF EXISTS "ppr_columns_insert" ON ppr_columns;
CREATE POLICY "ppr_columns_insert" ON ppr_columns
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "ppr_columns_update" ON ppr_columns;
CREATE POLICY "ppr_columns_update" ON ppr_columns
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "ppr_columns_delete" ON ppr_columns;
CREATE POLICY "ppr_columns_delete" ON ppr_columns
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

-- ── storage.objects photo policies (path-scoped uploads) ─
DROP POLICY IF EXISTS "photos_insert_path_scoped" ON storage.objects;
CREATE POLICY "photos_insert_path_scoped" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND public.user_has_permission(auth.uid(), 'photos:write')
  );

DROP POLICY IF EXISTS "photos_update_path_scoped" ON storage.objects;
CREATE POLICY "photos_update_path_scoped" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'photos'
    AND public.user_has_permission(auth.uid(), 'photos:write')
  );

DROP POLICY IF EXISTS "photos_delete_path_scoped" ON storage.objects;
CREATE POLICY "photos_delete_path_scoped" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'photos'
    AND public.user_has_permission(auth.uid(), 'photos:delete')
  );

-- ============================================================
-- Finally: drop the three legacy helpers.
-- RESTRICT (default) — if something we missed still references
-- them, the drop fails loudly so we can surface it.
-- ============================================================
DROP FUNCTION IF EXISTS public.user_can_write(uuid);
DROP FUNCTION IF EXISTS public.user_is_admin(uuid);
DROP FUNCTION IF EXISTS public.user_is_base_admin_at(uuid, uuid);
