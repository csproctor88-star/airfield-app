-- ═══════════════════════════════════════════════════════════════════
-- Remove 4 non-downloadable regulations from the database
-- These are paywalled or web-only sources with no available PDF:
--   NFPA 780  (Lightning Protection Systems - NFPA paywall)
--   NFPA 415  (Airport Terminal Buildings - NFPA paywall)
--   IEEE 142  (Grounding of Industrial Power Systems - IEEE paywall)
--   DoD 7000.14-R (DoD Financial Management Regulation - web only)
-- Run this in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

DELETE FROM regulations
WHERE reg_id IN (
  'NFPA 780',
  'NFPA 415',
  'IEEE 142',
  'DoD 7000.14-R'
);

-- Verify: should return 0 rows
SELECT reg_id FROM regulations
WHERE reg_id IN ('NFPA 780', 'NFPA 415', 'IEEE 142', 'DoD 7000.14-R');

-- Verify: total count should be 70
SELECT count(*) AS total_regulations FROM regulations;
