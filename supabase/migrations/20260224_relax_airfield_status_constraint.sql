-- Relax the hardcoded active_runway CHECK constraint that was tied to
-- Selfridge's runway designators ('01', '19'). Every base has different
-- runway designators, so this must be free-form text.
-- Also seeds an initial airfield_status row for Andersen AFB (PGUA).

-- Drop the auto-named constraint; IF EXISTS makes this safe to re-run
ALTER TABLE airfield_status
  DROP CONSTRAINT IF EXISTS airfield_status_active_runway_check;

-- Seed airfield_status for Andersen AFB (PGUA)
-- Requires the PGUA base row from 20260224_seed_pgua_andersen_afb.sql
INSERT INTO airfield_status (base_id, active_runway, runway_status)
VALUES ('00000000-0000-0000-0000-000000000002', '06L', 'open')
ON CONFLICT DO NOTHING;
