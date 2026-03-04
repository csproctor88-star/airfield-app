-- Add issue_index to photos table so check photos can be linked to
-- specific issues/discrepancies within a multi-issue airfield check.
-- NULL means the photo is not associated with a specific issue (legacy behavior).

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS issue_index INTEGER;
