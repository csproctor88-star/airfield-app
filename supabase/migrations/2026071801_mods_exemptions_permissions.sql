-- ============================================================
-- Modifications & Exemptions — Migration 1/4: permission keys + grants
--
-- Spec: docs/superpowers/specs/2026-07-18-modifications-exemptions-design.md
--       (§Access control) — APPROVED 2026-07-18, owner ruled "all
--       recommended" (permission matrix as proposed).
--
-- mods_exemptions:view  — open /modifications-exemptions, read records,
--                         reviews, and attachments.
-- mods_exemptions:write — create/edit/delete records, log annual reviews,
--                         upload/remove attachments.
--
-- Civilian-only module (Part 139 MOS + exemption tracker), so both keys
-- carry applies_to = '{faa_part139}' (the 2026052503 scoping column).
--
-- Mirror these keys in lib/permissions.ts (PERM.MODS_EXEMPTIONS_VIEW /
-- MODS_EXEMPTIONS_WRITE), next to the LOCAL_REGS block.
--
-- majcom_rfm gets :view HERE, in the same migration that creates the key —
-- the 2026-07-18 drift lesson (2026042202's one-time LIKE sweep left the
-- role missing every view key created after April; 2026071800 trued it up).
-- Same for read_only (every-:view-except-amtr contract).
--
-- Post-apply verification:
--   SELECT key, label, category, applies_to FROM permissions WHERE key LIKE 'mods_exemptions:%' ORDER BY key;
--   SELECT role, permission_key FROM role_permissions WHERE permission_key LIKE 'mods_exemptions:%' ORDER BY permission_key, role;
--   -- expect mods_exemptions:view  -> accountable_executive, aep_coordinator,
--   --        airfield_manager, amops, arff_chief, base_admin, majcom_rfm,
--   --        namo, ops_supervisor, read_only, safety, sms_manager, sys_admin
--   -- expect mods_exemptions:write -> airfield_manager, base_admin, namo,
--   --        ops_supervisor, sys_admin
-- ============================================================

INSERT INTO permissions (key, label, category, description, applies_to) VALUES
  ('mods_exemptions:view',  'View Modifications & Exemptions',   'mods_exemptions', 'Open /modifications-exemptions and read MOS, exemption, and deviation records', '{faa_part139}'),
  ('mods_exemptions:write', 'Manage Modifications & Exemptions', 'mods_exemptions', 'Create, edit, and delete records, log annual reviews, and manage attachments', '{faa_part139}')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description, applies_to = EXCLUDED.applies_to;

-- sys_admin: the all-permissions seed ran once, before these keys existed — re-grant explicitly.
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'mods_exemptions:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- Admin tier: full grants.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (VALUES ('mods_exemptions:view'), ('mods_exemptions:write')) AS p(key)
ON CONFLICT (role, permission_key) DO NOTHING;

-- ops_supervisor writes (civilian ops lead — same tier as its sms:write /
-- airfield_status:write). Everyone else in the read surface views:
-- accountable_executive signs the ACM these records feed; sms_manager and
-- arff_chief have SRM / ARFF-exemption interest; aep_coordinator matches
-- its qrc/wildlife view tier; amops/safety/read_only are the general read
-- surface; majcom_rfm + read_only per their every-view contracts.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('ops_supervisor', 'mods_exemptions:view'), ('ops_supervisor', 'mods_exemptions:write'),
  ('accountable_executive', 'mods_exemptions:view'),
  ('sms_manager', 'mods_exemptions:view'),
  ('arff_chief', 'mods_exemptions:view'),
  ('aep_coordinator', 'mods_exemptions:view'),
  ('amops', 'mods_exemptions:view'),
  ('safety', 'mods_exemptions:view'),
  ('read_only', 'mods_exemptions:view'),
  ('majcom_rfm', 'mods_exemptions:view')
ON CONFLICT (role, permission_key) DO NOTHING;
