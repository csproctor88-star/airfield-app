-- ============================================================
-- AMTR — Migration 17: shared Qualifications / Skill Levels / SEIs.
--
-- Qualification training packages, skill levels, and SEIs are now
-- defined once per base (amtr_qual_catalog) and shown identically on
-- every record. Each member's record only tracks attained status +
-- completion date (amtr_qual_progress). Replaces the old per-member
-- free-text amtr_qtp / amtr_quals rows (left in place but unused).
-- ============================================================

CREATE TABLE IF NOT EXISTS amtr_qual_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('qtp','skill_level','sei')),
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_qual_catalog_base ON amtr_qual_catalog(base_id, category, sort_order);

CREATE TABLE IF NOT EXISTS amtr_qual_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  catalog_id    UUID NOT NULL REFERENCES amtr_qual_catalog(id) ON DELETE CASCADE,
  attained      BOOLEAN NOT NULL DEFAULT FALSE,
  complete_date DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, catalog_id)
);
CREATE INDEX IF NOT EXISTS idx_amtr_qual_progress_member ON amtr_qual_progress(member_id);

ALTER TABLE amtr_qual_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_qual_catalog_select" ON amtr_qual_catalog FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_qual_catalog_write" ON amtr_qual_catalog FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));

ALTER TABLE amtr_qual_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_qual_progress_select" ON amtr_qual_progress FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_qual_progress_insert" ON amtr_qual_progress FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
CREATE POLICY "amtr_qual_progress_update" ON amtr_qual_progress FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
CREATE POLICY "amtr_qual_progress_delete" ON amtr_qual_progress FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:delete'));
