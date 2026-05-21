-- ============================================================
-- AMTR — Migration 2/6: identity + base-shared catalogs
--
--   amtr_members           roster row, optionally linked to a profile
--   amtr_role_assignments  per-user AMTR roles (multi-row, the new role layer)
--   amtr_jqs_catalog       hierarchical 1C7X1 task library (base-shared)
--   amtr_1098_catalog      recurring-training tasks (base-shared)
--   amtr_1098_years        year labels + current-year flag (base-shared)
--   amtr_formal_catalog    HAF / Initial / Continuation courses (base-shared)
--   amtr_milestone_catalog QTP/PCG milestone items by path+phase (base-shared)
--   amtr_rat_catalog       Ready Airman Training requirements (base-shared)
--
-- Catalog rows are base-shared: one definition propagates to every
-- member's record. Member-specific completion/initials live in the
-- per-member progress tables (migration 3).
--
-- RLS pattern (canonical, from 2026050300):
--   SELECT  : user_has_base_access + amtr:view
--   INSERT/UPDATE/DELETE on catalogs : + amtr:manage  (NAMT-managed)
--   INSERT/UPDATE on members         : + amtr:write
--   DELETE  on members               : + amtr:delete
-- ============================================================

-- ── Roster ─────────────────────────────────────────────────
CREATE TABLE amtr_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL, -- nullable link
  full_name     TEXT NOT NULL,
  grade         TEXT,
  dafsc         TEXT,
  unit          TEXT,
  installation  TEXT,
  date_assigned DATE,
  status        TEXT NOT NULL DEFAULT 'Active'
                CHECK (status IN ('Active','Reserve','Guard','Civilian','Contractor','Separated')),
  tsc           TEXT,            -- Training Status Code A–Y
  duty_position TEXT,
  supervisor    TEXT,
  utm           TEXT,
  commander     TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_members_base ON amtr_members(base_id);
CREATE INDEX idx_amtr_members_user ON amtr_members(user_id);

-- ── AMTR role layer ────────────────────────────────────────
CREATE TABLE amtr_role_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('trainee','trainer','certifier','namt','afm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, user_id, role)
);
CREATE INDEX idx_amtr_roles_base_user ON amtr_role_assignments(base_id, user_id);

-- ── JQS-CFETP catalog (hierarchical) ───────────────────────
CREATE TABLE amtr_jqs_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('section','item')),
  number        TEXT,
  title         TEXT NOT NULL,
  depth         INT NOT NULL DEFAULT 0,
  required      BOOLEAN NOT NULL DEFAULT FALSE,
  training_refs TEXT,
  core_cert     TEXT,
  deploy_sei    TEXT,
  prof3         TEXT,
  prof5         TEXT,
  prof7         TEXT,
  prof9         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_jqs_catalog_base ON amtr_jqs_catalog(base_id, sort_order);

-- ── 1098 recurring-training catalog + years ────────────────
CREATE TABLE amtr_1098_catalog (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  task       TEXT NOT NULL,
  type       TEXT,
  frequency  TEXT NOT NULL DEFAULT 'Annual',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_1098_catalog_base ON amtr_1098_catalog(base_id, sort_order);

CREATE TABLE amtr_1098_years (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  year_label TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, year_label)
);

-- ── Formal training catalog ────────────────────────────────
CREATE TABLE amtr_formal_catalog (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  section    TEXT NOT NULL CHECK (section IN ('haf','initial','continuation')),
  course     TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_formal_catalog_base ON amtr_formal_catalog(base_id, section, sort_order);

-- ── QTP/PCG milestone catalog ──────────────────────────────
CREATE TABLE amtr_milestone_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  path        TEXT NOT NULL CHECK (path IN ('fiveLevelQtp','amosAmslPcg','sevenLevelQtp','afmPcg')),
  phase_label TEXT NOT NULL,
  sts_items   TEXT,
  topic       TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_milestone_catalog_base ON amtr_milestone_catalog(base_id, path, sort_order);

-- ── RAT catalog ────────────────────────────────────────────
CREATE TABLE amtr_rat_catalog (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  course     TEXT NOT NULL,
  category   TEXT,
  method     TEXT,
  frequency  TEXT NOT NULL DEFAULT 'Annual',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_rat_catalog_base ON amtr_rat_catalog(base_id, sort_order);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE amtr_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE amtr_role_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE amtr_jqs_catalog       ENABLE ROW LEVEL SECURITY;
ALTER TABLE amtr_1098_catalog      ENABLE ROW LEVEL SECURITY;
ALTER TABLE amtr_1098_years        ENABLE ROW LEVEL SECURITY;
ALTER TABLE amtr_formal_catalog    ENABLE ROW LEVEL SECURITY;
ALTER TABLE amtr_milestone_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE amtr_rat_catalog       ENABLE ROW LEVEL SECURITY;

-- members: view (amtr:view), write (amtr:write), delete (amtr:delete)
CREATE POLICY "amtr_members_select" ON amtr_members FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_members_insert" ON amtr_members FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
CREATE POLICY "amtr_members_update" ON amtr_members FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
CREATE POLICY "amtr_members_delete" ON amtr_members FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:delete'));

-- role assignments: view (amtr:view), all writes gated by amtr:manage
CREATE POLICY "amtr_roles_select" ON amtr_role_assignments FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_roles_write" ON amtr_role_assignments FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));

-- catalogs: view (amtr:view), all writes gated by amtr:manage
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'amtr_jqs_catalog','amtr_1098_catalog','amtr_1098_years',
    'amtr_formal_catalog','amtr_milestone_catalog','amtr_rat_catalog'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), ''amtr:view''));',
      t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), ''amtr:manage'')) WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), ''amtr:manage''));',
      t || '_write', t);
  END LOOP;
END $$;
