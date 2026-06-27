-- 2026062700_dashboard_boards.sql
-- Customizable dashboard: per-user + base-shared boards. One row per board,
-- widgets embedded as JSONB. RLS via matrix helpers. Phase-2 scope ('shared')
-- and role_template column are created now so no later migration is needed.

CREATE TABLE dashboard_boards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  owner_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = shared/base board
  scope         TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','shared')),
  name          TEXT NOT NULL DEFAULT 'My Dashboard',
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  role_template TEXT,                                            -- Phase 2: role-default templates
  layout        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_boards_owner  ON dashboard_boards(base_id, owner_id);
CREATE INDEX idx_dashboard_boards_shared ON dashboard_boards(base_id) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX uq_dashboard_boards_one_default_personal
  ON dashboard_boards(base_id, owner_id) WHERE is_default AND owner_id IS NOT NULL;

ALTER TABLE dashboard_boards ENABLE ROW LEVEL SECURITY;

-- READ: own personal boards + any shared board at an accessible base.
CREATE POLICY "dashboard_boards_select" ON dashboard_boards FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (owner_id = auth.uid() OR owner_id IS NULL)
  );

-- WRITE own personal boards (no extra permission needed).
CREATE POLICY "dashboard_boards_personal_write" ON dashboard_boards FOR ALL TO authenticated
  USING      (user_has_base_access(auth.uid(), base_id) AND owner_id = auth.uid())
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND owner_id = auth.uid());

-- WRITE shared/template boards requires the publish permission.
CREATE POLICY "dashboard_boards_shared_write" ON dashboard_boards FOR ALL TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id) AND owner_id IS NULL
    AND user_has_permission(auth.uid(), 'dashboard:publish-shared')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id) AND owner_id IS NULL
    AND user_has_permission(auth.uid(), 'dashboard:publish-shared')
  );

-- Permission keys (mirror in lib/permissions.ts as PERM.DASHBOARD_*).
INSERT INTO permissions (key, label, category, description) VALUES
  ('dashboard:publish-shared',   'Publish Shared Dashboards', 'dashboard', 'Create and edit base-shared dashboard boards and role templates'),
  ('dashboard:manage-templates', 'Manage Dashboard Templates','dashboard', 'Assign role-default dashboard templates new users inherit')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin all-permissions seed predates these keys; grant explicitly (idempotent).
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'dashboard:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- base_admin + airfield_manager: publish shared boards. base_admin also manages templates.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('base_admin',       'dashboard:publish-shared'),
  ('base_admin',       'dashboard:manage-templates'),
  ('airfield_manager', 'dashboard:publish-shared')
ON CONFLICT (role, permission_key) DO NOTHING;
