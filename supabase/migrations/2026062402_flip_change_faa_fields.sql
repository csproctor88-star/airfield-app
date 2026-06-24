-- 2026062402_flip_change_faa_fields.sql
-- FAA-submission structure for a coordinated FLIP change: the four change
-- categories (additions / deletions / revisions from → to) and the source
-- Reference Document & Page being submitted to the FAA. Additive only.

ALTER TABLE flip_changes
  ADD COLUMN IF NOT EXISTS reference_doc_page TEXT,
  ADD COLUMN IF NOT EXISTS additions          TEXT,
  ADD COLUMN IF NOT EXISTS deletions          TEXT,
  ADD COLUMN IF NOT EXISTS revisions_from     TEXT,
  ADD COLUMN IF NOT EXISTS revisions_to       TEXT;
