-- ============================================================
-- Phase A — Permission Matrix Scaffold
--
-- Decouples feature gates from role strings by introducing a
-- canonical permission catalogue and a role→permission preset map.
-- This migration ONLY adds tables/functions + seeds today's
-- effective behavior. No existing policies are rewritten here, so
-- nothing about user-visible access changes until later phases
-- wire the app and RLS to `user_has_permission()`.
--
-- Entities:
--   • permissions                — canonical reference of keys
--   • role_permissions           — role preset → {permission_keys}
--   • user_permission_overrides  — optional per-user grants/revokes
--   • user_has_permission(uid,k) — SECURITY DEFINER helper
-- ============================================================

-- ── Catalogue of canonical permission keys ─────────────────
CREATE TABLE IF NOT EXISTS permissions (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT
);

INSERT INTO permissions (key, label, category, description) VALUES
  -- Airfield status (view + writes)
  ('airfield_status:view',               'View Airfield Status',                'airfield_status', 'See the live airfield status board'),
  ('airfield_status:write',               'Update Airfield Status',              'airfield_status', 'Change runway status, BWC, RSC, advisories, ARFF category'),
  ('airfield_status:write:rsc_bwc_only',  'Update RSC and BWC only',             'airfield_status', 'Narrow write — only Runway Surface Condition and Bird Watch Condition'),
  -- Ops modules — view/write/delete
  ('checks:view',                        'View Airfield Checks',                'ops', NULL),
  ('checks:write',                       'Write Airfield Checks',               'ops', NULL),
  ('checks:delete',                      'Delete Airfield Checks',              'ops', NULL),
  ('inspections:view',                   'View Inspections',                    'ops', NULL),
  ('inspections:write',                  'Write Inspections',                   'ops', NULL),
  ('inspections:delete',                 'Delete Inspections',                  'ops', NULL),
  ('inspections:file',                   'File Inspections',                    'ops', NULL),
  ('acsi:view',                          'View ACSI Inspections',               'ops', NULL),
  ('acsi:write',                         'Write ACSI Inspections',              'ops', NULL),
  ('acsi:delete',                        'Delete ACSI Inspections',             'ops', NULL),
  ('acsi:file',                          'File ACSI Inspections',               'ops', NULL),
  ('discrepancies:view',                 'View Discrepancies',                  'ops', NULL),
  ('discrepancies:write',                'Write Discrepancies',                 'ops', 'Full write — create, edit any field, reassign'),
  ('discrepancies:delete',               'Delete Discrepancies',                'ops', NULL),
  ('discrepancies:close',                'Close Discrepancies (status=completed)', 'ops', 'Final AFM verification step'),
  ('discrepancies:cancel',               'Cancel Discrepancies',                'ops', NULL),
  ('discrepancies:transition:ces_statuses', 'Transition CES statuses',          'ops', 'Set current_status to CES-allowed values (submitted_to_ces, awaiting_action_by_ces, waiting_for_project, work_completed_awaiting_verification)'),
  ('discrepancies:update:resolution_notes', 'Update Resolution Notes',          'ops', NULL),
  ('discrepancies:add_note',             'Add Notes to a Discrepancy',          'ops', NULL),
  ('ces:view',                           'View CES Dashboard',                  'ops', NULL),
  ('infrastructure:view',                'View Visual NAVAIDs',                 'ops', NULL),
  ('infrastructure:write',               'Write Visual NAVAIDs',                'ops', NULL),
  ('infrastructure:delete',              'Delete Visual NAVAIDs',               'ops', NULL),
  ('parking:view',                       'View Parking',                        'ops', NULL),
  ('parking:write',                      'Write Parking Plans',                 'ops', NULL),
  ('parking:delete',                     'Delete Parking Plans',                'ops', NULL),
  ('obstructions:view',                  'View Obstructions',                   'ops', NULL),
  ('obstructions:write',                 'Write Obstructions',                  'ops', NULL),
  ('obstructions:delete',                'Delete Obstructions',                 'ops', NULL),
  ('qrc:view',                           'View QRC',                            'ops', NULL),
  ('qrc:write',                          'Manage QRC Templates',                'ops', NULL),
  ('qrc:execute',                        'Execute a QRC',                       'ops', NULL),
  ('shift_checklist:view',               'View Shift Checklist',                'ops', NULL),
  ('shift_checklist:write',              'Write Shift Checklist',               'ops', NULL),
  ('scn:view',                           'View Secondary Crash Net',            'ops', NULL),
  ('scn:write',                          'Log SCN Checks',                      'ops', NULL),
  ('scn:manage_agencies',                'Manage SCN Agencies',                 'ops', NULL),
  ('wildlife:view',                      'View Wildlife / BASH',                'ops', NULL),
  ('wildlife:write',                     'Write Wildlife Sightings / Strikes',  'ops', NULL),
  ('wildlife:delete',                    'Delete Wildlife Records',             'ops', NULL),
  ('waivers:view',                       'View Waivers',                        'ops', NULL),
  ('waivers:write',                      'Write Waivers',                       'ops', NULL),
  ('waivers:delete',                     'Delete Waivers',                      'ops', NULL),
  ('waivers:review',                     'Sign Waiver Annual Reviews',          'ops', NULL),
  ('notams:view',                        'View NOTAMs',                         'ops', NULL),
  ('notams:write',                       'Write Local NOTAMs',                  'ops', NULL),
  ('notams:cancel',                      'Cancel NOTAMs',                       'ops', NULL),
  ('ppr:view',                           'View PPR Log',                        'ops', NULL),
  ('ppr:write',                          'Write PPR Entries',                   'ops', NULL),
  ('ppr:delete',                         'Delete PPR Entries',                  'ops', NULL),
  ('contractors:view',                   'View Contractors / Personnel',        'ops', NULL),
  ('contractors:write',                  'Write Contractors / Personnel',       'ops', NULL),
  ('contractors:delete',                 'Delete Contractors / Personnel',      'ops', NULL),
  -- Daily Reviews
  ('daily_reviews:view',                 'View Daily Reviews',                  'daily_reviews', NULL),
  ('daily_reviews:sign:amsl',            'Sign AMSL Shift Slot',                'daily_reviews', 'day_amsl, swing_amsl, mid_amsl'),
  ('daily_reviews:sign:namo',            'Sign NAMO Slot',                      'daily_reviews', NULL),
  ('daily_reviews:sign:afm',             'Sign AFM Slot',                       'daily_reviews', NULL),
  -- Reporting & logs
  ('reports:view',                       'View Reports & Analytics',            'reporting', NULL),
  ('reports:export',                     'Export Reports (PDF / Excel)',        'reporting', NULL),
  ('activity_log:view',                  'View Events Log',                     'reporting', NULL),
  ('activity_log:write_manual',          'Write Manual Events Log entries',     'reporting', NULL),
  ('activity_log:delete',                'Delete Events Log entries',           'reporting', NULL),
  ('recent_activity:view',               'View Activity (admin audit log)',     'reporting', NULL),
  -- Customer Feedback
  ('feedback:view',                      'View Customer Feedback submissions',  'admin', NULL),
  ('feedback:configure',                 'Configure the Feedback Form',         'admin', NULL),
  ('feedback:delete',                    'Delete Feedback submissions',         'admin', NULL),
  -- Training / library / reference
  ('training:view',                      'View Training Page',                  'reference', NULL),
  ('library:view',                       'View PDF Library',                    'reference', NULL),
  ('library:manage',                     'Manage PDF Library',                  'reference', NULL),
  ('regulations:view',                   'View Reference Library (regulations)', 'reference', NULL),
  ('aircraft:view',                      'View Aircraft Database',              'reference', NULL),
  -- Admin
  ('users:view',                         'View User Management',                'admin', NULL),
  ('users:manage',                       'Manage Users (invite / role / delete)', 'admin', NULL),
  ('base_setup:view',                    'View Base Setup Wizard',              'admin', NULL),
  ('base_setup:write',                   'Edit Base Setup',                     'admin', NULL),
  ('settings:view',                      'View Settings page',                  'admin', NULL),
  ('installations:switch',               'Switch between assigned installations', 'admin', 'For users with base memberships at multiple bases')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- ── Role → permission preset ───────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role           TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Clear + re-seed so this migration is idempotent across role set changes.
