-- ============================================================
-- Status board layout — Migration 2/2: per-base section order + RLS
--
-- One row per base holding the saved order of the Airfield Status board
-- section cards (runway / navaid / arff / standalone custom boards,
-- keyed 'board_<uuid>'). Absent row = default order. Section keys that
-- disappear (deleted custom boards) are ignored at render; new sections
-- append in default position (lib/status-board-order.ts merge).
--
-- RLS: everyone at the base READS the layout (the board renders in the
-- saved order for all viewers); writing it requires the
-- airfield_status:manage_layout key (2026071900 — base-admin tier only).
-- DELETE = the "Reset to default" action, same permission.
--
-- Deliberately its own table rather than a bases column: bases UPDATE is
-- open to base_setup:write holders (amops), and the owner ruled layout
-- management base-admin-only — a narrow table keeps the RLS exact.
--
-- Post-apply verification:
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'status_board_layouts' ORDER BY cmd;
--   -- expect 4 policies (delete/insert/select/update)
--   SELECT rowsecurity FROM pg_tables WHERE tablename = 'status_board_layouts';
--   -- expect true
-- ============================================================

CREATE TABLE status_board_layouts (
  base_id UUID PRIMARY KEY REFERENCES bases(id) ON DELETE CASCADE,
  section_order TEXT[] NOT NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE status_board_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_board_layouts_select" ON status_board_layouts
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:view')
  );

CREATE POLICY "status_board_layouts_insert" ON status_board_layouts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:manage_layout')
  );

CREATE POLICY "status_board_layouts_update" ON status_board_layouts
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:manage_layout')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:manage_layout')
  );

CREATE POLICY "status_board_layouts_delete" ON status_board_layouts
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:manage_layout')
  );
