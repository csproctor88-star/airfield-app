-- DAFMAN 13-204v3 Para 2.3.2.7.3: Estimated Completion Date on discrepancies
-- Optional field; AFMs use it to track CES work-order expected closure.

ALTER TABLE discrepancies
  ADD COLUMN IF NOT EXISTS estimated_completion_date DATE;
