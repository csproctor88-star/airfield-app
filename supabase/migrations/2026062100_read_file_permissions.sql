-- ============================================================
-- Read File — Migration 1/4: app-permission keys
--
-- read_file:view   — open the module, view files, acknowledge (read & sign).
--                    Granted to the operational roles only (the required
--                    readers). Read-only / ATC / safety are intentionally
--                    excluded — they have no read-file obligation.
-- read_file:manage — add / replace / archive files + run the report.
--
-- Mirror these keys in lib/permissions.ts (PERM.READ_FILE_*).
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('read_file:view',   'View / Sign Read File',   'read_file', 'Open the Read File module, view files, and acknowledge (read & initial) them'),
  ('read_file:manage', 'Manage Read File',        'read_file', 'Add, replace, and archive read files and run the review report')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- sys_admin already has an all-permissions seed, but it ran before these
-- keys existed; grant explicitly (idempotent).
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'read_file:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- airfield_manager / namo / base_admin — full control at base.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (SELECT key FROM permissions WHERE key LIKE 'read_file:%') AS p
ON CONFLICT (role, permission_key) DO NOTHING;

-- amops — view + sign only (parallels their AMTR access; no manage).
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'read_file:view')
ON CONFLICT (role, permission_key) DO NOTHING;
