-- ============================================================
-- Seed airfield_status rows for every base, past and future
--
-- Root cause (KFAR bug, 2026-07-16): airfield_status began life as a
-- single-row global table (2026022201). The multi-base conversion
-- (2026022301) made it one-row-per-base but never added a creation
-- hook — the only programmatic seeding path was a best-effort,
-- error-swallowed client insert inside the base-setup wizard's
-- "Import All" flow. Result: 37 of 64 bases had no row, and every
-- status-board save on those bases failed ("Could not save the
-- airfield status change" — updateAirfieldStatus bails when the
-- row lookup comes back empty).
--
-- Two parts:
--   1. Backfill a default row for every base missing one.
--   2. AFTER INSERT trigger on bases so every future base gets its
--      row at creation, regardless of creation path (signup route,
--      seed migration, admin tooling). SECURITY DEFINER because the
--      inserting session (e.g. an authenticated signup enrolling
--      itself) may not hold airfield_status:write; the row is pure
--      scaffolding with default values, so this grants nothing.
--
-- active_runway keeps its column default ('01') — the status board
-- initializes runway_statuses from base_runways client-side and
-- syncs the legacy active_runway/runway_status fields on first save.
-- ============================================================

-- ── 1. Backfill ─────────────────────────────────────────────
INSERT INTO airfield_status (base_id)
SELECT b.id
FROM bases b
WHERE NOT EXISTS (
  SELECT 1 FROM airfield_status s WHERE s.base_id = b.id
)
ON CONFLICT DO NOTHING;

-- ── 2. Creation hook ────────────────────────────────────────
CREATE OR REPLACE FUNCTION seed_airfield_status_for_base()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO airfield_status (base_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION seed_airfield_status_for_base() FROM PUBLIC;

DROP TRIGGER IF EXISTS bases_seed_airfield_status ON bases;
CREATE TRIGGER bases_seed_airfield_status
  AFTER INSERT ON bases
  FOR EACH ROW
  EXECUTE FUNCTION seed_airfield_status_for_base();
