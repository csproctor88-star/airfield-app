-- Owner ruling 2026-07-04: the BASH publication is cited as DAFMAN 91-212
-- throughout Glidepath. Rename the seeded regulations row to match
-- lib/regulations-data.ts. The e-publishing URL keeps its dafi91-212 slug —
-- that is where the file is hosted. Idempotent: re-running matches no rows.
UPDATE regulations
SET reg_id = 'DAFMAN 91-212'
WHERE reg_id = 'DAFI 91-212'
  AND NOT EXISTS (SELECT 1 FROM regulations WHERE reg_id = 'DAFMAN 91-212');
