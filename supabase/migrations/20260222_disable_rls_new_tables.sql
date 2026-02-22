-- Disable RLS on recently-created tables to match the project convention
-- (RLS was disabled on all older tables in 20260217_remove_rls_policies.sql)
ALTER TABLE IF EXISTS airfield_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS runway_status_log DISABLE ROW LEVEL SECURITY;
