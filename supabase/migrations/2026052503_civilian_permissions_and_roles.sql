-- ============================================================
-- Phase 1.4 — Civilian permissions & roles
--
-- Adds a per-permission `applies_to` scope (`{usaf}`, `{faa_part139}`,
-- or both) so a single matrix serves both modes without forking. The
-- frontend resolves visibility by intersecting a user's permission
-- set with the base's `airport_type`.
--
-- New permission keys for SMS, AEP, and §139.303 Training are added
-- here so Phase 2/3 modules can wire them without further migrations.
-- New civilian role presets (sms_manager, aep_coordinator, etc.) get
-- their grants here.
-- ============================================================

-- ── 1. permissions.applies_to ──────────────────────────────

ALTER TABLE permissions
  ADD COLUMN IF NOT EXISTS applies_to TEXT[] NOT NULL DEFAULT '{usaf,faa_part139}';

COMMENT ON COLUMN permissions.applies_to IS
  'Which airport_type modes this permission is meaningful in. Frontend uses this to filter the role-editor matrix; RLS uses it indirectly through user_has_permission gated on base.airport_type.';

-- ── 2. Mark USAF-only permission keys ──────────────────────

UPDATE permissions
SET applies_to = '{usaf}'
WHERE key LIKE 'amtr:%'
   OR key LIKE 'acsi:%'
   OR key LIKE 'scn:%'
   OR key IN (
     'daily_reviews:sign:amsl',
     'daily_reviews:sign:namo',
     'daily_reviews:sign:afm'
   );

-- ── 3. Add civilian-only permission keys ──────────────────

INSERT INTO permissions (key, label, category, description, applies_to) VALUES
  -- SMS module (Phase 2)
  ('sms:read',               'View SMS Module',                'sms', 'See safety policy, hazard register, SPIs, audits, MOC', '{faa_part139}'),
  ('sms:write',              'Write SMS Data',                 'sms', 'File hazards, run risk assessments, log mitigations, schedule audits', '{faa_part139}'),
  ('sms:sign_policy',        'Sign Safety Policy',             'sms', 'Accountable Executive sign-off on safety policy and objectives', '{faa_part139}'),
  ('sms:approve_moc',        'Approve Management of Change',   'sms', 'Approve MOC submissions before implementation', '{faa_part139}'),
  ('sms:triage_reports',     'Triage Public Safety Reports',   'sms', 'Review and act on anonymous safety reports submitted via the public form', '{faa_part139}'),
  -- AEP module (Phase 3)
  ('aep:read',               'View Airport Emergency Plan',    'aep', 'See AEP plan, agencies, drills, comms checks', '{faa_part139}'),
  ('aep:write',              'Write AEP Data',                 'aep', 'Edit plan, agencies, schedule drills, log comms checks', '{faa_part139}'),
  ('aep:sign',               'Sign AEP Annual Review',         'aep', 'Accountable Executive sign-off on annual AEP review', '{faa_part139}'),
  -- §139.303 Training (Phase 3 — also usable in USAF mode for non-1C7X1 staff)
  ('training_part139:read',  'View §139.303 Training Records', 'training', NULL, '{usaf,faa_part139}'),
  ('training_part139:write', 'Write §139.303 Training Records','training', 'Log training completion, manage topics, set renewals', '{usaf,faa_part139}'),
  ('training_part139:export','Export Training Records',        'training', 'PDF + CSV exports for FAA inspector review', '{usaf,faa_part139}'),
  -- Civilian daily-ops sign-offs (parallel to USAF AMSL/NAMO/AFM)
  ('daily_reviews:sign:supervisor', 'Sign Supervisor Slot (Daily Ops)', 'daily_reviews', 'Civilian-mode duty supervisor sign-off', '{faa_part139}'),
  ('daily_reviews:sign:manager',    'Sign Manager Slot (Daily Ops)',    'daily_reviews', 'Civilian-mode operations manager sign-off', '{faa_part139}')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = COALESCE(EXCLUDED.description, permissions.description),
  applies_to = EXCLUDED.applies_to;

-- ── 4. Seed role_permissions for new civilian roles ────────
--
-- The role names are TEXT (no enum), so adding new ones is purely
-- additive. lib/constants.ts USER_ROLES will be updated in code in
-- a parallel commit to surface them in the UI.

INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key FROM permissions p
CROSS JOIN (VALUES ('sms_manager'), ('aep_coordinator'), ('ops_supervisor'), ('arff_chief'), ('accountable_executive')) AS r(role)
WHERE p.applies_to && '{faa_part139}'::text[]
  AND (
    -- Accountable Executive: broad read + signing authority
    (r.role = 'accountable_executive' AND (p.key LIKE '%:read%' OR p.key LIKE '%:view%' OR p.key IN ('sms:sign_policy','sms:approve_moc','aep:sign')))
    -- SMS Manager: full SMS + read everything else
    OR (r.role = 'sms_manager' AND (p.key LIKE 'sms:%' OR p.key LIKE '%:view%' OR p.key LIKE '%:read%'))
    -- AEP Coordinator: full AEP + read SMS + drills/comms
    OR (r.role = 'aep_coordinator' AND (p.key LIKE 'aep:%' OR p.key = 'sms:read' OR p.key LIKE '%:view%'))
    -- ARFF Chief: AEP read + drills, ARFF-relevant views
    OR (r.role = 'arff_chief' AND (p.key IN ('aep:read','aep:write') OR p.key IN ('airfield_status:view','notams:view','wildlife:view','contractors:view','sms:read')))
    -- Ops Supervisor: NAMO-equivalent — broad ops write, signs supervisor slot
    OR (r.role = 'ops_supervisor' AND (p.key LIKE '%:view%' OR p.key LIKE '%:write%' OR p.key = 'daily_reviews:sign:supervisor'))
  )
ON CONFLICT (role, permission_key) DO NOTHING;

-- sys_admin gets every civilian perm too (idempotent)
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE applies_to && '{faa_part139}'::text[]
ON CONFLICT (role, permission_key) DO NOTHING;

-- airfield_manager gets the dual-applicable training perms + civilian sign-offs
-- (they're the Airport Operations Manager in civilian mode and the AFM in USAF mode)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('airfield_manager', 'training_part139:read'),
  ('airfield_manager', 'training_part139:write'),
  ('airfield_manager', 'training_part139:export'),
  ('airfield_manager', 'daily_reviews:sign:manager'),
  ('airfield_manager', 'sms:read'),
  ('airfield_manager', 'sms:write'),
  ('airfield_manager', 'aep:read'),
  ('airfield_manager', 'aep:write')
ON CONFLICT (role, permission_key) DO NOTHING;

-- base_admin gets civilian admin perms (parallels their USAF privileges)
INSERT INTO role_permissions (role, permission_key)
SELECT 'base_admin', key FROM permissions
WHERE applies_to && '{faa_part139}'::text[]
  AND key NOT IN ('sms:sign_policy','aep:sign')  -- AE signing is reserved
ON CONFLICT (role, permission_key) DO NOTHING;
