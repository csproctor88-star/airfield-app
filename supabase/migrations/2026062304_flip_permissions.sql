-- 2026062304_flip_permissions.sql
-- FLIP Management module permission keys + role grants.
-- Layer A of the FLIP authorization model (module/admin/export access).
-- Per-record action authority lives in flip_role_assignments (Layer B).

INSERT INTO permissions (key, label, category, description) VALUES
  ('flip:view',   'View FLIP Management', 'flip', 'View FLIP Continuity Binder, changes, and reviews'),
  ('flip:write',  'Edit FLIP Records',    'flip', 'Edit text sections, FLIP list, references, changes, and reviews'),
  ('flip:manage', 'Manage FLIP Roles',    'flip', 'Assign FLIP roles (custodian, alternate, NAMO, AFM)'),
  ('flip:export', 'Export FLIP Data',     'flip', 'Generate FLIP review and continuity PDFs')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'flip:%'
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin'),
             ('accountable_executive'), ('ops_supervisor')) AS r(role)
CROSS JOIN (SELECT key FROM permissions WHERE key LIKE 'flip:%') AS p
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'flip:view'),
  ('amops', 'flip:write'),
  ('amops', 'flip:export')
ON CONFLICT (role, permission_key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key)
SELECT r.role, 'flip:view'
FROM (VALUES ('read_only'), ('safety'), ('atc')) AS r(role)
ON CONFLICT (role, permission_key) DO NOTHING;
