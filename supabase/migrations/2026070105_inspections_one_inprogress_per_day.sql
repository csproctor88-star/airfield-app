-- Audit M-4: DB backstop for the inspection one-per-day rule (was client-only).
--
-- The offline write queue can replay an inspection "start" and create a SECOND
-- in_progress row for the same base/date/type, which the client rule alone
-- can't prevent. This partial unique index makes the DB reject the duplicate.
--
-- SCOPE — WHERE status = 'in_progress' only, deliberately narrow:
--   * Live check found 0 duplicate in_progress groups, so the index builds clean.
--   * Live check found 7 duplicate (base_id, inspection_date, inspection_type)
--     groups among COMPLETED inspections — legitimate same-day re-inspections /
--     historical rows — so a broad all-status unique would (a) fail to build and
--     (b) be semantically wrong. Constraining only in_progress targets exactly
--     the offline-duplicate bug without touching history.
--
-- NULL base_id rows (legacy) are treated as distinct by the unique index and so
-- are left unconstrained — acceptable; they are not the duplicate-start case.
--
-- NOT applied here (need a data-cleanup decision first — flagged to the user):
--   * acsi_inspections (base_id, fiscal_year): 1 existing duplicate group.
--   * qrc_monthly_reviews (base_id, template_id, user_id, month): 4 existing
--     duplicate groups (multi-submit appears to be a real pattern).
-- A unique constraint on either would fail to build against current data.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS inspections_one_inprogress_per_day
  ON inspections (base_id, inspection_date, inspection_type)
  WHERE status = 'in_progress';

COMMIT;
