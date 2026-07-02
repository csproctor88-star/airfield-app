-- Audit C-1 (CRITICAL): drop the dangling update_airfield_status() overloads.
--
-- This SECURITY DEFINER function updates airfield_status for a client-supplied
-- p_base_id with a spoofable p_updated_by and NO permission / base-access
-- checks. anon EXECUTE was revoked in 2026061700, but authenticated retained
-- the default PUBLIC grant, so any authenticated user (including read-only or
-- the shared kiosk account) could POST /rest/v1/rpc/update_airfield_status
-- with another base's UUID and flip that tenant's runway status / advisories.
--
-- It is DEAD CODE: the current write path is the airfield-status route + RLS
-- (or safety_update_rsc_bwc). A repo-wide search finds no supabase.rpc(
-- 'update_airfield_status') caller — only the generated types file references
-- the name. Both overloads (2-arg and 3-arg) coexist because 2026022301 added
-- p_base_id, changing the signature so CREATE OR REPLACE made a second
-- overload rather than replacing the first (confirmed by the paired
-- ALTER FUNCTION ... SET search_path in 2026041401).
--
-- DROP FUNCTION removes the function and its grants; no separate REVOKE needed.
-- Expand/contract: this is contract-only and safe because live code does not
-- call it. If ever needed again, recreate WITH the standard
-- user_has_permission('airfield_status:write') + user_has_base_access guard.

BEGIN;
DROP FUNCTION IF EXISTS public.update_airfield_status(jsonb, uuid);
DROP FUNCTION IF EXISTS public.update_airfield_status(jsonb, uuid, uuid);
COMMIT;
