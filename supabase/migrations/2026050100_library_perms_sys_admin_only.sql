-- ─────────────────────────────────────────────────────────────
-- 2026050100 · Restrict library:view + library:manage to sys_admin
-- ─────────────────────────────────────────────────────────────
-- The PDF Library is intentionally a sys_admin-only surface — it
-- holds platform-wide reference PDFs that base-level users
-- shouldn't be browsing. The Phase A seed migration
-- (2026042200_permission_matrix_scaffold) granted library:view +
-- library:manage broadly:
--   • sys_admin / airfield_manager / namo / base_admin    via "all keys" inserts
--   • safety / atc                                         via the %:view loop
-- A later cleanup (2026042204) only removed library:view from
-- read_only. Other base roles still have it.
--
-- Revoke library:view AND library:manage from every role except
-- sys_admin. The seed migration is unchanged so that re-running
-- migrations in order produces the same final state — this delta
-- is what locks library to sys_admin.

DELETE FROM role_permissions
WHERE permission_key IN ('library:view', 'library:manage')
  AND role <> 'sys_admin';

-- Also revoke any per-user overrides that grant library:view to
-- a non-sys_admin user. (Overrides that *revoke* library:view
-- from a sys_admin are kept — those are deliberate locks-out.)
DELETE FROM user_permission_overrides upo
USING profiles p
WHERE upo.user_id = p.id
  AND upo.permission_key IN ('library:view', 'library:manage')
  AND upo.granted = TRUE
  AND p.role <> 'sys_admin';
