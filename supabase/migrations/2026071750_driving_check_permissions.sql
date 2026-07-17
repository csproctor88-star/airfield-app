-- ============================================================
-- Airfield Driving Spot Check ("43 Check", DAFI 13-213) — Migration 1/2:
-- permission keys + role grants.
--
-- Spec: docs/superpowers/specs/2026-07-16-airfield-driving-spot-check-design.md
--       (§Data model & migrations, §Access control)
--
-- driving_checks:view          — open /driving-checks, read check history
--                                 and item list.
-- driving_checks:write         — start/complete/edit/delete driving spot
--                                 checks.
-- driving_checks:manage_items  — edit the per-base spot-check item list
--                                 (Base Setup wizard tab).
--
-- Mirror these keys in lib/permissions.ts (PERM.DRIVING_CHECKS_VIEW /
-- DRIVING_CHECKS_WRITE / DRIVING_CHECKS_MANAGE_ITEMS), next to the SCN/FPR
-- block.
--
-- OWNER NAMING RULING (binding): the user-facing module name is
-- "Airfield Driving Spot Check" — never "43 Check" or "483 Check log" in
-- visible copy. "43 Check" in this file's title comment is the owner's
-- local shorthand kept for provenance only (matches the design spec's
-- title); it never appears in the permission labels below, the
-- lib/modules-config.ts MODULES entry, or sidebar copy.
--
-- No atc/kiosk grant — enforcement records identify individual drivers
-- and don't belong on kiosk displays (design spec §Access control).
--
-- STAGED — NOT applied. Staged 2026-07-17 for owner review in the
-- morning; apply in order with `npx supabase db query --linked --file
-- <path>` — this file first, then 2026071751_driving_check_tables.sql.
--
-- Post-apply verification:
--   SELECT key, label, category FROM permissions WHERE key LIKE 'driving_checks:%' ORDER BY key;
--   SELECT role, permission_key FROM role_permissions WHERE permission_key LIKE 'driving_checks:%' ORDER BY permission_key, role;
--   -- expect driving_checks:view          -> airfield_manager, amops, base_admin,
--   --                                        namo, read_only, safety, sys_admin
--   -- expect driving_checks:write         -> airfield_manager, amops, base_admin, namo, sys_admin
--   -- expect driving_checks:manage_items  -> airfield_manager, base_admin, namo, sys_admin
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('driving_checks:view',         'View Driving Spot Checks',   'driving_checks', 'Open /driving-checks and read the check history and item list'),
  ('driving_checks:write',        'Log Driving Spot Checks',    'driving_checks', 'Start, complete, edit, and delete driving spot checks'),
  ('driving_checks:manage_items', 'Manage Driving Check Items', 'driving_checks', 'Edit the per-base spot-check item list')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin: the all-permissions seed ran once, before these keys existed — re-grant explicitly.
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'driving_checks:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- Admin tier full grants; line users conduct checks (mirrors amops scn:view/write);
-- oversight roles view.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (VALUES ('driving_checks:view'), ('driving_checks:write'), ('driving_checks:manage_items')) AS p(key)
ON CONFLICT (role, permission_key) DO NOTHING;
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'driving_checks:view'), ('amops', 'driving_checks:write'),
  ('read_only', 'driving_checks:view'), ('safety', 'driving_checks:view')
ON CONFLICT (role, permission_key) DO NOTHING;
