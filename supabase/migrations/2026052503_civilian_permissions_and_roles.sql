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
--
-- NB: grants use explicit INSERT VALUES per (role, key) rather than
-- CROSS JOIN, so the static SQL parser in the test suite can replay
-- them.
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

-- ── 4. Civilian role presets ──────────────────────────────
--
-- Five new civilian roles with explicit grants. Modeled on existing
-- USAF roles where there's a clean analog (sms_manager ≈ namo,
-- ops_supervisor ≈ namo, accountable_executive ≈ base_admin), with
-- mode-specific additions for SMS/AEP/Training.

-- accountable_executive: signing authority + broad read access
INSERT INTO role_permissions (role, permission_key) VALUES
  ('accountable_executive', 'sms:read'),
  ('accountable_executive', 'sms:sign_policy'),
  ('accountable_executive', 'sms:approve_moc'),
  ('accountable_executive', 'aep:read'),
  ('accountable_executive', 'aep:sign'),
  ('accountable_executive', 'training_part139:read'),
  ('accountable_executive', 'training_part139:export'),
  ('accountable_executive', 'airfield_status:view'),
  ('accountable_executive', 'dashboard:view'),
  ('accountable_executive', 'checks:view'),
  ('accountable_executive', 'inspections:view'),
  ('accountable_executive', 'discrepancies:view'),
  ('accountable_executive', 'ces:view'),
  ('accountable_executive', 'infrastructure:view'),
  ('accountable_executive', 'parking:view'),
  ('accountable_executive', 'obstructions:view'),
  ('accountable_executive', 'qrc:view'),
  ('accountable_executive', 'shift_checklist:view'),
  ('accountable_executive', 'wildlife:view'),
  ('accountable_executive', 'waivers:view'),
  ('accountable_executive', 'notams:view'),
  ('accountable_executive', 'ppr:view'),
  ('accountable_executive', 'contractors:view'),
  ('accountable_executive', 'daily_reviews:view'),
  ('accountable_executive', 'reports:view'),
  ('accountable_executive', 'reports:export'),
  ('accountable_executive', 'activity_log:view'),
  ('accountable_executive', 'feedback:view'),
  ('accountable_executive', 'training:view'),
  ('accountable_executive', 'library:view'),
  ('accountable_executive', 'settings:view'),
  ('accountable_executive', 'photos:write')
ON CONFLICT (role, permission_key) DO NOTHING;

-- sms_manager: full SMS, plus broad read for hazard investigation
INSERT INTO role_permissions (role, permission_key) VALUES
  ('sms_manager', 'sms:read'),
  ('sms_manager', 'sms:write'),
  ('sms_manager', 'sms:triage_reports'),
  ('sms_manager', 'aep:read'),
  ('sms_manager', 'training_part139:read'),
  ('sms_manager', 'airfield_status:view'),
  ('sms_manager', 'dashboard:view'),
  ('sms_manager', 'checks:view'),
  ('sms_manager', 'inspections:view'),
  ('sms_manager', 'discrepancies:view'),
  ('sms_manager', 'discrepancies:write'),
  ('sms_manager', 'infrastructure:view'),
  ('sms_manager', 'parking:view'),
  ('sms_manager', 'obstructions:view'),
  ('sms_manager', 'qrc:view'),
  ('sms_manager', 'shift_checklist:view'),
  ('sms_manager', 'wildlife:view'),
  ('sms_manager', 'wildlife:write'),
  ('sms_manager', 'waivers:view'),
  ('sms_manager', 'notams:view'),
  ('sms_manager', 'ppr:view'),
  ('sms_manager', 'contractors:view'),
  ('sms_manager', 'daily_reviews:view'),
  ('sms_manager', 'reports:view'),
  ('sms_manager', 'reports:export'),
  ('sms_manager', 'activity_log:view'),
  ('sms_manager', 'feedback:view'),
  ('sms_manager', 'training:view'),
  ('sms_manager', 'library:view'),
  ('sms_manager', 'settings:view'),
  ('sms_manager', 'photos:write')
ON CONFLICT (role, permission_key) DO NOTHING;

-- aep_coordinator: full AEP + read SMS, drills + comms
INSERT INTO role_permissions (role, permission_key) VALUES
  ('aep_coordinator', 'aep:read'),
  ('aep_coordinator', 'aep:write'),
  ('aep_coordinator', 'sms:read'),
  ('aep_coordinator', 'airfield_status:view'),
  ('aep_coordinator', 'dashboard:view'),
  ('aep_coordinator', 'qrc:view'),
  ('aep_coordinator', 'qrc:execute'),
  ('aep_coordinator', 'wildlife:view'),
  ('aep_coordinator', 'contractors:view'),
  ('aep_coordinator', 'notams:view'),
  ('aep_coordinator', 'activity_log:view'),
  ('aep_coordinator', 'training:view'),
  ('aep_coordinator', 'settings:view'),
  ('aep_coordinator', 'photos:write')
ON CONFLICT (role, permission_key) DO NOTHING;

