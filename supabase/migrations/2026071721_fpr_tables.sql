-- ============================================================
-- Flight Planning Room (FPR) Check — Migration 2/2: tables + RLS
--
-- Spec: docs/superpowers/specs/2026-07-16-flight-planning-room-check-design.md
--       (§Data model & migrations)
--
-- fpr_checklist_items — per-base config (mirror of scn_agencies /
--   shift_checklist_items): label, optional guidance, sort_order,
--   is_active soft-delete.
-- fpr_checks — one row per completed/edited check; one per base +
--   Zulu date + shift (UNIQUE (base_id, check_date, shift)).
-- fpr_check_results — per-item result snapshot. `item_label` is
--   denormalized ON PURPOSE (mirrors scn_check_results.agency_name,
--   see 2026042001_scn_daily_check.sql header): template edits,
--   renames, or deletes never corrupt completed-check history.
--   `item_id` is a nullable FK (ON DELETE SET NULL) kept only as an
--   optional cross-reference back to the (possibly-edited) template row.
--
-- RLS uses ONLY user_has_base_access() + user_has_permission() — the
-- permission-matrix helpers (2026042200_permission_matrix_scaffold.sql
-- onward). Never user_can_write / user_is_admin / user_is_base_admin_at
-- (all dropped in 2026042208).
--
-- No storage bucket, no RPC — a completed check is editable/deletable
-- by any fpr:write holder, same as SCN (no signature semantics).
--
-- STAGED — NOT applied. Staged 2026-07-17 for owner review in the
-- morning; apply in order with `npx supabase db query --linked --file
-- <path>` — 2026071720_fpr_permissions.sql first, then this file.
--
-- Post-apply verification:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'fpr_%';
--   -- expect rowsecurity = true for all three tables
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'fpr_%' ORDER BY tablename, cmd;
--   -- expect 4 policies each on fpr_checklist_items / fpr_checks / fpr_check_results
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conrelid = 'fpr_checks'::regclass AND contype = 'u';
--   -- expect a UNIQUE constraint on (base_id, check_date, shift)
-- ============================================================

-- Template items (per-base config; mirror of scn_agencies / shift_checklist_items).
CREATE TABLE IF NOT EXISTS fpr_checklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  guidance   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fpr_items_base ON fpr_checklist_items(base_id, sort_order);

-- One row per completed/edited check. One check per base+Zulu date+shift.
CREATE TABLE IF NOT EXISTS fpr_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id         UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  check_date      DATE NOT NULL,
  shift           TEXT NOT NULL CHECK (shift IN ('day', 'swing', 'mid')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by_oi TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, check_date, shift)
);
CREATE INDEX IF NOT EXISTS idx_fpr_checks_base_date ON fpr_checks(base_id, check_date DESC);

-- Per-item result snapshot. item_label is denormalized ON PURPOSE (see scn_check_results):
-- template edits/renames/deletes never corrupt completed checks.
CREATE TABLE IF NOT EXISTS fpr_check_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id   UUID NOT NULL REFERENCES fpr_checks(id) ON DELETE CASCADE,
  item_id    UUID REFERENCES fpr_checklist_items(id) ON DELETE SET NULL,
  item_label TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('satisfactory', 'issue', 'na')),
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fpr_check_results_check ON fpr_check_results(check_id);

ALTER TABLE fpr_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fpr_checks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fpr_check_results   ENABLE ROW LEVEL SECURITY;

-- fpr_checklist_items: read on fpr:view, mutate on fpr:manage_checklist.
CREATE POLICY "fpr_checklist_items_select" ON fpr_checklist_items FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:view'));
CREATE POLICY "fpr_checklist_items_insert" ON fpr_checklist_items FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:manage_checklist'));
CREATE POLICY "fpr_checklist_items_update" ON fpr_checklist_items FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:manage_checklist'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:manage_checklist'));
CREATE POLICY "fpr_checklist_items_delete" ON fpr_checklist_items FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:manage_checklist'));

-- fpr_checks: read on fpr:view, log/edit/delete on fpr:write.
CREATE POLICY "fpr_checks_select" ON fpr_checks FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:view'));
CREATE POLICY "fpr_checks_insert" ON fpr_checks FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:write'));
CREATE POLICY "fpr_checks_update" ON fpr_checks FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:write'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:write'));
CREATE POLICY "fpr_checks_delete" ON fpr_checks FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:write'));

-- fpr_check_results: base-scoped via the parent check (scn_check_results pattern,
-- 2026042205:143-176).
CREATE POLICY "fpr_check_results_select" ON fpr_check_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM fpr_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'fpr:view')));
CREATE POLICY "fpr_check_results_insert" ON fpr_check_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM fpr_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'fpr:write')));
CREATE POLICY "fpr_check_results_update" ON fpr_check_results FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM fpr_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'fpr:write')));
CREATE POLICY "fpr_check_results_delete" ON fpr_check_results FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM fpr_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'fpr:write')));
