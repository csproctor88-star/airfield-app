-- ============================================================
-- Phase 1.1 — bases.airport_type + Part 139 metadata
--
-- Adds the dual-mode flag that splits the codebase into USAF vs
-- civilian FAA Part 139 behavior. All existing rows default to
-- 'usaf', preserving current behavior. New civilian bases set
-- 'faa_part139' during the base-setup wizard.
--
-- Companion columns (`part139_class`, `faa_site_number`,
-- `aoc_number`) are nullable on USAF bases and required only when
-- airport_type = 'faa_part139'; the wizard enforces that, not the
-- schema (no CHECK across columns to keep migrations reversible).
--
-- Immutability trigger: once `activity_log` has any rows for a
-- base, `airport_type` cannot be changed. The military and civilian
-- workflows have incompatible status enums and roles; a mid-life
-- flip would orphan or mangle data. If a base needs to flip,
-- sys_admin must first clear `activity_log` (intentional and rare).
-- ============================================================

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS airport_type    TEXT NOT NULL DEFAULT 'usaf'
    CHECK (airport_type IN ('usaf', 'faa_part139')),
  ADD COLUMN IF NOT EXISTS part139_class   TEXT
    CHECK (part139_class IS NULL OR part139_class IN ('I','II','III','IV')),
  ADD COLUMN IF NOT EXISTS faa_site_number TEXT,
  ADD COLUMN IF NOT EXISTS aoc_number      TEXT;

COMMENT ON COLUMN bases.airport_type IS
  'Operational mode. Set during base setup; immutable after first activity_log row.';
COMMENT ON COLUMN bases.part139_class IS
  'Part 139 classification I/II/III/IV. Only meaningful when airport_type = faa_part139.';
COMMENT ON COLUMN bases.faa_site_number IS
  'FAA Airport Site Number (e.g. 12345.*A). Only set for faa_part139.';
COMMENT ON COLUMN bases.aoc_number IS
  'Airport Operating Certificate number. Only set for faa_part139.';

-- ── Immutability trigger ───────────────────────────────────
-- Blocks UPDATE that changes airport_type if any activity_log row
-- exists for the base. Returns a clear error message so the UI
-- can surface it as a friendly toast.

CREATE OR REPLACE FUNCTION enforce_airport_type_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.airport_type IS DISTINCT FROM NEW.airport_type THEN
    IF EXISTS (SELECT 1 FROM activity_log WHERE base_id = NEW.id LIMIT 1) THEN
      RAISE EXCEPTION
        'airport_type cannot be changed for base % once activity_log has rows. '
        'Clear activity_log for this base first (sys_admin only) to reset.',
        NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bases_airport_type_immutable ON bases;
CREATE TRIGGER bases_airport_type_immutable
  BEFORE UPDATE ON bases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_airport_type_immutable();