-- arff_chief: ARFF-relevant views + AEP read + drills (aep:write)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('arff_chief', 'aep:read'),
  ('arff_chief', 'aep:write'),
  ('arff_chief', 'sms:read'),
  ('arff_chief', 'airfield_status:view'),
  ('arff_chief', 'dashboard:view'),
  ('arff_chief', 'wildlife:view'),
  ('arff_chief', 'contractors:view'),
  ('arff_chief', 'notams:view'),
  ('arff_chief', 'qrc:view'),
  ('arff_chief', 'qrc:execute'),
  ('arff_chief', 'training:view'),
  ('arff_chief', 'settings:view')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ops_supervisor: NAMO-equivalent — broad ops write + supervisor sign
INSERT INTO role_permissions (role, permission_key) VALUES
  ('ops_supervisor', 'sms:read'),
  ('ops_supervisor', 'sms:write'),
  ('ops_supervisor', 'aep:read'),
  ('ops_supervisor', 'training_part139:read'),
  ('ops_supervisor', 'training_part139:write'),
  ('ops_supervisor', 'daily_reviews:view'),
  ('ops_supervisor', 'daily_reviews:sign:supervisor'),
  ('ops_supervisor', 'airfield_status:view'),
  ('ops_supervisor', 'airfield_status:write'),
  ('ops_supervisor', 'dashboard:view'),
  ('ops_supervisor', 'checks:view'),
  ('ops_supervisor', 'checks:write'),
  ('ops_supervisor', 'inspections:view'),
  ('ops_supervisor', 'inspections:write'),
  ('ops_supervisor', 'discrepancies:view'),
  ('ops_supervisor', 'discrepancies:write'),
  ('ops_supervisor', 'discrepancies:add_note'),
  ('ops_supervisor', 'ces:view'),
  ('ops_supervisor', 'infrastructure:view'),
  ('ops_supervisor', 'infrastructure:write'),
  ('ops_supervisor', 'parking:view'),
  ('ops_supervisor', 'parking:write'),
  ('ops_supervisor', 'obstructions:view'),
  ('ops_supervisor', 'obstructions:write'),
  ('ops_supervisor', 'qrc:view'),
  ('ops_supervisor', 'qrc:execute'),
  ('ops_supervisor', 'shift_checklist:view'),
  ('ops_supervisor', 'shift_checklist:write'),
  ('ops_supervisor', 'wildlife:view'),
  ('ops_supervisor', 'wildlife:write'),
  ('ops_supervisor', 'waivers:view'),
  ('ops_supervisor', 'waivers:write'),
  ('ops_supervisor', 'notams:view'),
  ('ops_supervisor', 'notams:write'),
  ('ops_supervisor', 'ppr:view'),
  ('ops_supervisor', 'ppr:write'),
  ('ops_supervisor', 'contractors:view'),
  ('ops_supervisor', 'contractors:write'),
  ('ops_supervisor', 'reports:view'),
  ('ops_supervisor', 'reports:export'),
  ('ops_supervisor', 'activity_log:view'),
  ('ops_supervisor', 'activity_log:write_manual'),
  ('ops_supervisor', 'feedback:view'),
  ('ops_supervisor', 'training:view'),
  ('ops_supervisor', 'library:view'),
  ('ops_supervisor', 'settings:view'),
  ('ops_supervisor', 'photos:write')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ── 5. Sys_admin / airfield_manager / base_admin grants ──────
--
-- Grant the new perm keys to roles that should already have parity
-- coverage. sys_admin gets everything (mirrors the AMTR pattern).

INSERT INTO role_permissions (role, permission_key) VALUES
  ('sys_admin', 'sms:read'),
  ('sys_admin', 'sms:write'),
  ('sys_admin', 'sms:sign_policy'),
  ('sys_admin', 'sms:approve_moc'),
  ('sys_admin', 'sms:triage_reports'),
  ('sys_admin', 'aep:read'),
  ('sys_admin', 'aep:write'),
  ('sys_admin', 'aep:sign'),
  ('sys_admin', 'training_part139:read'),
  ('sys_admin', 'training_part139:write'),
  ('sys_admin', 'training_part139:export'),
  ('sys_admin', 'daily_reviews:sign:supervisor'),
  ('sys_admin', 'daily_reviews:sign:manager')
ON CONFLICT (role, permission_key) DO NOTHING;

-- airfield_manager is Airport Operations Manager in civilian mode
INSERT INTO role_permissions (role, permission_key) VALUES
  ('airfield_manager', 'sms:read'),
  ('airfield_manager', 'sms:write'),
  ('airfield_manager', 'aep:read'),
  ('airfield_manager', 'aep:write'),
  ('airfield_manager', 'training_part139:read'),
  ('airfield_manager', 'training_part139:write'),
  ('airfield_manager', 'training_part139:export'),
  ('airfield_manager', 'daily_reviews:sign:manager')
ON CONFLICT (role, permission_key) DO NOTHING;

-- base_admin is Airport Admin in civilian mode; gets every civilian
-- write key EXCEPT the AE-reserved signing keys.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('base_admin', 'sms:read'),
  ('base_admin', 'sms:write'),
  ('base_admin', 'sms:triage_reports'),
  ('base_admin', 'aep:read'),
  ('base_admin', 'aep:write'),
  ('base_admin', 'training_part139:read'),
  ('base_admin', 'training_part139:write'),
  ('base_admin', 'training_part139:export'),
  ('base_admin', 'daily_reviews:sign:supervisor'),
  ('base_admin', 'daily_reviews:sign:manager')
ON CONFLICT (role, permission_key) DO NOTHING;
