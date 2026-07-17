-- ============================================================
-- Local Regulations (Base Regs) — Migration 1/4: app-permission keys
--
-- Spec: docs/superpowers/specs/2026-07-16-local-regulations-review-design.md
--       (§Access control, §Data model & migrations)
--
-- local_regs:view   — open the Base Regs tab, read local regulations, open
--                      PDFs, and record recurring reviews. Held by the
--                      same required-reviewer roster as Read File
--                      (READ_FILE_READER_ROLES / LOCAL_REGS_REVIEWER_ROLES
--                      in lib/, kept deliberately identical).
-- local_regs:manage — upload, replace, archive local regulations, set
--                      review intervals, and run the compliance report.
--
-- Mirror these keys in lib/permissions.ts (PERM.LOCAL_REGS_VIEW /
-- PERM.LOCAL_REGS_MANAGE) under a "// Local Regulations (Base Regs)"
-- comment. tests/permission-keys-drift.test.ts fails if unmirrored.
--
-- OPEN QUESTION — NOT resolved here (spec §Assumptions & open questions,
-- "Roster breadth"): whether civilian Part 139 roles (sms_manager,
-- accountable_executive, …) need local_regs grants on civilian bases.
-- This migration grants ONLY the USAF-parity roster below (identical to
-- read_file's grant set in 2026062100_read_file_permissions.sql).
-- Civilian-role roster broadening is deliberately NOT added here — it's
-- an owner call at apply time, not a speculative addition.
--
-- STAGED — NOT applied. Staged 2026-07-17 for owner review; apply in
-- order with `npx supabase db query --linked --file <path>` — this file
-- first, then 2026071731 (tables), 2026071732 (storage), 2026071733
-- (enable-module backfill) in sequence.
--
-- Post-apply verification:
--   SELECT key, label, category FROM permissions WHERE key LIKE 'local_regs:%' ORDER BY key;
--   SELECT role, permission_key FROM role_permissions WHERE permission_key LIKE 'local_regs:%' ORDER BY permission_key, role;
--   -- expect local_regs:view   -> airfield_manager, amops, base_admin, namo, sys_admin
--   -- expect local_regs:manage -> airfield_manager, base_admin, namo, sys_admin
-- ============================================================

INSERT INTO permissions (key, label, category, description) VALUES
  ('local_regs:view',   'View / Review Base Regs', 'local_regs', 'Open the Base Regs tab, read local regulations, and record recurring reviews'),
  ('local_regs:manage', 'Manage Base Regs',        'local_regs', 'Upload, replace, archive local regulations, set review intervals, and run the compliance report')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin's all-permissions seed predates these keys; grant explicitly.
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'local_regs:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- airfield_manager / namo / base_admin — full control at base.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (SELECT key FROM permissions WHERE key LIKE 'local_regs:%') AS p
ON CONFLICT (role, permission_key) DO NOTHING;

-- amops — view + review only (parallels their Read File access; no manage).
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'local_regs:view')
ON CONFLICT (role, permission_key) DO NOTHING;
