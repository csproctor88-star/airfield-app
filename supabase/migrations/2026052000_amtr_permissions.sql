-- ============================================================
-- AMTR — Airfield Management Training Record
-- Migration 1/6: app-permission keys
--
-- These keys gate WHETHER a user can open the AMTR module at all
-- (RLS + sidebar). The fine-grained "who can sign what / record
-- visibility / one-signature-per-record" rules are a SEPARATE
-- per-user AMTR role layer (amtr_role_assignments, migration 2)
-- enforced in the app + SECURITY DEFINER RPCs (migration 5).
--
-- Mirror these keys in lib/permissions.ts (PERM.AMTR_*).
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('amtr:view',    'View Training Records',      'amtr', 'View the AMTR roster and member training records'),
  ('amtr:write',   'Edit Training Records',      'amtr', 'Create and edit training records, enter dates, sign items per AMTR role'),
  ('amtr:delete',  'Delete Training Records',    'amtr', 'Permanently delete members and record rows'),
  ('amtr:manage',  'Manage AMTR Catalogs/Roles', 'amtr', 'Assign AMTR roles and edit base-shared catalogs (JQS, 1098, formal, milestones, RAT)'),
  ('amtr:export',  'Export Training Data',       'amtr', 'Export AMTR roster, member print, and unit reports as PDF/CSV/JSON')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- ── Grant to roles that own training-record management ──
-- sys_admin already gets everything via the SELECT-all seed in
-- 2026042200, but that seed ran before these keys existed, so grant
-- explicitly here (idempotent via ON CONFLICT).
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'amtr:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- airfield_manager / namo / base_admin — full control at base
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (SELECT key FROM permissions WHERE key LIKE 'amtr:%') AS p
ON CONFLICT (role, permission_key) DO NOTHING;

-- amops — view/write/export, no delete/manage (parallels their access elsewhere)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'amtr:view'),
  ('amops', 'amtr:write'),
  ('amops', 'amtr:export')
ON CONFLICT (role, permission_key) DO NOTHING;

-- read-only family — view only
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, 'amtr:view'
FROM (VALUES ('read_only'), ('safety'), ('atc')) AS r(role)
ON CONFLICT (role, permission_key) DO NOTHING;
