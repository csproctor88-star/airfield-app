-- ============================================================
-- Role rulings 2026-07-18: atc loses fpr:view · majcom_rfm view true-up
--
-- Owner rulings (2026-07-18, interactive session):
--   1. "ATC does not need to view the flight planning room" — revoke the
--      fpr:view grant that 2026071720 gave atc per the FPR design spec's
--      access-control table. This migration supersedes that spec row.
--   2. "Civilian does not need the flight planning room" — CONFIRMED as
--      already true, no statement needed: the fpr module is
--      appliesTo: ['usaf'] in lib/modules-config.ts, and no civilian-only
--      role (accountable_executive, sms_manager, aep_coordinator,
--      arff_chief, ops_supervisor) holds any fpr:* key. Recorded here so
--      the ruling is versioned.
--   3. "MAJCOM/RFM should be able to review airfield driving checks" —
--      grant driving_checks:view; owner then extended the fix to the full
--      role contract (see below).
--
-- Root cause of the majcom_rfm gap: 2026042202 seeded the role with a
-- one-time `SELECT … WHERE key LIKE '%:view'` sweep, so every view key
-- created after 2026-04-23 was silently missing from the live DB —
-- amtr:view (2026052000), read_file:view (2026062100), flip:view
-- (2026062304), fpr:view (2026071720), local_regs:view (2026071730),
-- driving_checks:view (2026071750). The role's documented contract
-- (tests/permission-matrix-roles.test.ts: "multi-base read-only — every
-- :view key") never drifted in the static replay because that test
-- resolves SELECT-based grants against the full final catalogue; the live
-- DB is what drifted. Owner ruling 2026-07-18: true up to the FULL
-- contract — all six keys, including fpr:view and amtr:view.
--
-- Deliberate carve-outs that stay carved out (NOT restored here):
--   ces:view      — ces + sys_admin only since 2026061901
--   library:view  — sys_admin only since 2026050100
--
-- Post-apply verification:
--   SELECT permission_key FROM role_permissions WHERE role = 'atc' ORDER BY 1;
--   -- expect: airfield_status:view, flip:view, settings:view, training:view
--   --         (fpr:view GONE)
--   SELECT permission_key FROM role_permissions WHERE role = 'majcom_rfm'
--     AND permission_key IN ('amtr:view','read_file:view','flip:view',
--                            'fpr:view','local_regs:view','driving_checks:view')
--   ORDER BY 1;
--   -- expect: all six rows
--   SELECT role, permission_key FROM role_permissions
--     WHERE permission_key LIKE 'fpr:%' AND role IN ('atc',
--       'accountable_executive','sms_manager','aep_coordinator',
--       'arff_chief','ops_supervisor');
--   -- expect: zero rows
-- ============================================================

DELETE FROM role_permissions WHERE role IN ('atc') AND permission_key = 'fpr:view';

INSERT INTO role_permissions (role, permission_key) VALUES
  ('majcom_rfm', 'driving_checks:view'),
  ('majcom_rfm', 'flip:view'),
  ('majcom_rfm', 'read_file:view'),
  ('majcom_rfm', 'local_regs:view'),
  ('majcom_rfm', 'fpr:view'),
  ('majcom_rfm', 'amtr:view')
ON CONFLICT (role, permission_key) DO NOTHING;
