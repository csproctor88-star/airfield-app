-- Records Export permission keys.
-- exports:read  → see and configure the /settings/exports page
-- exports:write → generate/download an export (records leave the app as files)
-- Granted to sys_admin + the AFM-tier roles (airfield_manager, namo, base_admin).
-- Uses the permission matrix (permissions + role_permissions). No dropped helpers.

INSERT INTO permissions (key, label, category, description) VALUES
  ('exports:read',  'View Records Export',     'exports', 'Open and configure the Records Export page'),
  ('exports:write', 'Generate Records Export', 'exports', 'Generate and download a records export (PDF/Excel/photos/viewer)')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- sys_admin gets everything (explicit for idempotence)
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'exports:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- AFM-tier — full export access at base
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (SELECT key FROM permissions WHERE key LIKE 'exports:%') AS p
ON CONFLICT (role, permission_key) DO NOTHING;
