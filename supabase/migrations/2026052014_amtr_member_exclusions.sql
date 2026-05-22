-- ============================================================
-- AMTR — Migration 15: training-roster exclusions.
--
-- The roster now auto-populates from the base's assigned users. When a
-- user does not require a training record they are removed; this table
-- records that exclusion so the auto-populate doesn't recreate them.
-- ============================================================

CREATE TABLE IF NOT EXISTS amtr_member_exclusions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_amtr_member_excl_base ON amtr_member_exclusions(base_id);

ALTER TABLE amtr_member_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_member_excl_select" ON amtr_member_exclusions FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_member_excl_write" ON amtr_member_exclusions FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
