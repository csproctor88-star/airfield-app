-- ============================================================
-- PPR Agency Members — link users to coordinating agencies
--
-- Today `ppr_agencies` is a free-text label list per base, with
-- no link to the people responsible for the agency. RLS lets any
-- user with `ppr:coordinate` act on any agency's coord row, and
-- there's no recipient list for the email path that fires when
-- a PPR is pushed for coordination.
--
-- This table is the missing link: agency_id × user_id, scoped to
-- a base. Used by:
--   1. The triage email path (fetch members → email each).
--   2. The sidebar pending-count badge (count coord rows where
--      the current user is a member of the assigned agency).
--   3. Future scoping of the `ppr_coordination` UPDATE policy if
--      we later want to lock a coord row to its agency members.
--
-- Management is admin-only (`base_setup:write`) because it
-- determines who gets emailed and who shows pending dots.
-- ============================================================

CREATE TABLE IF NOT EXISTS ppr_agency_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  UUID NOT NULL REFERENCES ppr_agencies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ppr_agency_members_agency ON ppr_agency_members(agency_id);
CREATE INDEX IF NOT EXISTS idx_ppr_agency_members_user   ON ppr_agency_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ppr_agency_members_base   ON ppr_agency_members(base_id);

ALTER TABLE ppr_agency_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppr_agency_members_select" ON ppr_agency_members;
DROP POLICY IF EXISTS "ppr_agency_members_insert" ON ppr_agency_members;
DROP POLICY IF EXISTS "ppr_agency_members_update" ON ppr_agency_members;
DROP POLICY IF EXISTS "ppr_agency_members_delete" ON ppr_agency_members;

-- Any user with base access can read membership (needed so the
-- sidebar badge hook can compute "am I a member of this agency"
-- for the current user).
CREATE POLICY "ppr_agency_members_select" ON ppr_agency_members
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- Mutations are admin-only — same gate as the parent ppr_agencies
-- table writes (see 2026042600_ppr_coordination.sql).
CREATE POLICY "ppr_agency_members_insert" ON ppr_agency_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

CREATE POLICY "ppr_agency_members_update" ON ppr_agency_members
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

CREATE POLICY "ppr_agency_members_delete" ON ppr_agency_members
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );
