-- ============================================================
-- AMTR — one-time backfill: mark pre-transcription 623A entries historical.
--
-- The unit's existing records were transcribed into the system on 1 June 2026, so
-- every 623A entry whose form_date predates that (training documented before
-- go-live) is historical/reference-only and shouldn't be flagged for missing
-- in-system signatures during a records inspection. This complements the earlier
-- unsigned-entry backfill (2026062004) by also covering signed transcribed entries.
--
-- Dated entries only (form_date < 2026-06-01); null-dated entries are left as-is
-- (the unsigned ones were already handled). Reversible per entry via the
-- "Historical" checkbox. Entries dated 1 June onward are treated as current.
-- ============================================================

UPDATE amtr_623a SET transcribed = true
WHERE NOT transcribed
  AND form_date IS NOT NULL
  AND form_date < DATE '2026-06-01';
