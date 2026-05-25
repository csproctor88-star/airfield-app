-- ============================================================
-- AMTR — narrow `amtr:view` to AMOPS-internal roles
--
-- The initial grant in 2026052000_amtr_permissions.sql gave
-- `amtr:view` to safety / atc / read_only on the assumption that
-- the read-only family should see most things. Reconsidered:
-- Airfield Management Training Records cover Airfield Manager,
-- NAMT, and AMOPS personnel only — they're not relevant to base
-- safety, ATC, or generic read-only viewers, and exposing them
-- to those roles muddies the privacy boundary on individual
-- training progress.
--
-- After this migration, `amtr:view` is held by:
--   sys_admin, airfield_manager, namo, base_admin, amops
-- (plus the AMTR-role layer in amtr_role_assignments, which is
-- independent of these app perms.)
-- ============================================================

DELETE FROM role_permissions
WHERE role IN ('safety', 'atc', 'read_only')
  AND permission_key LIKE 'amtr:%';
