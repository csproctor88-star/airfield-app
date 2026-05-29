-- 2026061600_pending_status_gate.sql
--
-- Defense-in-depth for the self-signup privilege fix (signup-email route now
-- coerces self-assigned admin roles to read_only). Make 'pending' and
-- 'deactivated' a REAL authorization boundary at the database layer.
--
-- Until now the three core RLS helpers keyed only on profiles.role, so a
-- pending or deactivated account that authenticated directly against the
-- Supabase REST/RPC API would still be granted its role's access — the only
-- 'pending' enforcement lived in app/login/page.tsx (client side, trivially
-- bypassed). These helpers gate every RLS read/write, so requiring
-- status='active' blocks non-active accounts everywhere.
--
-- Safety: kiosk accounts are system-provisioned and immediately flipped to
-- 'active' (app/kiosk/[icao]/route.ts:139-142); all real users are 'active'.
-- Only pending/deactivated accounts lose access, which is the intent. For an
-- 'active' caller the logic is byte-for-byte identical to before.

CREATE OR REPLACE FUNCTION public.user_is_sys_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND role = 'sys_admin'
      AND status = 'active'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_base_access(p_user_id uuid, p_base_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Non-active accounts (pending / deactivated) have no access anywhere.
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND status = 'active'
  ) THEN
    RETURN FALSE;
  END IF;

  -- NULL base_id = legacy row, accessible to all active authenticated users
  IF p_base_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- sys_admin can access all bases
  IF user_is_sys_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM base_members
    WHERE user_id = p_user_id
      AND base_id = p_base_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH active AS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND status = 'active'
  ),
  caller_role AS (
    SELECT role FROM profiles WHERE id = p_user_id AND status = 'active'
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
  -- A non-active account never has any permission, even via a stray override.
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM active) THEN FALSE
    ELSE COALESCE(
      (SELECT granted FROM override),
      (SELECT has_it FROM role_has),
      FALSE
    )
  END
$function$;
