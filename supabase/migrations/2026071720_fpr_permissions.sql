-- ============================================================
-- Flight Planning Room (FPR) Check — Migration 1/2: permission keys + grants
--
-- Spec: docs/superpowers/specs/2026-07-16-flight-planning-room-check-design.md
--       (§Data model & migrations, §Access control)
--
-- fpr:view             — open /fpr, read checks/history/template.
-- fpr:write            — start/complete/edit/delete FPR checks.
-- fpr:manage_checklist — edit the per-base FPR checklist template
--                        (Base Setup wizard tab).
--
-- Mirror these keys in lib/permissions.ts (PERM.FPR_VIEW / FPR_WRITE /
-- FPR_MANAGE_CHECKLIST), next to the SCN block.
--
-- STAGED — NOT applied. Staged 2026-07-17 for owner review in the
-- morning; apply in order with `npx supabase db query --linked --file
-- <path>` — this file first, then 2026071721_fpr_tables.sql.
--
-- Post-apply verification:
--   SELECT key, label, category FROM permissions WHERE key LIKE 'fpr:%' ORDER BY key;
--   SELECT role, permission_key FROM role_permissions WHERE permission_key LIKE 'fpr:%' ORDER BY permission_key, role;
--   -- expect fpr:view             -> airfield_manager, amops, atc, base_admin,
--   --                                 namo, read_only, safety, sys_admin
--   -- expect fpr:write            -> airfield_manager, amops, base_admin, namo, sys_admin
--   -- expect fpr:manage_checklist -> airfield_manager, base_admin, namo, sys_admin
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('fpr:view',             'View Flight Planning Room Checks', 'ops', 'Open /fpr and read check history'),
  ('fpr:write',            'Log FPR Checks',                   'ops', 'Start, complete, edit, and delete FPR checks'),
  ('fpr:manage_checklist', 'Manage FPR Checklist',             'ops', 'Edit the per-base FPR checklist template')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin gets everything (must re-grant explicitly; the all-permissions seed ran once).
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'fpr:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- Admin-tier roles: full grants.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (VALUES ('fpr:view'), ('fpr:write'), ('fpr:manage_checklist')) AS p(key)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Line users conduct checks (mirrors amops scn:view/scn:write).
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'fpr:view'), ('amops', 'fpr:write'),
  ('read_only', 'fpr:view'), ('safety', 'fpr:view'), ('atc', 'fpr:view')
ON CONFLICT (role, permission_key) DO NOTHING;