-- (Safe because role_permissions is derived from the catalogue, not user data.)
DELETE FROM role_permissions;

-- Helper to seed many keys for one role
-- (plain INSERTs below — kept flat so the seed is grep-able)

-- ── sys_admin — everything ─────────────────────────────────
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions;

-- ── airfield_manager — full control at base (today's AFM) ──
INSERT INTO role_permissions (role, permission_key)
SELECT 'airfield_manager', key FROM permissions
WHERE key NOT IN (
  -- sys_admin-only concepts we want to keep reserved
  -- (nothing right now — AFM has full control at base, matches today)
  ''
);

-- ── namo — today's NAMO is parallel to AFM ─────────────────
INSERT INTO role_permissions (role, permission_key)
SELECT 'namo', key FROM permissions
WHERE key NOT IN ('');

-- ── base_admin — base-scoped admin ─────────────────────────
INSERT INTO role_permissions (role, permission_key)
SELECT 'base_admin', key FROM permissions
WHERE key NOT IN ('');

-- ── amops — write on all modules, no admin (matches today) ─
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'airfield_status:view'),
  ('amops', 'airfield_status:write'),
  ('amops', 'checks:view'),
  ('amops', 'checks:write'),
  ('amops', 'inspections:view'),
  ('amops', 'inspections:write'),
  ('amops', 'inspections:file'),
  ('amops', 'acsi:view'),
  ('amops', 'acsi:write'),
  ('amops', 'acsi:file'),
  ('amops', 'discrepancies:view'),
  ('amops', 'discrepancies:write'),
  ('amops', 'discrepancies:close'),
  ('amops', 'discrepancies:cancel'),
  ('amops', 'discrepancies:transition:ces_statuses'),
  ('amops', 'discrepancies:update:resolution_notes'),
  ('amops', 'discrepancies:add_note'),
  ('amops', 'infrastructure:view'),
  ('amops', 'infrastructure:write'),
  ('amops', 'parking:view'),
  ('amops', 'parking:write'),
  ('amops', 'obstructions:view'),
  ('amops', 'obstructions:write'),
  ('amops', 'qrc:view'),
  ('amops', 'qrc:execute'),
  ('amops', 'shift_checklist:view'),
  ('amops', 'shift_checklist:write'),
  ('amops', 'scn:view'),
  ('amops', 'scn:write'),
  ('amops', 'wildlife:view'),
  ('amops', 'wildlife:write'),
  ('amops', 'waivers:view'),
  ('amops', 'waivers:write'),
  ('amops', 'notams:view'),
  ('amops', 'notams:write'),
  ('amops', 'ppr:view'),
  ('amops', 'ppr:write'),
  ('amops', 'contractors:view'),
  ('amops', 'contractors:write'),
  ('amops', 'daily_reviews:view'),
  ('amops', 'daily_reviews:sign:amsl'),
  ('amops', 'reports:view'),
  ('amops', 'reports:export'),
  ('amops', 'activity_log:view'),
  ('amops', 'activity_log:write_manual'),
  ('amops', 'recent_activity:view'),
  ('amops', 'training:view'),
  ('amops', 'regulations:view'),
  ('amops', 'aircraft:view'),
  ('amops', 'settings:view');

