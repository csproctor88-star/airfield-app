-- Add configurable discrepancy type → CE shop mapping per base
ALTER TABLE bases ADD COLUMN IF NOT EXISTS discrepancy_type_shop_map jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN bases.discrepancy_type_shop_map IS 'Maps discrepancy type values to CE shop names, e.g. {"lighting": "CE Electrical", "pavement": "CE Roads & Grounds"}';
