-- Fix navaid_statuses unique constraint for multi-base support.
-- The original constraint was on (navaid_name) alone, but different bases
-- can have identically named navaids (e.g. "24 ILS" at both KBDL and another base).
-- Replace with a composite unique on (base_id, navaid_name).

ALTER TABLE navaid_statuses
  DROP CONSTRAINT IF EXISTS navaid_statuses_navaid_name_key;

ALTER TABLE navaid_statuses
  ADD CONSTRAINT navaid_statuses_base_navaid_unique UNIQUE (base_id, navaid_name);
