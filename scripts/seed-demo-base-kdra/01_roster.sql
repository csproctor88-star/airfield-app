-- ============================================================
-- KDRA demo staff roster — display-only profiles (no auth.users FK) + base_members.
-- Deterministic md5 ids (reproducible / re-runnable via ON CONFLICT DO NOTHING).
-- Base: KDRA ea2b542e-72cc-4300-9037-bfe18c0bf7ae
-- profiles.id FKs to auth.users -> disable FK triggers for the load (clone-script pattern).
-- ============================================================
BEGIN;
SET LOCAL session_replication_role = replica;  -- FK/trigger off for display-only staff

-- 1) Rename the demo login -> Marcus Delgado (Airport Operations Manager). Email unchanged.
UPDATE profiles
SET first_name = 'Marcus', last_name = 'Delgado', name = 'Marcus Delgado',
    operating_initials = 'MD', rank = NULL, organization = 'DRA Airport Operations',
    updated_at = now()
WHERE id = 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6';

-- 2) Eight fabricated staff profiles.
INSERT INTO profiles
  (id, email, first_name, last_name, name, operating_initials, rank, role,
   primary_base_id, is_active, status, has_completed_setup_tour, must_change_password,
   last_seen_at, last_seen_release_version, organization, tours_completed,
   created_at, updated_at)
SELECT md5('kdra-staff-'||slug)::uuid, email, first, last, first||' '||last, oi, NULL, role,
   'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', true, 'active', true, false,
   '2026-07-23T14:00:00+00'::timestamptz, '2.35.0', org, '{}'::jsonb,
   hire::timestamptz, hire::timestamptz
FROM (VALUES
  ('karen-whitfield','kwhitfield@draregional.com','Karen','Whitfield','KW','accountable_executive','DRA Airport Operations','2023-06-01'),
  ('anthony-ruiz','aruiz@draregional.com','Anthony','Ruiz','AR','ops_supervisor','DRA Airside Operations','2024-02-15'),
  ('danielle-pearce','dpearce@draregional.com','Danielle','Pearce','DP','amops','DRA Airside Operations','2024-08-01'),
  ('brian-okafor','bokafor@draregional.com','Brian','Okafor','BO','amops','DRA Airside Operations','2025-01-10'),
  ('olivia-brenner','obrenner@draregional.com','Olivia','Brenner','OB','amops','DRA Airside Operations','2025-05-20'),
  ('sara-lindqvist','slindqvist@draregional.com','Sara','Lindqvist','SL','sms_manager','DRA Safety Management','2024-04-01'),
  ('james-holloway','jholloway@draregional.com','James','Holloway','JH','aep_coordinator','DRA Emergency Management','2024-09-15'),
  ('ramon-castellano','rcastellano@draregional.com','Ramon','Castellano','RC','arff_chief','DRA ARFF','2023-11-01')
) AS t(slug, email, first, last, oi, role, org, hire)
ON CONFLICT (id) DO NOTHING;

-- 3) Link the eight as KDRA base_members.
INSERT INTO base_members (id, base_id, user_id, role, created_at)
SELECT md5('kdra-member-'||slug)::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
       md5('kdra-staff-'||slug)::uuid, role, hire::timestamptz
FROM (VALUES
  ('karen-whitfield','accountable_executive','2023-06-01'),
  ('anthony-ruiz','ops_supervisor','2024-02-15'),
  ('danielle-pearce','amops','2024-08-01'),
  ('brian-okafor','amops','2025-01-10'),
  ('olivia-brenner','amops','2025-05-20'),
  ('sara-lindqvist','sms_manager','2024-04-01'),
  ('james-holloway','aep_coordinator','2024-09-15'),
  ('ramon-castellano','arff_chief','2023-11-01')
) AS t(slug, role, hire)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- 4) Return the resolved roster (last statement -> this is what prints).
SELECT jsonb_agg(jsonb_build_object(
         'id', p.id, 'name', p.name, 'oi', p.operating_initials, 'role', m.role)
       ORDER BY m.created_at) AS roster
FROM base_members m
JOIN profiles p ON p.id = m.user_id
WHERE m.base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
