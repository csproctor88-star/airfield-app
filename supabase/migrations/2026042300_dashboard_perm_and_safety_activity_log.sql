-- ============================================================
-- Dashboard permission key + Safety sidebar cleanup
--
-- Problem 1: `/dashboard` was gated on `airfield_status:view` in
-- HREF_TO_VIEW_PERM — which every role holds, including the narrow
-- kiosk / safety / ppr roles that shouldn't see the KPI hub.
--
-- Problem 2: Phase C (2026042202) granted `activity_log:view` to
-- safety, so the Events Log rendered in their sidebar.
-- ============================================================

-- ── New permission key ─────────────────────────────────────
INSERT INTO permissions (key, label, category, description) VALUES
  ('dashboard:view', 'View Dashboard', 'reporting', 'KPI hub and live operational dashboard (distinct from the kiosk-only airfield status board)')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, description = EXCLUDED.description;

-- Seed to the operational roles. Narrow roles (safety / ppr / atc /
-- airfield_status) intentionally excluded — they only get
-- airfield_status:view for the kiosk-style status board.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('sys_admin',        'dashboard:view'),
  ('airfield_manager', 'dashboard:view'),
  ('namo',             'dashboard:view'),
  ('base_admin',       'dashboard:view'),
  ('amops',            'dashboard:view'),
  ('ces',              'dashboard:view'),
  ('read_only',        'dashboard:view'),
  ('majcom_rfm',       'dashboard:view')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ── Drop safety's activity_log:view ────────────────────────
-- Events Log is an operational audit surface, not something safety
-- needs for wildlife / narrow RSC+BWC work.
DELETE FROM role_permissions
WHERE role = 'safety' AND permission_key = 'activity_log:view';
