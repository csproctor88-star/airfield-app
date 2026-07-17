-- ============================================================
-- NAMO/NAMT Report Tool — Migration 3/3: attribution profile FKs
--
-- Spec: docs/superpowers/specs/2026-07-16-namo-namt-report-tool-design.md
--       (§Data model & migrations)
--
-- Integrity + typegen for the FK-less "who did this" uuid columns on QRC
-- and wildlife. The report itself uses batch .in('id', …) lookup and does
-- not depend on these FKs (mirrors daily-reviews.ts:243-266); this closes
-- the referential-integrity gap and lets the type generator pick up the
-- relationship for future PostgREST embeds.
--
-- NOT VALID: tolerates any pre-existing orphan uuids (rows with an actor id
-- that no longer has a surviving profiles row); validates new writes only.
-- Each ADD CONSTRAINT is guarded by a pg_constraint pre-check (idempotency
-- style of 2026071762_obstruction_evaluations_runway_class_nullable.sql's
-- DO block) so this file can be safely re-run.
--
-- STAGED — NOT applied. Staged tonight (2026-07-17) for owner review in
-- the morning; apply after 2026071740 and 2026071741.
--
-- Post-apply verification:
--   SELECT conname, convalidated FROM pg_constraint
--    WHERE conname IN (
--      'qrc_executions_opened_by_fkey', 'qrc_executions_closed_by_fkey',
--      'wildlife_sightings_observed_by_id_fkey', 'wildlife_strikes_reported_by_id_fkey'
--    );
--   -- expect: 4 rows, convalidated = false (NOT VALID — pre-existing rows
--   --         are tolerated; only new/updated rows are checked)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'qrc_executions_opened_by_fkey'
       AND conrelid = 'public.qrc_executions'::regclass
  ) THEN
    ALTER TABLE public.qrc_executions
      ADD CONSTRAINT qrc_executions_opened_by_fkey
      FOREIGN KEY (opened_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'qrc_executions_closed_by_fkey'
       AND conrelid = 'public.qrc_executions'::regclass
  ) THEN
    ALTER TABLE public.qrc_executions
      ADD CONSTRAINT qrc_executions_closed_by_fkey
      FOREIGN KEY (closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'wildlife_sightings_observed_by_id_fkey'
       AND conrelid = 'public.wildlife_sightings'::regclass
  ) THEN
    ALTER TABLE public.wildlife_sightings
      ADD CONSTRAINT wildlife_sightings_observed_by_id_fkey
      FOREIGN KEY (observed_by_id) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'wildlife_strikes_reported_by_id_fkey'
       AND conrelid = 'public.wildlife_strikes'::regclass
  ) THEN
    ALTER TABLE public.wildlife_strikes
      ADD CONSTRAINT wildlife_strikes_reported_by_id_fkey
      FOREIGN KEY (reported_by_id) REFERENCES public.profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
