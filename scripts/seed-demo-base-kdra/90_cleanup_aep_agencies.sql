-- AEP agency dedup: re-point County EMS stragglers, delete 8 duplicate rows.
-- Keeps 6 canonical agencies (ARFF Engine 7, County EMS, County Sheriff,
-- Demo Tower, Mercy Hospital ED, Springfield Fire Dept).
BEGIN;

-- Re-point the 3 comms results on the duplicate County EMS row to the kept one.
UPDATE aep_comms_check_results
SET agency_id = '137de8bb-89fd-4e20-a795-9fc23d743f8d'
WHERE agency_id = '66d52e57-faaa-43d4-b1b9-598dae806a49';

-- Delete the 8 duplicate agency rows.
DELETE FROM aep_response_agencies
WHERE id IN (
  '66d52e57-faaa-43d4-b1b9-598dae806a49',
  '9e56aa2a-c042-4601-ad8f-ed95b57d4c20',
  '8d7b2f2f-01bd-4eab-a562-98172ae18ffc',
  '9cf74868-7ef5-47d6-9e73-1dbb0b23cbc1',
  'e0bde353-aa48-47f5-8cf2-05723770920f',
  '3a73922a-747d-4423-a404-58cfbf6ce4fc',
  'f6b1d02b-4fb9-4e6c-97ab-266ac12e3c33',
  'e966d371-477e-4380-a673-01095f96e1c1'
);

COMMIT;

SELECT jsonb_agg(jsonb_build_object('name', agency_name, 'role', agency_role) ORDER BY agency_name) AS agencies_remaining
FROM aep_response_agencies
WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
