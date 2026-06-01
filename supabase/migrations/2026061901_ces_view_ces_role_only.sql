-- ============================================================
-- Narrow `ces:view` to the CES role (+ sys_admin)
--
-- CES Work Orders is a USAF civil-engineering workflow surfaced
-- only to the CES role. `ces:view` had also been granted to two
-- civilian Part 139 roles (accountable_executive, ops_supervisor)
-- in 2026052503 — neither uses the CES Work Orders dashboard, so
-- remove the grant to keep the tab scoped to CES.
--
-- USAF roles (airfield_manager, base_admin, namo, amops) never held
-- `ces:view`, so they are unaffected. sys_admin keeps it via the
-- all-permissions grant (system admins see every module).
--
-- After this migration, `ces:view` is held by: ces, sys_admin.
-- ============================================================

DELETE FROM role_permissions
WHERE permission_key = 'ces:view'
  AND role NOT IN ('ces', 'sys_admin');
