-- ============================================================
-- ACSI — one filed inspection per base per fiscal year
--
-- Finding (audit 2026-07-01, MED): no natural-key uniqueness on acsi_inspections,
-- so double-submits could create duplicate annual compliance inspections.
-- ACSI (DAFMAN 13-204v2 Para 5.4.3) is an annual, once-per-base-per-FY inspection.
-- Partial unique index on completed/staffed rows only (drafts / in_progress may
-- legitimately coexist while a new cycle is worked), mirroring the
-- inspections_one_inprogress_per_day pattern. Existing duplicate completed rows on
-- the demo base were removed by the operator before this was applied.
-- ============================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS acsi_one_completed_per_fiscal_year
  ON public.acsi_inspections (base_id, fiscal_year)
  WHERE status IN ('completed', 'staffed');

COMMIT;
