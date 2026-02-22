-- Disable RLS on recently-created tables to match the project convention
-- (RLS was disabled on all older tables in 20260217_remove_rls_policies.sql)
ALTER TABLE IF EXISTS airfield_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS runway_status_log DISABLE ROW LEVEL SECURITY;

-- Automatically log every airfield_status change into runway_status_log.
-- Runs as SECURITY DEFINER so it bypasses RLS regardless of client permissions.
CREATE OR REPLACE FUNCTION log_airfield_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log when something actually changed
  IF OLD.runway_status  IS DISTINCT FROM NEW.runway_status
  OR OLD.active_runway  IS DISTINCT FROM NEW.active_runway
  OR OLD.advisory_type  IS DISTINCT FROM NEW.advisory_type
  OR OLD.advisory_text  IS DISTINCT FROM NEW.advisory_text
  THEN
    INSERT INTO runway_status_log (
      old_runway_status, new_runway_status,
      old_active_runway, new_active_runway,
      old_advisory_type, new_advisory_type,
      old_advisory_text, new_advisory_text,
      changed_by
    ) VALUES (
      OLD.runway_status,  NEW.runway_status,
      OLD.active_runway,  NEW.active_runway,
      OLD.advisory_type,  NEW.advisory_type,
      OLD.advisory_text,  NEW.advisory_text,
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_log_airfield_status ON airfield_status;
CREATE TRIGGER trg_log_airfield_status
  AFTER UPDATE ON airfield_status
  FOR EACH ROW
  EXECUTE FUNCTION log_airfield_status_change();
