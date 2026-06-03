-- ============================================================
-- AMTR — 623A "historical / transcribed" flag.
--
-- Records imported from a prior system bring in 623A entries that were already
-- transcribed there — historical, reference-only entries that legitimately carry
-- no in-system initials/signatures. This per-entry flag marks them so the record
-- inspection (623a_signed, item 4.1) skips them instead of flagging "unsigned".
--
-- Set TRUE automatically on record import; also toggleable per entry on the 623A
-- tab so entries already in a record can be marked. Expand-only (additive column
-- with a safe default); no existing code reads it until deployed.
-- ============================================================

ALTER TABLE amtr_623a ADD COLUMN IF NOT EXISTS transcribed BOOLEAN NOT NULL DEFAULT FALSE;
