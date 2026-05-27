-- ============================================================
-- AMTR 623A — link auto-generated entries to their source row
--
-- The auto-623a flow used to mint a new entry on every non-trainee
-- sign-off. The new flow lets the entry evolve through stages: trainee
-- signs first (opens entry, can add trainee comment), trainer signs
-- second (sees the trainee's comment, adds their own, optionally
-- requires certifier), certifier signs third (only if trainer marked
-- it required). To find the same entry across stages we link each
-- auto-generated 623a row back to the source row that triggered it.
--
-- New columns:
--   source_table        - 'amtr_1098_progress' | 'amtr_jqs_progress' |
--                         'amtr_797' | 'amtr_803' | 'amtr_milestone_progress'
--   source_row_id       - UUID of the row in source_table
--   requires_certifier  - set by the trainer; gates whether the
--                         certifier (NAMT slot on 623a) is expected.
--                         Defaults to false → 623a finalizes after
--                         trainer signs.
-- ============================================================

ALTER TABLE amtr_623a
  ADD COLUMN IF NOT EXISTS source_table TEXT,
  ADD COLUMN IF NOT EXISTS source_row_id UUID,
  ADD COLUMN IF NOT EXISTS requires_certifier BOOLEAN NOT NULL DEFAULT FALSE;

-- Lookup index so the dialog can find an existing entry for the source
-- row in O(1) rather than scanning every 623a row at the base.
CREATE INDEX IF NOT EXISTS idx_amtr_623a_source ON amtr_623a(base_id, source_table, source_row_id);
