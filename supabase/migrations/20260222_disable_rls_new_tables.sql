-- Disable RLS on recently-created tables to match the project convention
-- (RLS was disabled on all older tables in 20260217_remove_rls_policies.sql)
ALTER TABLE IF EXISTS airfield_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS runway_status_log DISABLE ROW LEVEL SECURITY;

-- RPC function to update airfield_status.
-- Accepts a JSONB payload so nullable fields (advisory_type/text) can be
-- explicitly set to null vs. left unchanged.
-- SECURITY DEFINER ensures it bypasses RLS regardless of the calling client.
CREATE OR REPLACE FUNCTION update_airfield_status(
  p_updates    JSONB,
  p_updated_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE airfield_status
  SET
    runway_status = COALESCE(p_updates->>'runway_status', runway_status),
    active_runway = COALESCE(p_updates->>'active_runway', active_runway),
    advisory_type = CASE WHEN p_updates ? 'advisory_type' THEN p_updates->>'advisory_type'
                         ELSE advisory_type END,
    advisory_text = CASE WHEN p_updates ? 'advisory_text' THEN p_updates->>'advisory_text'
                         ELSE advisory_text END,
    updated_by    = COALESCE(p_updated_by, updated_by),
    updated_at    = now()
  WHERE id = (SELECT id FROM airfield_status LIMIT 1);
END;
$$;

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
