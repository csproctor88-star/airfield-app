-- ============================================================
-- NAMO/NAMT Report Tool — Migration 1/3: permission key + grants
--
-- Spec: docs/superpowers/specs/2026-07-16-namo-namt-report-tool-design.md
--       (§Data model & migrations, §Access control)
--
-- reports:user_activity — run the per-user activity matrix (users x
-- domains) under Reports & Analytics. Ranks individual airmen's output,
-- so it is restricted to leadership roles, not the general ops/amops
-- population. Mirrored as PERM.REPORTS_USER_ACTIVITY in lib/permissions.ts.
--
-- Civilian-role grants (accountable_executive, ops_supervisor) per spec
-- §Access control — owner reviews before applying.
--
-- STAGED — NOT applied. Staged tonight (2026-07-17) for owner review in
-- the morning alongside 2026071741/2026071742; apply in order with
-- `npx supabase db query --linked --file <path>` once reviewed.
--
-- Post-apply verification:
--   SELECT role FROM role_permissions WHERE permission_key = 'reports:user_activity' ORDER BY role;
--   -- expect: accountable_executive, airfield_manager, base_admin, namo,
--   --         ops_supervisor, sys_admin  (amops NOT present)
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('reports:user_activity', 'NAMO/NAMT Report Tool', 'reports',
   'Run per-user activity counts across modules (users × domains matrix)')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin's all-permissions seed predates this key; grant explicitly.
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', 'reports:user_activity'
ON CONFLICT (role, permission_key) DO NOTHING;

-- Ops/training leadership + admins. amops deliberately excluded: the report
-- ranks individual output and is a leadership tool.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, 'reports:user_activity'
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin'),
             ('accountable_executive'), ('ops_supervisor')) AS r(role)
ON CONFLICT (role, permission_key) DO NOTHING;
