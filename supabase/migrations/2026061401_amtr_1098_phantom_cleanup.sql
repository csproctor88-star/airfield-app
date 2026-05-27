-- ============================================================
-- AMTR 1098 — clean up phantom progress + catalog from prior rollover
--
-- Pre-Phase-B, the 1098 catalog was base-shared (single set of tasks).
-- Phase B made it per-year. The auto-rollover code in form1098-tab.tsx
-- then cloned the source year's catalog into the next year AND created
-- a next-year progress row for the completing member whenever a task's
-- next_due landed in a later year.
--
-- The catalog clone was base-shared, so one member's rollover into year
-- Y+1 made Y+1's task list visible across every member's record — even
-- members who had no actual training data in Y+1. To them it looked
-- like a phantom Y+1 tab with blank rows.
--
-- This migration cleans up the residue. The matching code change in
-- form1098-tab.tsx (same commit) restricts auto-rollover to only seed
-- next-year progress if the admin has explicitly opened the next year
-- via +Add Year, so no new phantoms will appear.
--
-- Cleanup criteria:
--   1. Progress rows in a year that is NOT registered in amtr_1098_years
--      for that base AND that carry no training data (no start_date, no
--      last_completed, no signatures). These are the phantoms.
--   2. Catalog rows in a year that is NOT in amtr_1098_years AND no
--      member's progress references them. These are the orphaned clones.
--   3. Current calendar year is never deleted from either, even if no
--      one has opened it yet — that year always shows by default.
-- ============================================================

DELETE FROM amtr_1098_progress p
WHERE p.last_completed IS NULL
  AND p.start_date IS NULL
  AND p.trainee_initials IS NULL
  AND p.trainee_signed_by IS NULL
  AND p.certifier_initials IS NULL
  AND p.certifier_signed_by IS NULL
  AND p.year_label <> TO_CHAR(now() AT TIME ZONE 'UTC', 'YYYY')
  AND NOT EXISTS (
    SELECT 1 FROM amtr_1098_years y
    WHERE y.base_id = p.base_id AND y.year_label = p.year_label
  );

DELETE FROM amtr_1098_catalog c
WHERE c.year_label <> TO_CHAR(now() AT TIME ZONE 'UTC', 'YYYY')
  AND NOT EXISTS (
    SELECT 1 FROM amtr_1098_progress p WHERE p.catalog_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM amtr_1098_years y
    WHERE y.base_id = c.base_id AND y.year_label = c.year_label
  );
