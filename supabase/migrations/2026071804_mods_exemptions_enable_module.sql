-- ============================================================
-- Modifications & Exemptions — Migration 4/4: enable the module on
-- existing CIVILIAN bases.
--
-- *** Bulk UPDATE across bases rows (owner-row UPDATE) — called out
-- explicitly like 2026071733, not folded quietly into the other files.
-- Purely additive to the enabled_modules array and idempotent. ***
--
-- Owner ruling 2026-07-18 (open question 2): defaultEnabled: true.
-- enabled_modules is a frozen text[] snapshot per base, so the
-- modules-config flag only affects bases created after today; existing
-- civilian bases need this one-time backfill (the read_file / AMTR /
-- local_regs backfill pattern).
--
-- Scoped to airport_type = 'faa_part139': the module is civilian-only
-- (appliesTo: ['faa_part139']), so seeding the key onto USAF bases would
-- be dead data — moduleAppliesToAirport() would filter it anyway, but
-- there's no reason to write it.
--
-- Apply LAST in the four-migration sequence (2026071801 → 02 → 03 →
-- this file), after the code that renders the module is deployed or
-- about to be.
--
-- Post-apply verification:
--   SELECT count(*) FROM bases WHERE airport_type = 'faa_part139'
--     AND NOT ('mods_exemptions' = ANY(COALESCE(enabled_modules, '{}')));
--   -- expect 0
--   SELECT count(*) FROM bases WHERE airport_type <> 'faa_part139'
--     AND 'mods_exemptions' = ANY(COALESCE(enabled_modules, '{}'));
--   -- expect 0 (no USAF rows touched)
-- ============================================================

UPDATE bases
SET enabled_modules = array_append(enabled_modules, 'mods_exemptions')
WHERE airport_type = 'faa_part139'
  AND NOT ('mods_exemptions' = ANY(COALESCE(enabled_modules, '{}')));