-- ── ces — today blocked at RLS; seed Phase A to match TODAY's ─
-- (Phase B migration will add discrepancies write permissions.)
INSERT INTO role_permissions (role, permission_key) VALUES
  ('ces', 'airfield_status:view'),
  ('ces', 'ces:view'),
  ('ces', 'discrepancies:view'),
  ('ces', 'infrastructure:view'),
  ('ces', 'training:view'),
  ('ces', 'settings:view');

-- ── safety — today a ghost role; Phase A = read-only only ─
-- (Phase C migration will add wildlife:write + airfield_status:write:rsc_bwc_only.)
INSERT INTO role_permissions (role, permission_key)
SELECT 'safety', key FROM permissions
WHERE key LIKE '%:view'
   OR key IN ('aircraft:view','regulations:view','training:view','settings:view','installations:switch');

-- ── atc — read-only (matches safety for Phase A) ─
INSERT INTO role_permissions (role, permission_key)
SELECT 'atc', key FROM permissions
WHERE key LIKE '%:view'
   OR key IN ('aircraft:view','regulations:view','training:view','settings:view','installations:switch');

-- ── read_only — every view key, no writes ─────────────────
INSERT INTO role_permissions (role, permission_key)
SELECT 'read_only', key FROM permissions
WHERE key LIKE '%:view'
   OR key IN ('aircraft:view','regulations:view','training:view','settings:view','installations:switch');

-- NOTE: roles introduced in Phase C (majcom_rfm, ppr, airfield_status)
-- are seeded in their own migrations, not here.

-- ── User-specific overrides ────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted        BOOLEAN NOT NULL, -- TRUE = grant, FALSE = revoke
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_permission_overrides_read_self"
  ON user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.user_is_sys_admin(auth.uid()));

CREATE POLICY "user_permission_overrides_write_sys_admin"
  ON user_permission_overrides FOR ALL TO authenticated
  USING (public.user_is_sys_admin(auth.uid()))
  WITH CHECK (public.user_is_sys_admin(auth.uid()));

-- ── Reference tables — let everyone authenticated read ────
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_read_all" ON permissions
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "role_permissions_read_all" ON role_permissions
  FOR SELECT TO authenticated USING (TRUE);

-- Only sys_admin can edit the catalogue
CREATE POLICY "permissions_write_sys_admin" ON permissions
  FOR ALL TO authenticated
  USING (public.user_is_sys_admin(auth.uid()))
  WITH CHECK (public.user_is_sys_admin(auth.uid()));

CREATE POLICY "role_permissions_write_sys_admin" ON role_permissions
  FOR ALL TO authenticated
  USING (public.user_is_sys_admin(auth.uid()))
  WITH CHECK (public.user_is_sys_admin(auth.uid()));

-- ── Capability helper ──────────────────────────────────────
-- Returns TRUE if the user has the permission key via their role
-- preset, NOT revoked by an override, OR explicitly granted by an
-- override. `granted=FALSE` always wins — sys_admin can revoke even
-- from a role that has the key in its preset.
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id UUID, p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  WITH caller_role AS (
    SELECT role FROM profiles WHERE id = p_user_id
  ),
  role_has AS (
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp, caller_role cr
      WHERE rp.role = cr.role AND rp.permission_key = p_key
    ) AS has_it
  ),
  override AS (
    SELECT granted FROM user_permission_overrides
    WHERE user_id = p_user_id AND permission_key = p_key
  )
  SELECT COALESCE(
    (SELECT granted FROM override),
    (SELECT has_it FROM role_has),
    FALSE
  )
$$;

GRANT EXECUTE ON FUNCTION public.user_has_permission(UUID, TEXT) TO authenticated;
