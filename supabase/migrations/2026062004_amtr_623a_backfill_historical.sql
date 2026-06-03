-- ============================================================
-- AMTR — one-time backfill: mark unsigned 623A entries historical.
--
-- 623A entries imported before the `transcribed` flag existed (2026062003)
-- can't be retroactively identified as imports. As a one-time cleanup, any
-- entry that currently carries NONE of the four signatures (trainee, trainer,
-- NAMT/Certifier, AFM) is treated as historical/reference-only — a real
-- in-system entry would have at least one signature. This stops the record
-- inspection (623a_signed, item 4.1) from flagging them as unsigned.
--
-- Reversible per entry via the "Historical" checkbox on the 623A tab. Entries
-- with any signature, or new entries signed after this runs, are untouched.
-- ============================================================

UPDATE amtr_623a SET transcribed = true
WHERE transcribed = false
  AND (trainee_initials IS NULL OR TRIM(trainee_initials) = '')
  AND (trainer_initials IS NULL OR TRIM(trainer_initials) = '')
  AND (namt_initials    IS NULL OR TRIM(namt_initials) = '')
  AND (afm_initials     IS NULL OR TRIM(afm_initials) = '');
