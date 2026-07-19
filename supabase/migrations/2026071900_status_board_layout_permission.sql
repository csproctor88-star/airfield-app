-- ============================================================
-- Status board layout — Migration 1/2: permission key + grants
--
-- Owner request 2026-07-19: base admins can re-align the Airfield Status
-- board sections by drag and drop; ONLY the base-admin level roles see
-- the Edit / Save buttons on the board itself.
--
-- airfield_status:manage_layout — enter board-layout edit mode on `/`,
-- reorder the section cards, save/reset the per-base order.
--
-- "Base admin level" = the full-admin tier that holds users:manage
-- (airfield_manager / namo / base_admin / sys_admin — the roles parallel
-- to sys_admin per the Phase A matrix). Deliberately NOT amops: amops
-- holds airfield_status:write for operating the board, but arranging the
-- board is base configuration.
--
-- Mirror in lib/permissions.ts (PERM.AIRFIELD_STATUS_MANAGE_LAYOUT).
--
-- Post-apply verification:
--   SELECT role FROM role_permissions WHERE permission_key = 'airfield_status:manage_layout' ORDER BY role;
--   -- expect: airfield_manager, base_admin, namo, sys_admin (exactly 4)
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('airfield_status:manage_layout', 'Arrange Status Board Layout', 'airfield_status', 'Reorder the Airfield Status board sections by drag and drop and save the base-wide layout')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin: the all-permissions seed ran once, before this key existed — re-grant explicitly.
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key = 'airfield_status:manage_layout'
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('airfield_manager', 'airfield_status:manage_layout'),
  ('namo', 'airfield_status:manage_layout'),
  ('base_admin', 'airfield_status:manage_layout')
ON CONFLICT (role, permission_key) DO NOTHING;
