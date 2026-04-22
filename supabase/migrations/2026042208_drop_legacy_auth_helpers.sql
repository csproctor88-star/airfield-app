-- ============================================================
-- Phase E2 — Drop legacy auth helpers
--
-- Every live RLS policy has been swapped to
-- `user_has_permission(uid, key)` over Phase B–D. These three
-- helpers are no longer called by any policy, function, trigger,
-- or view — they're pure dead code in the DB.
--
-- Kept:
--   • user_has_base_access — still used by nearly every RLS policy
--   • user_is_sys_admin    — intentional escape hatch (bases INSERT/
--                            DELETE, profiles DELETE, catalogue
--                            write policies)
--
-- Dropped:
--   • user_can_write
--   • user_is_admin
--   • user_is_base_admin_at
--
-- Using RESTRICT (default) — if any dependency exists we want to
-- fail loudly rather than silently cascade something into oblivion.
-- ============================================================

DROP FUNCTION IF EXISTS public.user_can_write(uuid);
DROP FUNCTION IF EXISTS public.user_is_admin(uuid);
DROP FUNCTION IF EXISTS public.user_is_base_admin_at(uuid, uuid);
